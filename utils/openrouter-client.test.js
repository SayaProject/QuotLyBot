const test = require('node:test')
const assert = require('node:assert/strict')

const { getOpenRouterClient } = require('./openrouter-client')

test('returns null when OPENAI_API_KEY is absent', () => {
  assert.equal(getOpenRouterClient({}), null)
})

test('creates an OpenRouter client only when OPENAI_API_KEY is set', () => {
  const client = getOpenRouterClient({ OPENAI_API_KEY: 'test-key' })
  assert.ok(client)
  assert.equal(client.baseURL, 'https://openrouter.ai/api/v1')
})
