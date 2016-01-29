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
          // console.log('sending rawTx:', rawTx)
          self.emitPayload({
            method: 'eth_sendRawTransaction',
            params: [rawTx],
          }, function(err, result){
            if (err) return end(err)
            // console.log('signed tx submitted:', result)
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
  const self = this
  var address = txData.from
  // console.log('fillInTxExtras - address:', address)
  self.engine.parallel({
    gasPrice: self.emitPayload.bind(self, { method: 'eth_gasPrice', params: [] }),
    // we actually want the pending txCount
    // but pending is broken in provider-engine
    // https://github.com/MetaMask/provider-engine/issues/11
    // nonce:    self.emitPayload.bind(self, { method: 'eth_getTransactionCount', params: [address, 'pending'] }),
    nonce:    self.emitPayload.bind(self, { method: 'eth_getTransactionCount', params: [address, 'latest'] }),
    // gas:      self.emitPayload.bind(self, { method: 'eth_estimateGas', params: [] }),
  }, function(err, result){
    if (err) return cb(err)
    // console.log('fillInTxExtras - result:', result)
    var fullTxData = extend({
      gasPrice: result.gasPrice.result,
      nonce: result.nonce.result,
      gas: '0x9000',
      // gas: result.nonce.gas,
    }, txData)
    cb(null, fullTxData)
  })
}
