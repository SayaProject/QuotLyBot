require('dotenv').config({ path: './.env' })

const http = require('node:http')
const { spawn } = require('node:child_process')
const { getMaxWorkers } = require('./utils/worker-config')

const children = new Map()
const startedAt = Date.now()
let expectedProcessCount = 0
let shuttingDown = false
let shutdownExitCode = 0

function firstEnvValue (...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name]
  }
  return null
}

function normalizeEnvAliases () {
  if (!process.env.MONGODB_URI) {
    const mongoUri = firstEnvValue('MONGO_URL', 'MONGO_PRIVATE_URL', 'MONGO_PUBLIC_URL')
    if (mongoUri) process.env.MONGODB_URI = mongoUri
  }

  if (!process.env.REDIS_URL) {
    const redisUrl = firstEnvValue('REDIS_PRIVATE_URL', 'REDIS_PUBLIC_URL')
    if (redisUrl) process.env.REDIS_URL = redisUrl
  }

  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production'
  }
}

function validateEnv () {
  const missing = []

  for (const name of ['BOT_TOKEN', 'MONGODB_URI', 'QUOTE_API_URI', 'TELEGRAM_API_ID', 'TELEGRAM_API_HASH']) {
    if (!process.env[name]) missing.push(name)
  }

  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    missing.push('REDIS_URL or REDIS_HOST')
  }

  if (!process.env.REDIS_URL && process.env.REDIS_HOST?.includes('redislabs.com') && !process.env.REDIS_PASSWORD) {
    missing.push('REDIS_PASSWORD')
  }

  if (missing.length > 0) {
    console.error(`[railway] Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }
}

function addNodeOption (currentOptions, option) {
  const options = currentOptions ? currentOptions.split(/\s+/).filter(Boolean) : []
  if (!options.includes(option)) options.push(option)
  return options.join(' ')
}

function startChild (name, script, extraEnv = {}) {
  const child = spawn(process.execPath, [script], {
    env: {
      ...process.env,
      NODE_OPTIONS: addNodeOption(process.env.NODE_OPTIONS, '--disable-warning=DEP0040'),
      ...extraEnv
    },
    stdio: 'inherit'
  })

  const state = {
    child,
    exitCode: null,
    exitedAt: null,
    name,
    signal: null
  }

  state.exitPromise = new Promise((resolve) => {
    child.once('error', (error) => {
      state.exitCode = 1
      state.exitedAt = new Date().toISOString()
      resolve(state)

      if (!shuttingDown) {
        console.error(`[railway] failed to start ${name}: ${error.message}`)
        shutdown('SIGTERM', 1)
      }
    })

    child.once('exit', (code, signal) => {
      state.exitCode = code
      state.signal = signal
      state.exitedAt = new Date().toISOString()
      resolve(state)

      if (!shuttingDown) {
        console.error(`[railway] ${name} exited with code ${code ?? 'null'} signal ${signal ?? 'null'}`)
        shutdown('SIGTERM', code || 1)
      }
    })
  })

  children.set(name, state)
  console.log(`[railway] started ${name} (pid ${child.pid})`)
  return child
}

function healthPayload () {
  const processes = [...children.values()].map((state) => ({
    name: state.name,
    pid: state.child.pid,
    running: state.exitCode === null && state.signal === null,
    exitCode: state.exitCode,
    signal: state.signal,
    exitedAt: state.exitedAt
  }))

  const allRunning = processes.length === expectedProcessCount && processes.every((processInfo) => processInfo.running)
  const startupGraceMs = Number.parseInt(process.env.HEALTH_STARTUP_GRACE_MS || '5000', 10)
  const warmedUp = Date.now() - startedAt >= startupGraceMs

  return {
    status: allRunning && warmedUp ? 'healthy' : 'starting',
    uptime: process.uptime(),
    workerCount: getMaxWorkers(),
    processes
  }
}

function startHealthServer () {
  const port = Number.parseInt(process.env.PORT || process.env.HEALTH_CHECK_PORT || '3000', 10)
  const server = http.createServer((req, res) => {
    if (req.url !== '/health') {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'not_found' }))
      return
    }

    const payload = healthPayload()
    const healthy = payload.status === 'healthy'
    res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(payload))
  })

  server.listen(port, '0.0.0.0', () => {
    console.log(`[railway] health server listening on ${port}`)
  })

  return server
}

function shutdown (signal, exitCode = 0) {
  if (shuttingDown) return

  shuttingDown = true
  shutdownExitCode = exitCode
  console.log(`[railway] shutting down after ${signal}`)

  for (const state of children.values()) {
    if (state.exitCode === null && state.signal === null) {
      state.child.kill(signal)
    }
  }

  Promise.all([...children.values()].map((state) => state.exitPromise))
    .finally(() => process.exit(shutdownExitCode))

  setTimeout(() => {
    console.error('[railway] shutdown timeout reached')
    process.exit(shutdownExitCode || 1)
  }, 15000).unref()
}

normalizeEnvAliases()
validateEnv()

const workerCount = getMaxWorkers()
expectedProcessCount = workerCount + 1

process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGINT', () => shutdown('SIGINT'))

startHealthServer()
startChild('collector', 'updates-collector.js')

for (let index = 0; index < workerCount; index++) {
  startChild(`worker-${index}`, 'updates-worker.js', {
    WORKER_INDEX: String(index)
  })
}
