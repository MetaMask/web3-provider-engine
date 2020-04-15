/*
 * Uses ethereumjs-tx to sign a transaction.
 *
 * The two callbacks a user needs to implement are:
 * - getAccounts() -- array of addresses supported
 * - getPrivateKey(address) -- return private key for a given address
 *
 * Optionally approveTransaction(), approveMessage() can be supplied too.
 */

const { inherits } = require('util')
const EthTx = require('ethereumjs-tx')
const ethUtil = require('ethereumjs-util')
const sigUtil = require('eth-sig-util')
const HookedWalletProvider = require('./hooked-wallet.js')

module.exports = HookedWalletEthTxSubprovider

inherits(HookedWalletEthTxSubprovider, HookedWalletProvider)

function HookedWalletEthTxSubprovider (opts) {
  const self = this

  HookedWalletEthTxSubprovider.super_.call(self, opts)

  self.signTransaction = function (txData, cb) {
    // defaults
    if (txData.gas !== undefined) {
      txData.gasLimit = txData.gas
    }
    txData.value = txData.value || '0x00'
    txData.data = ethUtil.addHexPrefix(txData.data)

    opts.getPrivateKey(txData.from, function (err, privateKey) {
      if (err) {
        return cb(err)
      }

      const tx = new EthTx(txData)
      tx.sign(privateKey)
      cb(null, `0x${tx.serialize().toString('hex')}`)
    })
  }

  self.signMessage = function (msgParams, cb) {
    opts.getPrivateKey(msgParams.from, function (err, privateKey) {
      if (err) {
        return cb(err)
      }
      const dataBuff = ethUtil.toBuffer(msgParams.data)
      const msgHash = ethUtil.hashPersonalMessage(dataBuff)
      const sig = ethUtil.ecsign(msgHash, privateKey)
      const serialized = ethUtil.bufferToHex(concatSig(sig.v, sig.r, sig.s))
      cb(null, serialized)
    })
  }

  self.signPersonalMessage = function (msgParams, cb) {
    opts.getPrivateKey(msgParams.from, function (err, privateKey) {
      if (err) {
        return cb(err)
      }
      const serialized = sigUtil.personalSign(privateKey, msgParams)
      cb(null, serialized)
    })
  }

  self.signTypedMessage = function (msgParams, cb) {
    opts.getPrivateKey(msgParams.from, function (err, privateKey) {
      if (err) {
        return cb(err)
      }
      const serialized = sigUtil.signTypedData(privateKey, msgParams)
      cb(null, serialized)
    })
  }

}

function concatSig (v, r, s) {
  r = ethUtil.fromSigned(r)
  s = ethUtil.fromSigned(s)
  v = ethUtil.bufferToInt(v)
  r = ethUtil.toUnsigned(r).toString('hex').padStart(64, 0)
  s = ethUtil.toUnsigned(s).toString('hex').padStart(64, 0)
  v = ethUtil.stripHexPrefix(ethUtil.intToHex(v))
  return ethUtil.addHexPrefix(r.concat(s, v).toString('hex'))
}
