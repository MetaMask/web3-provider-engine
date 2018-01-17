import {inherits} from 'util';
import Subprovider from './subprovider.js';

inherits(FixtureProvider, Subprovider)

function FixtureProvider(staticResponses){
  const self = this
  staticResponses = staticResponses || {}
  self.staticResponses = staticResponses
}

FixtureProvider.prototype.handleRequest = function(payload, next, end){
  const self = this
  var staticResponse = self.staticResponses[payload.method]
  // async function
  if ('function' === typeof staticResponse) {
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

export default FixtureProvider;
