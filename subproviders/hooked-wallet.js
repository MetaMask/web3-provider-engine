/*
 * Emulate 'eth_accounts' / 'eth_sendTransaction' using 'eth_sendRawTransaction'
 *
 * The two callbacks a user needs to implement are:
 * - getAccounts() -- array of addresses supported
 * - signTransaction(tx) -- sign a raw transaction object
 */

const async = require('async')
const inherits = require('util').inherits
const extend = require('xtend')
const Subprovider = require('./subprovider.js')
const estimateGas = require('../util/estimate-gas.js')

module.exports = HookedWalletSubprovider

// handles the following RPC methods:
//   eth_coinbase
//   eth_accounts
//   eth_sendTransaction
//   eth_sign


inherits(HookedWalletSubprovider, Subprovider)

function HookedWalletSubprovider(opts){
  const self = this

  // data lookup
  self.getAccounts = opts.getAccounts
  // default to auto-approve
  self.approveTransaction = opts.approveTransaction || function(txParams, cb){ cb(null, true) }
  self.approveMessage = opts.approveMessage || function(txParams, cb){ cb(null, true) }
  // actually perform the signature
  self.signTransaction = opts.signTransaction
  self.signMessage = opts.signMessage
}

HookedWalletSubprovider.prototype.handleRequest = function(payload, next, end){
  const self = this

  switch(payload.method) {

    case 'eth_coinbase':
      self.getAccounts(function(err, accounts){
        if (err) return end(err)
        var result = accounts[0] || null
        end(null, result)
      })
      return

    case 'eth_accounts':
      self.getAccounts(function(err, accounts){
        if (err) return end(err)
        end(null, accounts)
      })
      return

    case 'eth_sendTransaction':
      var txParams = payload.params[0]
      async.waterfall([
        self.validateTransaction.bind(self, txParams),
        self.approveTransaction.bind(self, txParams),
        function checkApproval(didApprove, cb){
          cb( didApprove ? null : new Error('User denied transaction signature.') )
        },
        self.fillInTxExtras.bind(self, txParams),
        self.signTransaction.bind(self),
        self.submitTx.bind(self),
      ], end)
      return

    case 'eth_sign':
      var address = payload.params[0]
      var message = payload.params[1]
      // non-standard "extraParams" to be appended to our "msgParams" obj
      // good place for metadata
      var extraParams = payload.params[2] || {}
      var msgParams = extend(extraParams, {
        from: address,
        data: message,
      })
      async.waterfall([
        self.validateMessage.bind(self, msgParams),
        self.approveMessage.bind(self, msgParams),
        function checkApproval(didApprove, cb){
          cb( didApprove ? null : new Error('User denied message signature.') )
        },
        self.signMessage.bind(self, msgParams),
      ], end)
      return

    default:
      next()
      return

  }
}

HookedWalletSubprovider.prototype.submitTx = function(rawTx, cb) {
  const self = this
  self.emitPayload({
    method: 'eth_sendRawTransaction',
    params: [rawTx],
  }, function(err, result){
    if (err) return cb(err)
    cb(null, result.result)
  })
}

HookedWalletSubprovider.prototype.validateTransaction = function(txParams, cb){
  const self = this
  self.validateSender(txParams.from, function(err, senderIsValid){
    if (err) return cb(err)
    if (!senderIsValid) return cb(new Error('Unknown address - unable to sign transaction for this address.'))
    cb()
  })
}

HookedWalletSubprovider.prototype.validateMessage = function(msgParams, cb){
  const self = this
  self.validateSender(msgParams.from, function(err, senderIsValid){
    if (err) return cb(err)
    if (!senderIsValid) return cb(new Error('Unknown address - unable to sign message for this address.'))
    cb()
  })
}

HookedWalletSubprovider.prototype.validateSender = function(senderAddress, cb){
  const self = this
  self.getAccounts(function(err, accounts){
    if (err) return cb(err)
    var senderIsValid = (accounts.indexOf(senderAddress) !== -1)
    cb(null, senderIsValid)
  })
}

HookedWalletSubprovider.prototype.fillInTxExtras = function(txParams, cb){
  const self = this
  var address = txParams.from
  // console.log('fillInTxExtras - address:', address)

  var reqs = {}

  if (txParams.gasPrice === undefined) {
    // console.log("need to get gasprice")
    reqs.gasPrice = self.emitPayload.bind(self, { method: 'eth_gasPrice', params: [] })
  }

  if (txParams.nonce === undefined) {
    // console.log("need to get nonce")
    reqs.nonce = self.emitPayload.bind(self, { method: 'eth_getTransactionCount', params: [address, 'pending'] })
  }

  if (txParams.gas === undefined) {
    // console.log("need to get gas")
    reqs.gas = estimateGas.bind(null, self.engine, txParams)
  }

  async.parallel(reqs, function(err, result) {
    if (err) return cb(err)
    // console.log('fillInTxExtras - result:', result)

    var res = {}
    if (result.gasPrice) res.gasPrice = result.gasPrice.result
    if (result.nonce) res.nonce = result.nonce.result
    if (result.gas) {
      // add some extra gas, just in case
      // see https://github.com/MetaMask/metamask-plugin/issues/60
      res.gas = Math.ceil(3 * parseInt(result.gas, 16))
    }

    cb(null, extend(res, txParams))
  })
}
