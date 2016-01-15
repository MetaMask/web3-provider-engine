const inherits = require('util').inherits
const Subprovider = require('./subprovider.js')

module.exports = HookedWalletSubprovider

// handles the following RPC methods:
//   eth_coinbase
//   eth_accounts
//   eth_sendTransaction
//   eth_sign *pending


inherits(HookedWalletSubprovider, Subprovider)

function HookedWalletSubprovider(opts){
  const self = this

  self.getAccounts = opts.getAccounts
  self.sendTransaction = opts.sendTransaction
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
      var txData = payload.params[0]
      self.sendTransaction(function(err, txHash){
        if (err) return end(err)
        end(null, txHash)
      })
      return

    // case 'eth_sign':
    //   var result = self.keystore.getAddresses()
    //   resultObj.result = result
    //   cb(null, resultObj)
    //   return

    default:
      next()
      return

  }
}