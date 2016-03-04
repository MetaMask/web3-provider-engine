/*
 * Uses ethereumjs-tx to sign a transaction.
 *
 * The two callbacks a user needs to implement are:
 * - getAccounts() -- array of addresses supported
 * - getPrivateKey(address) -- return private key for a given address
 */

const inherits = require('util').inherits
const HookedWalletProvider = require('./hooked-wallet.js')
const EthTx = require('ethereumjs-tx')

module.exports = HookedWalletEthTxSubprovider

inherits(HookedWalletEthTxSubprovider, HookedWalletProvider)

function HookedWalletEthTxSubprovider(opts) {
  // FIXME: moving to ES6 could give us classes properly
  var self = this
  self.getAccounts = opts.getAccounts
  // default to auto-approve
  self.approveTransaction = opts.approveTransaction || function(txParams, cb){ cb(null, true) }
  self.signTransaction = opts.signTransaction

  self.signTransaction = function(txData, cb) {
    if (txData.gas !== undefined)
      txData.gasLimit = txData.gas
    txData.value = txData.value || '0x00'

    opts.getPrivateKey(txData.from, function(err, res) {
      if (err) return cb(err)

      var tx = new EthTx(txData)
      tx.sign(res)
      cb(null, '0x' + tx.serialize().toString('hex'))
    })
  }
}
