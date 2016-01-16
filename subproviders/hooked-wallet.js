const async = require('async')
const inherits = require('util').inherits
const extend = require('xtend')
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
  self.signTransaction = opts.signTransaction
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
      self.fillInTxExtras(txData, function(err, fullTxData){
        if (err) return end(err)
        self.signTransaction(fullTxData, function(err, rawTx){
          if (err) return end(err)
          self.emitPayload({
            method: 'eth_sendRawTransaction',
            params: [{
              data: rawTx,
            }]
          }, function(err, result){
            if (err) return end(err)
            end(null, result.result)
          })
        })
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

HookedWalletSubprovider.prototype.fillInTxExtras = function(txData, cb){
  var address = txData.from
  async.parallel({
    gasPrice: self.emitPayload.bind(self, { method: 'eth_gasPrice', params: [] }),
    nonce:    self.emitPayload.bind(self, { method: 'eth_getTransactionCount', params: [address, 'pending'] }),
    // gas:      self.emitPayload.bind(self, { method: 'eth_estimateGas', params: [] }),
  }, function(err, result){
    if (err) return cb(err)
    var fullTxData = extend({
      gasPrice: result.gasPrice.result,
      nonce: result.nonce.result,
      gas: '0x2328',
      // gas: result.nonce.gas,
    }, txData)
    cb(null, fullTxData)
  })
}