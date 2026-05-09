const test = require('node:test')
const assert = require('node:assert/strict')
const { buildDirectQuoteMessage, getDirectQuoteText } = require('./quote-command')

test('extracts direct quote text from /q command', () => {
  assert.equal(getDirectQuoteText('/q 999'), '999')
  assert.equal(getDirectQuoteText('/q hello world'), 'hello world')
  assert.equal(getDirectQuoteText('/q@SexySayaBot hello'), 'hello')
})

test('returns empty string when /q has no direct text', () => {
  assert.equal(getDirectQuoteText('/q'), '')
  assert.equal(getDirectQuoteText('/q   '), '')
  assert.equal(getDirectQuoteText('/q_123'), '')
})

test('builds a synthetic Telegram message for direct quote text', () => {
  const ctx = {
    chat: { id: 1, type: 'private' },
    from: { id: 2, first_name: 'Shnwaz' },
    message: { message_id: 3, date: 1760000000 }
  }

  assert.deepEqual(buildDirectQuoteMessage(ctx, '999'), {
    message_id: 3,
    date: 1760000000,
    chat: { id: 1, type: 'private' },
    from: { id: 2, first_name: 'Shnwaz' },
    text: '999'
  })
})
