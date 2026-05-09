const test = require('node:test')
const assert = require('node:assert/strict')
const { getTelegramErrorDescription, isStickerSetInvalidError, isTelegramConflictError } = require('./telegram-errors')

test('reads Telegram error descriptions from common shapes', () => {
  assert.equal(getTelegramErrorDescription({ description: 'Bad Request: STICKERSET_INVALID' }), 'Bad Request: STICKERSET_INVALID')
  assert.equal(getTelegramErrorDescription({ response: { description: 'Bad Request: BOT_BLOCKED' } }), 'Bad Request: BOT_BLOCKED')
  assert.equal(getTelegramErrorDescription(new Error('network down')), 'network down')
})

test('detects invalid sticker set errors case-insensitively', () => {
  assert.equal(isStickerSetInvalidError({ description: 'Bad Request: STICKERSET_INVALID' }), true)
  assert.equal(isStickerSetInvalidError({ response: { description: 'Bad Request: stickerset_invalid' } }), true)
  assert.equal(isStickerSetInvalidError({ description: 'Bad Request: BOT_BLOCKED' }), false)
})

test('detects Telegram polling conflict errors', () => {
  assert.equal(isTelegramConflictError({ code: 409 }), true)
  assert.equal(isTelegramConflictError({ description: 'Conflict: terminated by other getUpdates request' }), true)
  assert.equal(isTelegramConflictError({ description: 'Bad Request: BOT_BLOCKED' }), false)
})
