'use strict'

import {inherits} from 'util';
import HookedWalletEthTxSubprovider from './hooked-wallet-ethtx.js';

inherits(WalletSubprovider, HookedWalletEthTxSubprovider)

function WalletSubprovider (wallet, opts) {
  opts.getAccounts = function (cb) {
    cb(null, [ wallet.getAddressString() ])
  }

  opts.getPrivateKey = function (address, cb) {
    if (address !== wallet.getAddressString()) {
      return cb('Account not found')
    }

    cb(null, wallet.getPrivateKey())
  }

  WalletSubprovider.super_.call(this, opts)
}

export default WalletSubprovider;
