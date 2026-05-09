const test = require('node:test')
const assert = require('node:assert/strict')
const { buildUserInsert, findOrCreateUser, getTelegramId } = require('../helpers/user-get')

test('returns null when an update has no Telegram user id', () => {
  assert.equal(getTelegramId({}), null)
  assert.equal(getTelegramId({ from: {} }), null)
})

test('builds user insert with telegram_id only', () => {
  const user = buildUserInsert({
    from: {
      id: 5940554521,
      first_name: 'Sexy',
      last_name: 'Saya',
      username: 'SexySayaBot'
    },
    chat: { type: 'private' }
  }, 5940554521)

  assert.equal(user.telegram_id, 5940554521)
  assert.equal(user.telegramId, undefined)
  assert.equal(user.full_name, 'Sexy Saya')
  assert.equal(user.status, 'member')
})

test('findOrCreateUser refetches on duplicate key races', async () => {
  const existingUser = { telegram_id: 123 }
  const ctx = {
    from: { id: 123, first_name: 'A' },
    db: {
      User: {
        findOneAndUpdate: async () => {
          const error = new Error('duplicate key')
          error.code = 11000
          throw error
        },
        findOne: async (query) => {
          assert.deepEqual(query, { telegram_id: 123 })
          return existingUser
        }
      }
    }
  }

  assert.equal(await findOrCreateUser(ctx, 123), existingUser)
})
