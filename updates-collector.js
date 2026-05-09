require('dotenv').config({ path: './.env' })

const { randomUUID } = require('node:crypto')
const { Telegraf } = require('telegraf')
const { createRedisClient } = require('./utils/redis')
const { isTelegramConflictError } = require('./utils/telegram-errors')
const { getMaxWorkers, getQueueIndexForChatId } = require('./utils/worker-config')

function parsePositiveInt (value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const COLLECTOR_LOCK_KEY = 'telegram:collector:lock'
const COLLECTOR_LOCK_TTL_SECONDS = parsePositiveInt(process.env.COLLECTOR_LOCK_TTL_SECONDS, 45)
const COLLECTOR_LOCK_RETRY_MS = parsePositiveInt(process.env.COLLECTOR_LOCK_RETRY_MS, 5000)
const COLLECTOR_LOCK_RENEW_MS = Math.max(5000, Math.floor((COLLECTOR_LOCK_TTL_SECONDS * 1000) / 3))

const logWithTimestamp = (message) => {
  console.log(`[${new Date().toISOString()}] [COLLECTOR] ${message}`)
}

const errorWithTimestamp = (message, ...args) => {
  console.error(`[${new Date().toISOString()}] [COLLECTOR] ${message}`, ...args)
}

function formatDuration (milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

class TelegramCollector {
  constructor() {
    this.maxWorkers = getMaxWorkers()
    this.instanceId = randomUUID()
    this.hasCollectorLock = false
    this.isStopping = false
    this.lastLockWaitLogAt = 0
    this.lockRenewTimer = null
    this.pollingRetryTimer = null
    this.statsTimer = null
    this.startedAt = Date.now()
    this.lastCollectedCount = 0
    this.lastStatsAt = Date.now()
    this.bot = new Telegraf(process.env.BOT_TOKEN, {
      handlerTimeout: 1000 // Fast timeout for collector
    })

    // Single Redis connection for all operations
    this.redis = createRedisClient({
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    })


    this.setupRedisEvents()
    this.setupBot()
  }

  async acquireCollectorLock () {
    const acquired = await this.redis.set(
      COLLECTOR_LOCK_KEY,
      this.instanceId,
      'NX',
      'EX',
      COLLECTOR_LOCK_TTL_SECONDS
    )

    this.hasCollectorLock = acquired === 'OK'
    return this.hasCollectorLock
  }

  async renewCollectorLock () {
    const result = await this.redis.eval(
      `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("EXPIRE", KEYS[1], ARGV[2])
      end
      return 0
      `,
      1,
      COLLECTOR_LOCK_KEY,
      this.instanceId,
      String(COLLECTOR_LOCK_TTL_SECONDS)
    )

    this.hasCollectorLock = result === 1
    return this.hasCollectorLock
  }

  async releaseCollectorLock () {
    if (!this.hasCollectorLock) return

    await this.redis.eval(
      `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end
      return 0
      `,
      1,
      COLLECTOR_LOCK_KEY,
      this.instanceId
    )
    this.hasCollectorLock = false
  }

  scheduleLockRenewal () {
    if (this.lockRenewTimer) clearInterval(this.lockRenewTimer)

    this.lockRenewTimer = setInterval(async () => {
      try {
        const renewed = await this.renewCollectorLock()
        if (!renewed) {
          errorWithTimestamp('Collector lock was lost; stopping Telegram polling')
          this.stopLockRenewal()
          await this.stopActiveCollector()
          this.waitForCollectorLock()
        }
      } catch (error) {
        errorWithTimestamp('Collector lock renewal failed:', error.message)
      }
    }, COLLECTOR_LOCK_RENEW_MS)
  }

  stopLockRenewal () {
    if (!this.lockRenewTimer) return

    clearInterval(this.lockRenewTimer)
    this.lockRenewTimer = null
  }

  async waitForCollectorLock () {
    if (this.isStopping || this.hasCollectorLock) return

    try {
      const acquired = await this.acquireCollectorLock()
      if (acquired) {
        logWithTimestamp('Collector lock acquired')
        this.lastLockWaitLogAt = 0
        this.scheduleLockRenewal()
        await this.startActiveCollector()
        return
      }

      if (Date.now() - this.lastLockWaitLogAt > 60000) {
        this.lastLockWaitLogAt = Date.now()
        logWithTimestamp('Another collector is active; waiting for collector lock')
      }
    } catch (error) {
      errorWithTimestamp('Collector start/lock check failed:', error.message)
      await this.stopActiveCollector().catch((stopError) => {
        errorWithTimestamp('Collector cleanup after failed start failed:', stopError.message)
      })
      this.stopLockRenewal()
      await this.releaseCollectorLock().catch((releaseError) => {
        errorWithTimestamp('Collector lock release after failed start failed:', releaseError.message)
      })
    }

    if (!this.isStopping) {
      setTimeout(() => this.waitForCollectorLock(), COLLECTOR_LOCK_RETRY_MS).unref()
    }
  }

  setupRedisEvents() {
    this.redis.on('connect', () => {
      logWithTimestamp('Connected to Redis')
    })

    this.redis.on('error', (error) => {
      errorWithTimestamp('Redis error:', error.message)
    })

    this.redis.on('close', () => {
      logWithTimestamp('Redis connection closed')
    })
  }

  setupBot() {
    // Simple middleware to collect all updates
    this.bot.use(async (ctx) => {
      try {
        const update = ctx.update
        const collectedAt = Date.now()

        // Add timestamp and priority
        const enrichedUpdate = {
          ...update,
          collected_at: collectedAt,
          priority: this.getUpdatePriority(update)
        }

        // Get chat ID for consistent worker assignment
        const chatId = this.getChatId(update)
        const workerIndex = getQueueIndexForChatId(chatId, this.maxWorkers)
        const queueName = `telegram:updates:worker:${workerIndex}`

        // Push to specific worker queue and track live activity.
        await this.redis
          .multi()
          .lpush(queueName, JSON.stringify(enrichedUpdate))
          .incr('telegram:collected_count')
          .set('telegram:last_collected_at', collectedAt)
          .exec()

        // Don't log each update - only batch stats

      } catch (error) {
        errorWithTimestamp('Error collecting update:', error.message)
        // Don't break the bot, continue processing
      }

      // Don't call next() - we only collect, don't process
    })

    // Error handling
    this.bot.catch((err) => {
      if (isTelegramConflictError(err)) {
        errorWithTimestamp('Telegram polling conflict detected; another bot instance is polling. Retrying shortly.')
        this.schedulePollingRestart()
        return
      }

      errorWithTimestamp('Bot error:', err.message)
    })
  }

  startTDLibServer() {
    if (this.tdlibRedis) return

    // Initialize TDLib only in collector process
    const tdlib = require('./helpers/tdlib')

    // Create separate connection for TDLib pub/sub
    this.tdlibRedis = createRedisClient({
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: false
    })

    // Subscribe to TDLib requests from workers
    this.tdlibRedis.subscribe('tdlib:requests')

    this.tdlibRedis.on('message', async (channel, message) => {
      if (channel === 'tdlib:requests') {
        try {
          const request = JSON.parse(message)

          try {
            const result = await tdlib[request.method](...request.args)

            // Send response back
            this.redis.publish('tdlib:responses', JSON.stringify({
              id: request.id,
              result: result
            }))

          } catch (error) {
            // Send error response
            this.redis.publish('tdlib:responses', JSON.stringify({
              id: request.id,
              error: error.message
            }))
          }

        } catch (parseError) {
          logWithTimestamp(`TDLib request parse error: ${parseError.message}`)
        }
      }
    })

    logWithTimestamp('TDLib server started (centralized)')
  }

  async stopTDLibServer () {
    if (!this.tdlibRedis) return

    await this.tdlibRedis.quit()
    this.tdlibRedis = null
    logWithTimestamp('TDLib server stopped')
  }

  getChatId(update) {
    // Extract chat ID from various update types
    if (update.message) return update.message.chat.id
    if (update.edited_message) return update.edited_message.chat.id
    if (update.channel_post) return update.channel_post.chat.id
    if (update.edited_channel_post) return update.edited_channel_post.chat.id
    if (update.callback_query) return update.callback_query.message?.chat?.id || update.callback_query.from.id
    if (update.inline_query) return update.inline_query.from.id
    if (update.chosen_inline_result) return update.chosen_inline_result.from.id
    if (update.shipping_query) return update.shipping_query.from.id
    if (update.pre_checkout_query) return update.pre_checkout_query.from.id

    // Fallback to update_id if no chat found
    return update.update_id
  }

  getUpdatePriority(update) {
    // Higher priority for commands
    if (update.message?.text?.startsWith('/')) {
      return 10
    }
    // Medium priority for replies
    if (update.message?.reply_to_message) {
      return 5
    }
    // Default priority
    return 1
  }

  async startPolling () {
    if (this.isStopping || !this.hasCollectorLock) return

    logWithTimestamp('Starting Telegram collector...')
    await this.bot.launch({
      polling: {
        stopCallback: () => {
          if (!this.isStopping) this.schedulePollingRestart()
        }
      }
    })

    logWithTimestamp('Telegram collector started successfully')
  }

  async prepareQueues () {
    // Clear worker queues and reset stats once this process owns polling.
    for (let i = 0; i < this.maxWorkers; i++) {
      await this.redis.del(`telegram:updates:worker:${i}`)
    }
    await this.redis.set('telegram:collected_count', 0)
    await this.redis.set('telegram:processed_count', 0)
    await this.redis.set('telegram:error_count', 0)
    await this.redis.del('telegram:last_collected_at')
    await this.redis.del('telegram:last_processed_at')
    this.lastCollectedCount = 0
    this.lastStatsAt = Date.now()
  }

  async startActiveCollector () {
    await this.prepareQueues()
    this.startTDLibServer()
    this.startStatsTimer()
    await this.startPolling()
  }

  async stopActiveCollector () {
    this.stopStatsTimer()
    await this.stopPolling()
    await this.stopTDLibServer()
  }

  schedulePollingRestart () {
    if (this.isStopping || this.pollingRetryTimer) return

    this.pollingRetryTimer = setTimeout(async () => {
      this.pollingRetryTimer = null
      if (this.isStopping || !this.hasCollectorLock) return

      try {
        logWithTimestamp('Restarting Telegram polling after stop/conflict')
        await this.startPolling()
      } catch (error) {
        errorWithTimestamp('Telegram polling restart failed:', error.message)
        this.schedulePollingRestart()
      }
    }, COLLECTOR_LOCK_RETRY_MS)
  }

  async stopPolling () {
    await this.bot.stop()
    if (this.pollingRetryTimer) {
      clearTimeout(this.pollingRetryTimer)
      this.pollingRetryTimer = null
    }
  }

  startStatsTimer () {
    if (this.statsTimer) return

    this.statsTimer = setInterval(async () => {
      try {
        const now = Date.now()
        const collected = Number(await this.redis.get('telegram:collected_count') || 0)
        const processed = Number(await this.redis.get('telegram:processed_count') || 0)
        const errors = Number(await this.redis.get('telegram:error_count') || 0)
        const lastCollectedAt = Number(await this.redis.get('telegram:last_collected_at') || 0)
        const secondsSinceLastStats = Math.max(1, Math.round((now - this.lastStatsAt) / 1000))
        const collectedDelta = Math.max(0, collected - this.lastCollectedCount)
        const collectedRate = (collectedDelta / secondsSinceLastStats).toFixed(2)
        const lastUpdate = lastCollectedAt > 0 ? `${formatDuration(now - lastCollectedAt)} ago` : 'none yet'

        // Get queue sizes for all workers
        const queueSizes = []
        for (let i = 0; i < this.maxWorkers; i++) {
          const size = await this.redis.llen(`telegram:updates:worker:${i}`)
          queueSizes.push(size)
        }
        const totalQueue = queueSizes.reduce((a, b) => a + b, 0)

        logWithTimestamp(`Live: ${this.hasCollectorLock ? 'active' : 'standby'} | Collected: ${collected} (+${collectedDelta}/${secondsSinceLastStats}s, ${collectedRate}/s) | Processed: ${processed} | Errors: ${errors} | Queue: ${totalQueue} | Workers: [${queueSizes.join(',')}] | Last update: ${lastUpdate} | Uptime: ${formatDuration(now - this.startedAt)}`)
        this.lastCollectedCount = collected
        this.lastStatsAt = now
      } catch (error) {
        errorWithTimestamp('Stats error:', error.message)
      }
    }, 10000) // Every 10 seconds
  }

  stopStatsTimer () {
    if (!this.statsTimer) return

    clearInterval(this.statsTimer)
    this.statsTimer = null
  }

  async start() {
    try {
      await this.redis.connect()
      await this.waitForCollectorLock()

    } catch (error) {
      errorWithTimestamp('Failed to start collector:', error.message)
      process.exit(1)
    }
  }

  async stop() {
    this.isStopping = true
    logWithTimestamp('Stopping collector...')

    this.stopStatsTimer()
    this.stopLockRenewal()
    if (this.pollingRetryTimer) clearTimeout(this.pollingRetryTimer)

    await this.stopActiveCollector()
    await this.releaseCollectorLock()
    await this.redis.quit()
    logWithTimestamp('Collector stopped')
  }
}

// Create and start collector
const collector = new TelegramCollector()

// Graceful shutdown
process.once('SIGINT', () => collector.stop())
process.once('SIGTERM', () => collector.stop())

// Start the collector
collector.start()
