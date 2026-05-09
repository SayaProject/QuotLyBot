const test = require('node:test')
const assert = require('node:assert/strict')
const { dropLegacyUserIndexes, isLegacyUserIndex } = require('../database/maintenance')

test('detects legacy camelCase user telegramId index', () => {
  assert.equal(isLegacyUserIndex({ key: { telegramId: 1 } }), true)
  assert.equal(isLegacyUserIndex({ key: { telegram_id: 1 } }), false)
})

test('drops legacy user telegramId indexes', async () => {
  const dropped = []
  const User = {
    collection: {
      indexes: async () => [
        { name: '_id_', key: { _id: 1 } },
        { name: 'telegramId_1', key: { telegramId: 1 } },
        { name: 'telegram_id_1', key: { telegram_id: 1 } }
      ],
      dropIndex: async (name) => dropped.push(name)
    }
  }

  const result = await dropLegacyUserIndexes(User)

  assert.deepEqual(result, ['telegramId_1'])
  assert.deepEqual(dropped, ['telegramId_1'])
})
