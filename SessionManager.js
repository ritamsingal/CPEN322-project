const crypto = require('crypto')

class SessionError extends Error {}

function SessionManager() {
  // default session length - you might want to
  // set this to something small during development
  const CookieMaxAgeMs = 600000

  // keeping the session data inside a closure to keep them protected
  const sessions = {}

  // might be worth thinking about why we create these functions
  // as anonymous functions (per each instance) and not as prototype methods
  this.createSession = (response, username, maxAge = CookieMaxAgeMs) => {
    let token = crypto.randomBytes(32).toString('hex')
    let session = {
      username: username,
      token: token,
      timestamp: Date.now()
    }

    sessions[token] = session
    response.cookie('cpen322-session', token, { maxAge: maxAge })
    setTimeout(() => {
      delete sessions[token]
    }, maxAge)
  }

  this.deleteSession = request => {
    if (request.username) {
      delete request.username
    }
    if (request.session) {
      delete sessions[request.session]
      delete request.session
    }
  }

  this.middleware = (request, response, next) => {
    if (!request.headers.cookie) {
      next(new SessionError('cookie not found'))
    } else {
      let cookie = request.headers.cookie
      let cookieInfo = cookie.split(';')
      let sessionToken = cookieInfo[0].split('=')[1]

      if (!sessions[sessionToken]) {
        next(new SessionError('session not found'))
      } else {
        request.username = sessions[sessionToken].username
        request.session = sessionToken
        next()
      }
    }
  }

  // this function is used by the test script.
  // you can use it if you want.
  this.getUsername = token => (token in sessions ? sessions[token].username : null)
}

// SessionError class is available to other modules as "SessionManager.Error"
SessionManager.Error = SessionError

module.exports = SessionManager
