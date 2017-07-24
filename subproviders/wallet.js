'use strict'

const inherits = require('util').inherits
const HookedWalletEthTxSubprovider = require('./hooked-wallet-ethtx.js')

module.exports = WalletSubprovider

inherits(WalletSubprovider, HookedWalletEthTxSubprovider)

function WalletSubprovider (wallets, opts) {
  let addresses;
  if (Array.isArray(wallets)) {
    addresses = wallets.map((wallet) => wallet.getAddressString())
  } else {
    addresses = [ wallets.getAddressString() ]
  }
  opts.getAccounts = function (cb) {
    cb(null, addresses)
  }

  opts.getPrivateKey = function (address, cb) {
    let wallet = wallets[addresses.indexOf(address)]
    if (wallet) {
      cb(null, wallet.getPrivateKey())
    } else {
      return cb('Account not found')
    }
  }

  WalletSubprovider.super_.call(this, opts)
}
