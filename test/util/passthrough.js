const inherits = require('util').inherits
const StaticProvider = require('../../subproviders/static.js')

module.exports = PassthroughProvider

//
// handles no methods, skips all requests
// mostly useless
//

inherits(PassthroughProvider, StaticProvider)
function PassthroughProvider(methods){
  const self = this
  StaticProvider.call(self, {})
}
