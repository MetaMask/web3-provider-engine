/*
 * Emulate 'eth_accounts' / 'eth_sendTransaction' using 'eth_sendRawTransaction'
 *
 * The two callbacks a user needs to implement are:
 * - getAccounts() -- array of addresses supported
 * - signTransaction(tx) -- sign a raw transaction object
 */

const async = require('async')
const inherits = require('util').inherits
const ethUtil = require('ethereumjs-util')
const extend = require('xtend')
const Semaphore = require('semaphore')
const Subprovider = require('./subprovider.js')
const estimateGas = require('../util/estimate-gas.js')

module.exports = HookedWalletSubprovider

// handles the following RPC methods:
//   eth_coinbase
//   eth_accounts
//   eth_sendTransaction
//   eth_sign
//   personal_sign
//   personal_recover

//
// Tx Signature Flow
//
// handleRequest: eth_sendTransaction
//   validateTransaction (basic validity check)
//     validateSender (checks that sender is in accounts)
//   processTransaction (sign tx and submit to network)
//     approveTransaction (UI approval hook)
//     checkApproval
//     finalizeAndSubmitTx (tx signing)
//       nonceLock.take (bottle neck to ensure atomic nonce)
//         fillInTxExtras (set fallback gasPrice, nonce, etc)
//         signTransaction (perform the signature)
//         publishTransaction (publish signed tx to network)
//


inherits(HookedWalletSubprovider, Subprovider)

function HookedWalletSubprovider(opts){
  const self = this
  // control flow
  self.nonceLock = Semaphore(1)

  // data lookup
  if (!opts.getAccounts) throw new Error('ProviderEngine - HookedWalletSubprovider - did not provide "getAccounts" fn in constructor options')
  self.getAccounts = opts.getAccounts
  // high level override
  if (opts.processTransaction) self.processTransaction = opts.processTransaction
  if (opts.processMessage) self.processMessage = opts.processMessage
  if (opts.processPersonalMessage) self.processPersonalMessage = opts.processPersonalMessage
  // approval hooks
  self.approveTransaction = opts.approveTransaction || self.autoApprove
  self.approveMessage = opts.approveMessage || self.autoApprove
  self.approvePersonalMessage = opts.approvePersonalMessage || self.autoApprove
  // actually perform the signature
  if (opts.signTransaction) self.signTransaction = opts.signTransaction
  if (opts.signMessage) self.signMessage = opts.signMessage
  if (opts.signPersonalMessage) self.signPersonalMessage = opts.signPersonalMessage
  if (opts.personalRecoverSigner) self.personalRecoverSigner = opts.personalRecoverSigner
  // publish to network
  if (opts.publishTransaction) self.publishTransaction = opts.publishTransaction
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
        (cb) => self.validateTransaction(txParams, cb),
        (cb) => self.processTransaction(txParams, cb),
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
        (cb) => self.validateMessage(msgParams, cb),
        (cb) => self.processMessage(msgParams, cb),
      ], end)
      return

    case 'personal_sign':
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
        (cb) => self.validatePersonalMessage(msgParams, cb),
        (cb) => self.processPersonalMessage(msgParams, cb),
      ], end)
      return

    case 'personal_recover':
      var message = payload.params[0]
      var signature = payload.params[1]
      // non-standard "extraParams" to be appended to our "msgParams" obj
      // good place for metadata
      var extraParams = payload.params[2] || {}
      var msgParams = extend(extraParams, {
        sig: signature,
        data: message,
      })
      self.personalRecoverSigner(msgParams, end)
      return

    default:
      next()
      return

  }
}

//
// "process" high level flow
//

HookedWalletSubprovider.prototype.processTransaction = function(txParams, cb) {
  const self = this
  async.waterfall([
    (cb) => self.approveTransaction(txParams, cb),
    (didApprove, cb) => self.checkApproval('transaction', didApprove, cb),
    (cb) => self.finalizeAndSubmitTx(txParams, cb),
  ], cb)
}

HookedWalletSubprovider.prototype.processMessage = function(msgParams, cb) {
  const self = this
  async.waterfall([
    (cb) => self.approveMessage(msgParams, cb),
    (didApprove, cb) => self.checkApproval('message', didApprove, cb),
    (cb) => self.signMessage(msgParams, cb),
  ], cb)
}

HookedWalletSubprovider.prototype.processPersonalMessage = function(msgParams, cb) {
  const self = this
  async.waterfall([
    (cb) => self.approvePersonalMessage(msgParams, cb),
    (didApprove, cb) => self.checkApproval('message', didApprove, cb),
    (cb) => self.signPersonalMessage(msgParams, cb),
  ], cb)
}

//
// approval
//

HookedWalletSubprovider.prototype.autoApprove = function(txParams, cb) {
  cb(null, true)
}

HookedWalletSubprovider.prototype.checkApproval = function(type, didApprove, cb) {
  cb( didApprove ? null : new Error('User denied '+type+' signature.') )
}

//
// signature and recovery
//

