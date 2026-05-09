const Redis = require('ioredis')

function createRedisClient (options = {}) {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL || process.env.REDIS_PUBLIC_URL

  if (redisUrl) {
    return new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      ...options
    })
  }

  return new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    lazyConnect: true,
    ...options
  })
}

module.exports = { createRedisClient }
