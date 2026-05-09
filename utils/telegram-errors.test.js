const test = require('node:test')
const assert = require('node:assert/strict')
const { getTelegramErrorDescription, isStickerSetInvalidError } = require('./telegram-errors')

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
