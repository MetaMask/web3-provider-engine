const semaphore = require('semaphore')

module.exports = Stoplight


function Stoplight(){
  const self = this
  self._readinessLock = semaphore(1)
  self._readinessLock.take(function(){})
}

Stoplight.prototype.go = function(){
  const self = this
  self._readinessLock.leave()
}

Stoplight.prototype.await = function(fn){
  const self = this
  self._readinessLock.take(function(){
    self._readinessLock.leave()
    fn()
  }) 
}