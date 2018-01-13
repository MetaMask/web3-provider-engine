/* Sanitization Subprovider
 * For Parity compatibility
 * removes irregular keys
 */

import {inherits} from 'util';
import Subprovider from './subprovider.js';
import extend from 'xtend';
import ethUtil from 'ethereumjs-util';

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
  'nonce',
  'fromBlock',
  'toBlock',
  'address',
  'topics',
]

function cloneTxParams(txParams){
  var sanitized  =  permitted.reduce(function(copy, permitted) {
    if (permitted in txParams) {
      if (Array.isArray(txParams[permitted])) {
        copy[permitted] = txParams[permitted]
        .map(function(item) {
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

function sanitize(value) {
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
      } else {
        return value
      }
  }
}

export default SanitizerSubprovider;
