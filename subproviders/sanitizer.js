/* Sanitization Subprovider
 * For Parity compatibility
 * removes irregular keys
 */

const inherits = require('util').inherits
const Subprovider = require('./subprovider.js')
const extend = require('xtend')

module.exports = SanitizerSubprovider

inherits(SanitizerSubprovider, Subprovider)

function SanitizerSubprovider(opts){
  const self = this
}

SanitizerSubprovider.prototype.handleRequest = function(payload, next, end){
  var txParams = payload.params[0]

  if (typeof txParams === 'object' && !Array.isArray(txParams)) {
    var sanitized = cloneTxParams(txParams)
    payload.params[0] = sanitized
  }

  next()
}

// we use this to clean any custom params from the txParams
var permitted = [
  'from',
  'to',
  'value',
  'data',
  'gas',
  'gasPrice',
  'nonce'
]
function cloneTxParams(txParams){
  var sanitized  =  permitted.reduce(function(copy, permitted) {
    if (permitted in txParams) {
      copy[permitted] = txParams[permitted]
    }
    return copy
  }, {})

  return sanitized
}
