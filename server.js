const path = require('path')
const express = require('express')
const ws = require('ws')
const crypto = require('crypto')
const cpen322 = require('./cpen322-tester.js')
const Database = require('./Database')
const SessionManager = require('./SessionManager')

const messageBlockSize = 10
var messages = {}

var db = new Database('mongodb://localhost:27017', 'cpen322-messenger')
var sessionManager = new SessionManager()

db.getRooms().then(rooms => {
  for (let room of rooms) {
    messages[room._id] = []
  }
})

var broker = new ws.Server({ port: 8000 })
broker.on('connection', (ws, req) => {
  console.log('received a connection!')

  let cookie = req.headers.cookie
  if (!cookie) {
    ws.close()
    return
  }

  let sessionToken = cookie.split('=')[1]
  let username = sessionManager.getUsername(sessionToken)
  if (!username) {
    ws.close()
  }

  ws.on('message', async data => {
    let parsedData = JSON.parse(data)
    messages[parsedData.roomId].push({
      username: username,
      text: parsedData.text
    })

    if (messages[parsedData.roomId].length === messageBlockSize) {
      let conversation = {
        room_id: parsedData.roomId,
        timestamp: Date.now(),
        messages: messages[parsedData.roomId]
      }
      await db.addConversation(conversation)
      messages[parsedData.roomId] = []
    }

    for (let client of broker.clients) {
      if (client !== ws) {
        parsedData.username = username
        client.send(JSON.stringify(parsedData))
      }
    }
  })
})

function logRequest(req, res, next) {
  console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`)
  next()
}

function isCorrectPassword(password, saltedHash) {
  let salt = saltedHash.substring(0, 20)
  let base64Hash = saltedHash.substring(20)
  let saltedPassword = password + salt
  let encryptedPassword = crypto.createHash('sha256').update(saltedPassword).digest('base64')
  return encryptedPassword === base64Hash
}

const host = 'localhost'
const port = 3000
const clientApp = path.join(__dirname, 'client')

// express app
let app = express()

app.use(express.json()) // to parse application/json
app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
app.use(logRequest) // logging for debug
app.use((err, req, res, next) => {
  console.log('instance of error: ', typeof err)
  if (err instanceof SessionManager.Error) {
    if (req.headers.accept == 'application/json') {
      res.status(401).send(err.message)
    } else {
      res.redirect('/login')
    }
  } else {
    res.status(500).send()
  }
})

// serve static files (client-side)
app.use('/', express.static(clientApp, { extensions: ['html'] }))
app.listen(port, () => {
  console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`)
})

app.get('/app.js', (req, res) => {
  res.redirect('/login')
})

app.get('/index', (req, res) => {
  res.status(401).send('Unauthorized')
})

app.get('/index.html', (req, res) => {
  res.status(401).send('Unauthorized')
})

app.get('/chat', sessionManager.middleware, (req, res) => {
  db.getRooms().then(rooms => {
    for (let room of rooms) {
      room.messages = messages[room._id]
    }
    res.send(rooms)
  })
})

app.get('/chat/:room_id', sessionManager.middleware, (req, res) => {
  db.getRoom(req.params.room_id).then(room => {
    if (room) {
      res.send(room)
    } else {
      res.status(404).send(`Room ${req.params.room_id} not found`)
    }
  })
})

app.get('/chat/:room_id/messages', sessionManager.middleware, (req, res) => {
  let before = parseInt(req.query.before, 10)
  let room_id = req.params.room_id

  db.getLastConversation(room_id, before).then(conversation => {
    res.send(conversation)
  })
})

app.get('/profile', sessionManager.middleware, (req, res) => {
  res.send({
    username: req.username
  })
})

app.get('/logout', (req, res) => {
  sessionManager.deleteSession(req)
  res.redirect('/login')
})

app.post('/chat', sessionManager.middleware, (req, res) => {
  db.addRoom(req.body)
    .then(room => {
      messages[room._id] = []
      room.messages = messages[room._id]
      res.status(200).send(room)
    })
    .catch(err => {
      res.status(400).send('Bad Request')
    })
})

app.post('/login', (req, res) => {
  let username = req.body.username
  let password = req.body.password

  db.getUser(username).then(user => {
    if (user) {
      if (isCorrectPassword(password, user.password)) {
        sessionManager.createSession(res, username)
        res.redirect('/')
      } else {
        res.redirect('/login')
      }
    } else {
      res.redirect('/login')
    }
  })
})

cpen322.connect('http://99.79.42.146/cpen322/test-a5-server.js')
cpen322.export(__filename, {
  app,
  messages,
  messageBlockSize,
  broker,
  db,
  sessionManager,
  isCorrectPassword
})
