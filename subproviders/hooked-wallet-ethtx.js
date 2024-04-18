/*
 * Uses @ethereumjs/tx to sign a transaction.
 *
 * The two callbacks a user needs to implement are:
 * - getAccounts() -- array of addresses supported
 * - getPrivateKey(address) -- return private key for a given address
 *
 * Optionally approveTransaction(), approveMessage() can be supplied too.
 */

const inherits = require('util').inherits
const HookedWalletProvider = require('./hooked-wallet.js')
const { TransactionFactory } = require('@ethereumjs/tx')
const sigUtil = require('@metamask/eth-sig-util')
const ethUtil = require('ethereumjs-util')

module.exports = HookedWalletEthTxSubprovider

inherits(HookedWalletEthTxSubprovider, HookedWalletProvider)

function HookedWalletEthTxSubprovider(opts) {
  const self = this

  HookedWalletEthTxSubprovider.super_.call(self, opts)

  self.signTransaction = function(txData, cb) {
    // defaults
    if (txData.gas !== undefined) txData.gasLimit = txData.gas
    txData.value = txData.value || '0x00'
    txData.data = ethUtil.addHexPrefix(txData.data)

    opts.getPrivateKey(txData.from, function(err, privateKey) {
      if (err) return cb(err)

      var tx = TransactionFactory.fromTxData(txData)
      tx.sign(privateKey)
      cb(null, '0x' + tx.serialize().toString('hex'))
    })
  }

  self.signMessage = function(msgParams, cb) {
    opts.getPrivateKey(msgParams.from, function(err, privateKey) {
      if (err) return cb(err)
      var dataBuff = Buffer.from(msgParams.data)
      var msgHash = ethUtil.hashPersonalMessage(dataBuff)
      var sig = ethUtil.ecsign(msgHash, privateKey)
      var serialized = ethUtil.bufferToHex(concatSig(sig.v, sig.r, sig.s))
      cb(null, serialized)
    })
  }

  self.signPersonalMessage = function(msgParams, cb) {
    opts.getPrivateKey(msgParams.from, function(err, privateKey) {
      if (err) return cb(err)
      const serialized = sigUtil.personalSign({
        privateKey,
        data: msgParams.data,
      })
      cb(null, serialized)
    })
  }

  self.signTypedMessage = function (msgParams, cb) {
    opts.getPrivateKey(msgParams.from, function(err, privateKey) {
      if (err) return cb(err)
      const serialized = sigUtil.signTypedData({
        privateKey,
        data: msgParams.data,
        version: msgParams.version || 'V1',
      })
      cb(null, serialized)
    })
  }

}

function concatSig(v, r, s) {
  r = ethUtil.fromSigned(r)
  s = ethUtil.fromSigned(s)
  v = ethUtil.bufferToInt(v)
  r = ethUtil.toUnsigned(r).toString('hex').padStart(64, 0)
  s = ethUtil.toUnsigned(s).toString('hex').padStart(64, 0)
  v = ethUtil.stripHexPrefix(ethUtil.intToHex(v))
  return ethUtil.addHexPrefix(r.concat(s, v).toString("hex"))
}
