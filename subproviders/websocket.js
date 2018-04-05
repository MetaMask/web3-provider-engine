const Backoff = require('backoff')
const createPayload = require('../util/create-payload')
const inherits = require('util').inherits
const Subprovider = require('./subprovider')
const WebSocket = require('ws')

class WebsocketProvider extends Subprovider {
  constructor({ rpcUrl, debug }) {
    super()

    Object.defineProperties(this, {
      _backoff: {
        value: Backoff.exponential({
          randomisationFactor: 0.2,
          maxDelay: 5000
        })
      },
      _connectTime: {
        value: null,
        writable: true
      },
      _log: {
        value: debug
          ? (...args) => console.info.apply(console, ['[WSProvider]', ...args])
          : () => { }
      },
      _pendingRequests: {
        value: new Map()
      },
      _socket: {
        value: null,
        writable: true
      },
      _unhandledRequests: {
        value: []
      },
      _url: {
        value: rpcUrl
      }
    })

    this._handleSocketClose = this._handleSocketClose.bind(this)
    this._handleSocketMessage = this._handleSocketMessage.bind(this)
    this._handleSocketOpen = this._handleSocketOpen.bind(this)

    // Called when a backoff timeout has finished. Time to try reconnecting.
    this._backoff.on('ready', () => {
      this._openSocket()
    })

    this._openSocket()
  }

  handleRequest(payload, next, end) {
    if (!this._socket || this._socket.readyState !== WebSocket.OPEN) {
      this._unhandledRequests.push(Array.from(arguments))
      this._log('Socket not open. Request queued.')
      return;
    }

    this._pendingRequests.set(payload.id, Array.from(arguments))

    const newPayload = createPayload(payload)
    delete newPayload.origin

    this._socket.send(JSON.stringify(newPayload))
    this._log('Request sent:', newPayload.method)
  }

  _handleSocketClose({ reason, code }) {
    this._log(`Socket closed, code ${code} (${reason || 'no reason'})`);
    // If the socket has been open for longer than 5 seconds, reset the backoff
    if (this._connectTime && Date.now() - this._connectTime > 5000) {
      this._backoff.reset()
    }

    this._socket.removeEventListener('close', this._handleSocketClose)
    this._socket.removeEventListener('message', this._handleSocketMessage)
    this._socket.removeEventListener('open', this._handleSocketOpen)

    this._socket = null
    this._backoff.backoff()
  }

  _handleSocketMessage(message) {
    let data;

    try {
      data = JSON.parse(message.data)
    } catch (e) {
      this._log('Received a message that is not valid JSON:', message)
      return;
    }

    this._log('Received message ID:', data.id)

    if (!this._pendingRequests.has(data.id)) {
      return
    }

    const [payload, next, end] = this._pendingRequests.get(data.id)
    this._pendingRequests.delete(data.id)
    end(data.error && data.error.message, data.result)
  }

  _handleSocketOpen() {
    this._log('Socket open.')
    this._connectTime = Date.now();

    // Any pending requests need to be resent because our session was lost
    // and will not get responses for them in our new session.
    this._pendingRequests.forEach(value => this._unhandledRequests.push(value))
    this._pendingRequests.clear()

    const unhandledRequests = this._unhandledRequests.splice(0, this._unhandledRequests.length)
    unhandledRequests.forEach(request => {
      this.handleRequest.apply(this, request)
    })
  }

  _openSocket() {
    this._log('Opening socket...')
    this._socket = new WebSocket(this._url)
    this._socket.addEventListener('close', this._handleSocketClose)
    this._socket.addEventListener('message', this._handleSocketMessage)
    this._socket.addEventListener('open', this._handleSocketOpen)
  }
}

module.exports = WebsocketProvider
