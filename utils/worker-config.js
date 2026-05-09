const DEFAULT_MAX_WORKERS = 3
const DEFAULT_WORKER_HANDLER_TIMEOUT = 30000
const DEFAULT_WORKER_CONCURRENT_LIMIT = 50

function parsePositiveInteger (value, fallback) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return parsed
}

function getMaxWorkers (env = process.env) {
  return parsePositiveInteger(env.MAX_WORKERS, DEFAULT_MAX_WORKERS)
}

function getWorkerHandlerTimeout (env = process.env) {
  return parsePositiveInteger(env.WORKER_HANDLER_TIMEOUT, DEFAULT_WORKER_HANDLER_TIMEOUT)
}

function getWorkerConcurrentLimit (env = process.env) {
  return parsePositiveInteger(env.WORKER_CONCURRENT_LIMIT, DEFAULT_WORKER_CONCURRENT_LIMIT)
}

function getQueueIndexForChatId (chatId, maxWorkers = DEFAULT_MAX_WORKERS) {
  const workerCount = parsePositiveInteger(maxWorkers, DEFAULT_MAX_WORKERS)
  const raw = String(chatId ?? '')

  try {
    const value = BigInt(raw)
    const positive = value < 0n ? -value : value
    return Number(positive % BigInt(workerCount))
  } catch {
    let hash = 0
    for (let index = 0; index < raw.length; index++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(index)) | 0
    }
    return Math.abs(hash) % workerCount
  }
}

function getWorkerIndex (explicitIndex, fallbackSeed, maxWorkers = DEFAULT_MAX_WORKERS) {
  const workerCount = parsePositiveInteger(maxWorkers, DEFAULT_MAX_WORKERS)
  const parsed = Number.parseInt(explicitIndex, 10)

  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed % workerCount
  }

  return getQueueIndexForChatId(fallbackSeed, workerCount)
}

module.exports = {
  DEFAULT_MAX_WORKERS,
  DEFAULT_WORKER_CONCURRENT_LIMIT,
  DEFAULT_WORKER_HANDLER_TIMEOUT,
  getMaxWorkers,
  getQueueIndexForChatId,
  getWorkerConcurrentLimit,
  getWorkerHandlerTimeout,
  getWorkerIndex,
  parsePositiveInteger
}
