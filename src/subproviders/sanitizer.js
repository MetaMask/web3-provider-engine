/* Sanitization Subprovider
 * For Parity compatibility
 * removes irregular keys
 */

const { inherits } = require('util')
const extend = require('xtend')
const ethUtil = require('ethereumjs-util')
const Subprovider = require('./subprovider.js')

module.exports = SanitizerSubprovider

inherits(SanitizerSubprovider, Subprovider)

function SanitizerSubprovider (opts) {
  const self = this
}

SanitizerSubprovider.prototype.handleRequest = function (payload, next, end) {
  const txParams = payload.params[0]

  if (typeof txParams === 'object' && !Array.isArray(txParams)) {
    const sanitized = cloneTxParams(txParams)
    payload.params[0] = sanitized
  }

  next()
}

// we use this to clean any custom params from the txParams
const permitted = [
  'from',
  'to',
  'value',
  'data',
  'gas',
  'gasPrice',
  'nonce',
  'fromBlock',
  'toBlock',
  'address',
  'topics',
]

function cloneTxParams (txParams) {
  const sanitized = permitted.reduce(function (copy, permitted) {
    if (permitted in txParams) {
      if (Array.isArray(txParams[permitted])) {
        copy[permitted] = txParams[permitted]
          .map(function (item) {
            return sanitize(item)
          })
      } else {
        copy[permitted] = sanitize(txParams[permitted])
      }
    }
    return copy
  }, {})

  return sanitized
}

function sanitize (value) {
  switch (value) {
    case 'latest':
      return value
    case 'pending':
      return value
    case 'earliest':
      return value
    default:
      if (typeof value === 'string') {
        return ethUtil.addHexPrefix(value.toLowerCase())
      }
      return value

  }
}
