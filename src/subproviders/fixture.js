const { inherits } = require('util')
const Subprovider = require('./subprovider.js')

module.exports = FixtureProvider

inherits(FixtureProvider, Subprovider)

function FixtureProvider (staticResponses) {
  const self = this
  staticResponses = staticResponses || {}
  self.staticResponses = staticResponses
}

FixtureProvider.prototype.handleRequest = function (payload, next, end) {
  const self = this
  const staticResponse = self.staticResponses[payload.method]
  // async function
  if (typeof staticResponse === 'function') {
    staticResponse(payload, next, end)
  // static response - null is valid response
  } else if (staticResponse !== undefined) {
    // return result asynchronously
    setTimeout(() => end(null, staticResponse))
  // no prepared response - skip
  } else {
    next()
  }
}
