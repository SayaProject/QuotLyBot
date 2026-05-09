const collections = require('./models')
const connection = require('./connection')
const { runDatabaseMaintenance } = require('./maintenance')

const db = {
  connection,
  ready: null
}

Object.keys(collections).forEach((collectionName) => {
  db[collectionName] = connection.model(collectionName, collections[collectionName])
})

db.ready = connection.readyPromise.then(async () => {
  await runDatabaseMaintenance(db)
  return db
})

module.exports = {
  db
}
