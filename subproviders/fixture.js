const inherits = require('util').inherits
const Subprovider = require('./subprovider.js')

module.exports = FixtureProvider

inherits(FixtureProvider, Subprovider)

function FixtureProvider(staticResponses){
  const self = this
  self.staticResponses = staticResponses || {}
}

FixtureProvider.prototype.handleRequest = function(req, res, next){
  const self = this
  var staticResponse = self.staticResponses[req.method]
  // async function
  if ('function' === typeof staticResponse) {
    staticResponse(req, res, next)
  // static response - null is valid response
  } else if (staticResponse !== undefined) {
    res.result = staticResponse
    next()
  // no prepared response - skip
  } else {
    next()
  }
}
