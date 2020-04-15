const { EventEmitter } = require('events')
const { inherits } = require('util')

module.exports = Stoplight


inherits(Stoplight, EventEmitter)

function Stoplight () {
  const self = this
  EventEmitter.call(self)
  self.isLocked = true
}

Stoplight.prototype.go = function () {
  const self = this
  self.isLocked = false
  self.emit('unlock')
}

Stoplight.prototype.stop = function () {
  const self = this
  self.isLocked = true
  self.emit('lock')
}

Stoplight.prototype.await = function (fn) {
  const self = this
  if (self.isLocked) {
    self.once('unlock', fn)
  } else {
    setTimeout(fn)
  }
}
