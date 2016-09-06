const inherits = require('util').inherits
const Transaction = require('ethereumjs-tx')
const ethUtil = require('ethereumjs-util')
const Subprovider = require('./subprovider.js')
const blockTagForPayload = require('../util/rpc-cache-utils').blockTagForPayload

module.exports = ValidationsSubprovider

// handles the following RPC methods:
// eth_sendTransaction

inherits(ValidationsSubprovider, Subprovider)

function ValidationsSubprovider(opts){
  const self = this
}

ValidationsSubprovider.prototype.handleRequest = function(payload, next, end){
  const self = this

  switch(payload.method) {

    case 'eth_sendTransaction':
      enforceNoNegativeValues(payload)
      next()
      break

    default:
      next()
      return
  }
}

function enforceNoNegativeValues(payload) {

}
