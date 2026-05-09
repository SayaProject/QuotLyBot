const test = require('node:test')
const assert = require('node:assert/strict')
const { createRedisClient } = require('./redis')

test('host-based Redis config includes username and password when provided', () => {
  const original = {
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_URL: process.env.REDIS_URL,
    REDIS_USERNAME: process.env.REDIS_USERNAME,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD
  }

  delete process.env.REDIS_URL
  process.env.REDIS_HOST = 'redis.example.com'
  process.env.REDIS_PORT = '10702'
  process.env.REDIS_USERNAME = 'default'
  process.env.REDIS_PASSWORD = 'secret'

  const redis = createRedisClient()
  try {
    assert.equal(redis.options.host, 'redis.example.com')
    assert.equal(redis.options.port, 10702)
    assert.equal(redis.options.username, 'default')
    assert.equal(redis.options.password, 'secret')
  } finally {
    redis.disconnect()
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
