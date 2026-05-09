const test = require('node:test')
const assert = require('node:assert/strict')

const {
  getMaxWorkers,
  getQueueIndexForChatId,
  getWorkerHandlerTimeout,
  getWorkerIndex
} = require('./worker-config')

test('getMaxWorkers defaults to three and accepts positive integers', () => {
  assert.equal(getMaxWorkers({}), 3)
  assert.equal(getMaxWorkers({ MAX_WORKERS: '6' }), 6)
  assert.equal(getMaxWorkers({ MAX_WORKERS: '0' }), 3)
  assert.equal(getMaxWorkers({ MAX_WORKERS: 'abc' }), 3)
})

test('getWorkerHandlerTimeout defaults and accepts positive integers', () => {
  assert.equal(getWorkerHandlerTimeout({}), 30000)
  assert.equal(getWorkerHandlerTimeout({ WORKER_HANDLER_TIMEOUT: '45000' }), 45000)
})

test('queue index is stable for large and negative chat ids', () => {
  assert.equal(getQueueIndexForChatId('-1001234567890123456', 4), 0)
  assert.equal(getQueueIndexForChatId('-1001234567890123457', 4), 1)
  assert.equal(getQueueIndexForChatId('inline-user', 4), getQueueIndexForChatId('inline-user', 4))
})

test('worker index wraps explicit values into available worker range', () => {
  assert.equal(getWorkerIndex('5', 123, 3), 2)
  assert.equal(getWorkerIndex(undefined, 123, 3), 0)
})