HookedWalletSubprovider.prototype.signTransaction = function(tx, cb) {
  cb(new Error('ProviderEngine - HookedWalletSubprovider - Must provide "signTransaction" fn in constructor options'))
}
HookedWalletSubprovider.prototype.signMessage = function(msgParams, cb) {
  cb(new Error('ProviderEngine - HookedWalletSubprovider - Must provide "signMessage" fn in constructor options'))
}
HookedWalletSubprovider.prototype.signPersonalMessage = function(msgParams, cb) {
  cb(new Error('ProviderEngine - HookedWalletSubprovider - Must provide "signPersonalMessage" fn in constructor options'))
}

HookedWalletSubprovider.prototype.personalRecoverSigner = function(msgParams, cb) {
  let senderHex
  try {
    const message = ethUtil.toBuffer(msgParams.data)
    const msgHash = ethUtil.hashPersonalMessage(message)
    const signature = ethUtil.toBuffer(msgParams.sig)
    const sigParams = ethUtil.fromRpcSig(signature)
    const publicKey = ethUtil.ecrecover(msgHash, sigParams.v, sigParams.r, sigParams.s)
    const sender = ethUtil.publicToAddress(publicKey)
    senderHex = ethUtil.bufferToHex(sender)
  } catch (err) {
    return cb(err)
  }
  cb(null, senderHex)
}

//
// validation
//

HookedWalletSubprovider.prototype.validateTransaction = function(txParams, cb){
  const self = this
  // shortcut: undefined sender is invalid
  if (txParams.from === undefined) return cb(new Error(`Undefined address - from address required to sign transaction.`))
  self.validateSender(txParams.from, function(err, senderIsValid){
    if (err) return cb(err)
    if (!senderIsValid) return cb(new Error(`Unknown address - unable to sign transaction for this address: "${txParams.from}"`))
    cb()
  })
}

HookedWalletSubprovider.prototype.validateMessage = function(msgParams, cb){
  const self = this
  if (msgParams.from === undefined) return cb(new Error(`Undefined address - from address required to sign message.`))
  self.validateSender(msgParams.from, function(err, senderIsValid){
    if (err) return cb(err)
    if (!senderIsValid) return cb(new Error(`Unknown address - unable to sign message for this address: "${msgParams.from}"`))
    cb()
  })
}

HookedWalletSubprovider.prototype.validatePersonalMessage = function(msgParams, cb){
  const self = this
  if (msgParams.from === undefined) return cb(new Error(`Undefined address - from address required to sign personal message.`))
  if (msgParams.data === undefined) return cb(new Error(`Undefined message - message required to sign personal message.`))
  self.validateSender(msgParams.from, function(err, senderIsValid){
    if (err) return cb(err)
    if (!senderIsValid) return cb(new Error(`Unknown address - unable to sign message for this address: "${msgParams.from}"`))
    cb()
  })
}

HookedWalletSubprovider.prototype.validateSender = function(senderAddress, cb){
  const self = this
  // shortcut: undefined sender is invalid
  if (senderAddress === undefined) return cb(null, false)
  self.getAccounts(function(err, accounts){
    if (err) return cb(err)
    var senderIsValid = (accounts.map(toLowerCase).indexOf(senderAddress.toLowerCase()) !== -1)
    cb(null, senderIsValid)
  })
}

//
// tx helpers
//

HookedWalletSubprovider.prototype.finalizeAndSubmitTx = function(txParams, cb) {
  const self = this
  // can only allow one tx to pass through this flow at a time
  // so we can atomically consume a nonce
  self.nonceLock.take(function(){
    async.waterfall([
      self.fillInTxExtras.bind(self, txParams),
      self.signTransaction.bind(self),
      self.publishTransaction.bind(self),
    ], function(err, txHash){
      self.nonceLock.leave()
      if (err) return cb(err)
      cb(null, txHash)
    })
  })
}

HookedWalletSubprovider.prototype.publishTransaction = function(rawTx, cb) {
  const self = this
  self.emitPayload({
    method: 'eth_sendRawTransaction',
    params: [rawTx],
  }, function(err, res){
    if (err) return cb(err)
    cb(null, res.result)
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
    reqs.gas = estimateGas.bind(null, self.engine, cloneTxParams(txParams))
  }

  async.parallel(reqs, function(err, result) {
    if (err) return cb(err)
    // console.log('fillInTxExtras - result:', result)

    var res = {}
    if (result.gasPrice) res.gasPrice = result.gasPrice.result
    if (result.nonce) res.nonce = result.nonce.result
    if (result.gas) res.gas = result.gas

    cb(null, extend(res, txParams))
  })
}

// util

// we use this to clean any custom params from the txParams
function cloneTxParams(txParams){
  return {
    from: txParams.from,
    to: txParams.to,
    value: txParams.value,
    data: txParams.data,
    gas: txParams.gas,
    gasPrice: txParams.gasPrice,
    nonce: txParams.nonce,
  }
}

function toLowerCase(string){
  return string.toLowerCase()
}
