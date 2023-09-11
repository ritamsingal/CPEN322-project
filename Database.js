const { MongoClient, ObjectId } = require('mongodb') // require the mongodb driver

/**
 * Uses mongodb v3.6+ - [API Documentation](http://mongodb.github.io/node-mongodb-native/3.6/api/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our cpen322 app.
 */
function Database(mongoUrl, dbName) {
  if (!(this instanceof Database)) return new Database(mongoUrl, dbName)
  this.connected = new Promise((resolve, reject) => {
    MongoClient.connect(
      mongoUrl,
      {
        useNewUrlParser: true
      },
      (err, client) => {
        if (err) reject(err)
        else {
          console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName)
          resolve(client.db(dbName))
        }
      }
    )
  })
  this.status = () =>
    this.connected.then(
      db => ({ error: null, url: mongoUrl, db: dbName }),
      err => ({ error: err })
    )
}

Database.prototype.getRooms = function () {
  return this.connected.then(
    db =>
      new Promise((resolve, reject) => {
        /* TODO: read the chatrooms from `db`
         * and resolve an array of chatrooms */
        if (db) {
          resolve(db.collection('chatrooms').find().toArray())
        } else {
          reject('No database connection')
        }
      })
  )
}

Database.prototype.getRoom = function (room_id) {
  return this.connected.then(
    db =>
      new Promise((resolve, reject) => {
        /* TODO: read the chatroom from `db`
         * and resolve the result */
        if (db) {
          resolve(db.collection('chatrooms').findOne({ _id: room_id }))
        } else {
          reject('No database connection')
        }
      })
  )
}

Database.prototype.addRoom = function (room) {
  return this.connected.then(
    db =>
      new Promise((resolve, reject) => {
        /* TODO: insert a room in the "chatrooms" collection in `db`
         * and resolve the newly added room */
        if (db) {
          if (!room.name) {
            reject('No room name provided')
          } else {
            if (!room._id) {
              room._id = ObjectId().toString()
            }
            db.collection('chatrooms').insertOne(room)
            resolve(room)
          }
        } else {
          reject('No database connection')
        }
      })
  )
}

Database.prototype.getLastConversation = function (room_id, before) {
  return this.connected.then(
    db =>
      new Promise((resolve, reject) => {
        /* TODO: read a conversation from `db` based on the given arguments
         * and resolve if found */

        if (db) {
          if (!before) {
            before = Date.now()
          }

          const query = { room_id: room_id, timestamp: { $lt: before } }
          const options = {
            sort: { timestamp: 1 }
          }

          db.collection('conversations')
            .find(query, options)
            .toArray()
            .then(conversations => {
              if (conversations.length > 0) {
                resolve(conversations[conversations.length - 1])
              } else {
                resolve(null)
              }
            })
        } else {
          reject('No database connection')
        }
      })
  )
}

Database.prototype.addConversation = function (conversation) {
  return this.connected.then(
    db =>
      new Promise((resolve, reject) => {
        /* TODO: insert a conversation in the "conversations" collection in `db`
         * and resolve the newly added conversation */

        if (db) {
          if (!conversation.room_id || !conversation.timestamp || !conversation.messages) {
            throw new Error('Invalid conversation')
          }
          conversation._id = ObjectId()
          db.collection('conversations').insertOne(conversation)
          resolve(conversation)
        } else {
          reject('No database connection')
        }
      })
  )
}

Database.prototype.getUser = function (username) {
  return this.connected.then(
    db =>
      new Promise((resolve, reject) => {
        if (db) {
          let user = db.collection('users').findOne({ username: username })
          resolve(user)
        } else {
          reject('No database connection')
        }
      })
  )
}

module.exports = Database
