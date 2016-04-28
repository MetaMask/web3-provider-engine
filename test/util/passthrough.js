const ScaffoldMiddleware = require('../../subproviders/scaffold.js')

module.exports = Passthrough

//
// handles no methods, skips all requests
// mostly useless
//

function Passthrough(){
  return ScaffoldMiddleware({})
}
