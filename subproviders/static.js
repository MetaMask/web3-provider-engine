const inherits = require('util').inherits
const Subprovider = require('./subprovider.js')

module.exports = StaticProvider

inherits(StaticProvider, Subprovider)

function StaticProvider(staticResponses){
  const self = this
  staticResponses = staticResponses || {}
  self.staticResponses = staticResponses
}

StaticProvider.prototype.handleRequest = function(payload, next, end){
  const self = this
  var staticResponse = self.staticResponses[payload.method]
  if (staticResponse !== undefined) {
    end(null, staticResponse)
  } else {
    next()
  }
}
