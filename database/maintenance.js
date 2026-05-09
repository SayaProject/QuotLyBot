const INDEX_NOT_FOUND_CODES = new Set([27])
const LEGACY_USER_INDEX_FIELDS = ['telegramId']

function isIndexNotFoundError (error) {
  return INDEX_NOT_FOUND_CODES.has(error?.code) || error?.codeName === 'IndexNotFound'
}

function isLegacyUserIndex (index) {
  return LEGACY_USER_INDEX_FIELDS.some(field => index?.key?.[field] === 1)
}

async function dropLegacyUserIndexes (User) {
  const indexes = await User.collection.indexes()
  const legacyIndexes = indexes.filter(isLegacyUserIndex)

  for (const index of legacyIndexes) {
    try {
      await User.collection.dropIndex(index.name)
      console.warn(`[db-maintenance] Dropped legacy users index "${index.name}"`)
    } catch (error) {
      if (!isIndexNotFoundError(error)) throw error
    }
  }

  return legacyIndexes.map(index => index.name)
}

async function runDatabaseMaintenance (db) {
  await dropLegacyUserIndexes(db.User)
}

module.exports = {
  dropLegacyUserIndexes,
  isLegacyUserIndex,
  runDatabaseMaintenance
}
