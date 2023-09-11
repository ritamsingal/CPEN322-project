var profile = {
  username: 'Ritam'
}

var Service = {
  origin: window.location.origin,

  getAllRooms: async function () {
    let response = await fetch(`${this.origin}/chat`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    if (response.ok) {
      return await response.json()
    }
    throw new Error(await response.text())
  },

  addRoom: async function (data) {
    let response = await fetch(`${this.origin}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    if (response.ok) {
      return await response.json()
    }
    throw new Error(await response.text())
  },

  getLastConversation: async function (roomId, before) {
    let response = await fetch(`${this.origin}/chat/${roomId}/messages?before=${before}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    if (response.ok) {
      let conv = await response.json()
      return conv
    }
    throw new Error(await response.text())
  }
}

// Removes the contents of the given DOM element (equivalent to elem.innerHTML = '' but faster)
function emptyDOM(elem) {
  while (elem.firstChild) elem.removeChild(elem.firstChild)
}

// Creates a DOM element from the given HTML string
function createDOM(htmlString) {
  let template = document.createElement('template')
  template.innerHTML = htmlString.trim()
  return template.content.firstChild
}

function* makeConversationLoader(room) {
  let timestamp = room.timestamp
  var conversation
  do {
    room.canLoadConversation = false
    yield new Promise((resolve, reject) => {
      Service.getLastConversation(room.id, timestamp).then(conv => {   
        conversation = conv     
        if (conv) {
          timestamp = conv.timestamp
          room.addConversation(conv)
          room.canLoadConversation = true
          resolve(conv)
        } else {
          resolve(null)
        }
      })
    })
  } while (conversation)
}

function main() {
  var socket = new WebSocket(`ws://localhost:8000`)
  socket.addEventListener('message', message => {
    let data = JSON.parse(message.data)
    let room = lobby.getRoom(data.roomId)
    room.addMessage(data.username, data.text)
  })

  var lobby = new Lobby()
  var lobbyView = new LobbyView(lobby)
  var chatView = new ChatView(socket)
  var profileView = new ProfileView()

  var refreshLobby = () => {
    Service.getAllRooms()
      .then(rooms => {
        for (let room of rooms) {
          if (lobby.rooms[room._id] !== undefined) {
            let curRoom = lobby.rooms[room._id]
            curRoom.image = room.image
            curRoom.name = room.name
          } else {
            lobby.addRoom(room._id, room.name, room.image, room.messages)
          }
        }
      })
      .catch(error => {
        console.error(error)
      })
  }

  var renderRoute = () => {
    let url = window.location.hash.slice(2).split('/')
    let page = url[0]
    let roomId = url[1]
    let pageView = document.getElementById('page-view')

    if (page === '') {
      emptyDOM(pageView)
      pageView.appendChild(lobbyView.elem)
    } else if (page === 'chat') {
      emptyDOM(pageView)
      pageView.appendChild(chatView.elem)
      let room = lobby.getRoom(roomId)

      if (room !== null && room !== undefined) {
        chatView.setRoom(room)
      } else {
        throw {
          message: 'Room ID invalid'
        }
      }
    } else if (page === 'profile') {
      emptyDOM(pageView)
      pageView.appendChild(profileView.elem)
    }
  }

  window.addEventListener('popstate', renderRoute)
  renderRoute()
  refreshLobby()

  setInterval(refreshLobby, 5000)

  cpen322.export(arguments.callee, {
    renderRoute,
    lobbyView,
    refreshLobby,
    lobby,
    chatView,
    profileView,
    socket
  })
}

window.addEventListener('load', main)

class LobbyView {
  constructor(lobby) {
    this.lobby = lobby
    this.lobby.onNewRoom = room => {
      let list = `<li class="bordered"><a class="h-full w-full" href="#/chat/${room.id}">${room.name}</a></li>`
      this.listElem.appendChild(createDOM(list))
    }

    this.elem = createDOM(
      `<div class="content">
        <ul class="room-list">
          <li class="bordered"><a class="h-full w-full" href="#/chat">Everyone in CPEN400A</a></li>
          <li class="bordered"><a class="h-full w-full" href="#/chat">Foodies only</a></li>
          <li class="bordered"><a class="h-full w-full" href="#/chat">Gamers unite</a></li>
          <li class="bordered"><a class="h-full w-full" href="#/chat">Canucks Fans</a></li>
        </ul>

        <div class="page-control flex center-all-flex w-full bg-header-footer">
          <input type="text" name="room-name" id="room-name">
          <button id="create-room">Create Room</button>
        </div>
      </div>`
    )

    this.listElem = this.elem.querySelector('.room-list')
    this.inputElem = this.elem.querySelector('div.page-control input')
    this.buttonElem = this.elem.querySelector('div.page-control button')

    this.buttonElem.addEventListener('click', async () => {
      let roomName = this.inputElem.value
      Service.addRoom({ name: roomName, image: 'no image needed' })
        .then(async room => {
          this.lobby.addRoom(room._id, room.name, room.image, room.messages)
        })
        .catch(error => {
          console.log(error)
        })
      this.inputElem.value = ''
    })

    this.redrawList()
  }

  redrawList() {
    emptyDOM(this.listElem)
    for (let key in this.lobby.rooms) {
      let room = this.lobby.rooms[key]
      let list = `<li class="bordered"><a class="h-full w-full" href="#/chat/${room.id}">${room.name}</a></li>`
      this.listElem.appendChild(createDOM(list))
    }
  }
}

class ChatView {
  constructor(socket) {
    this.socket = socket

    this.elem = createDOM(
      `<div class="content">
        <h4 class="room-name bordered">Everyone in CPEN400A</h4>
        <div class="message-list">
          <div class="message">
            <span class="message-user">Bob</span>
            <span class="message-text">Hello everyone</span>
          </div>

          <div class="message my-message">
            <span class="message-user">Alice</span>
            <span class="message-text">Hello Bob!</span>
          </div>
        </div>

        <div class="page-control flex center-all-flex w-full bg-header-footer">
          <textarea class="message-input" name="" id=""></textarea>
          <button>Send</button>
        </div>
      </div>`
    )

    this.titleElem = this.elem.querySelector('div.content h4')
    this.chatElem = this.elem.querySelector('.message-list')
    this.inputElem = this.elem.querySelector('div.page-control textarea')
    this.buttonElem = this.elem.querySelector('div.page-control button')
    this.room = null

    this.buttonElem.addEventListener('click', () => {
      this.sendMessage()
    })

    this.inputElem.addEventListener('keyup', event => {
      if (event.keyCode === 13 && !event.shiftKey) {
        this.sendMessage()
        event.value = ''
      }
    })

    this.chatElem.addEventListener('wheel', event => {
      console.log("scrollTop = ", this.chatElem.scrollTop)
      if (event.deltaY < 0 && this.chatElem.scrollTop <= 0) {
        if (this.room.canLoadConversation) {
          this.room.getLastConversation.next()
        }
      }
    })
  }

  sendMessage() {
    let message = this.inputElem.value
    this.room.addMessage(profile.username, message)
    this.inputElem.value = ''

    let socketResponse = {
      roomId: this.room.id,
      username: profile.username,
      text: message
    }

    this.socket.send(JSON.stringify(socketResponse))
  }

  setRoom(room) {
    this.room = room
    this.titleElem.innerHTML = room.name
    emptyDOM(this.chatElem)

    let newMessage = message => {
      let msg = `
      <div class="message">
        <span class="message-user">${message.username}</span>
        <span class="message-text">${message.text}</span>
      </div>`
      let msgDOM = createDOM(msg)
      if (message.username === profile.username) {
        msgDOM.classList.add('my-message')
      }
      this.chatElem.appendChild(msgDOM)
    }

    for (let message of this.room.messages) {
      newMessage(message)
    }

    this.room.onNewMessage = message => {
      newMessage(message)
    }

    this.room.onFetchConversation = conversation => {
      let scrollHeightInitial  = this.chatElem.scrollHeight;
      for (let i = conversation.messages.length - 1; i >= 0; i--) {
        let message = conversation.messages[i]
        let msg = `
        <div class="message">
          <span class="message-user">${message.username}</span>
          <span class="message-text">${message.text}</span>
        </div>`
        let msgDOM = createDOM(msg)
        if (message.username === profile.username) {
          msgDOM.classList.add('my-message')
        }
        this.chatElem.prepend(msgDOM)
      }
      let scrollHeightFinal = this.chatElem.scrollHeight;
      this.chatElem.scrollTop = scrollHeightFinal - scrollHeightInitial;
    }
  }
}

class ProfileView {
  constructor() {
    this.elem = createDOM(
      `<div class="content">
        <div class="profile-form">
          <div class="form-field">
            <label for="username"> Username </label>
            <input type="text" name="" id="username">
          </div>

          <div class="form-field">
            <label for="username"> Password </label>
            <input type="password" name="" id="password">
          </div>

          <div class="form-field">
            <label for="file"> Avatar Image </label>
            <input type="file" name="" id="file">
          </div>

          <div class="form-field">
            <label for="about"> About </label>
            <textarea name="about" id="about" cols="70" rows="2"></textarea>
          </div>
        </div>

        <div class="page-control flex center-all-flex w-full bg-header-footer">
          <button> Save </button>
        </div>
      </div>`
    )
  }
}

class Room {
  constructor(id, name, image = 'assets/everyone-icon.png', messages = []) {
    this.id = id
    this.name = name
    this.image = image
    this.messages = messages
    this.getLastConversation = makeConversationLoader(this)
    this.canLoadConversation = true
    this.timestamp = Date.now()
  }

  addMessage(username, text) {
    let message = {
      username: username,
      text: text
    }

    if (text.trim() === '') {
      return
    } else {
      this.messages.push(message)
    }

    if (this.onNewMessage !== undefined && this.onNewMessage !== null) {
      this.onNewMessage(message)
    }
  }

  addConversation(conversation) {
    this.messages = conversation.messages.concat(this.messages)
    this.onFetchConversation(conversation)
  }
}

class Lobby {
  constructor() {
    this.rooms = {}
  }

  getRoom(roomId) {
    return this.rooms[roomId]
  }

  addRoom(id, name, image, messages) {
    this.rooms[id] = new Room(id, name, image, messages)
    if (this.onNewRoom !== undefined) {
      this.onNewRoom(this.rooms[id])
    }
  }
}
