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

module.exports = HookedWalletSubprovider

// handles the following RPC methods:
//   eth_coinbase
//   eth_accounts
//   eth_sendTransaction
//   * eth_sign (TODO)


inherits(HookedWalletSubprovider, Subprovider)

function HookedWalletSubprovider(opts){
  const self = this

  self.getAccounts = opts.getAccounts
  // default to auto-approve
  self.approveTransaction = opts.approveTransaction || function(txParams, cb){ cb(null, true) }
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
      var txParams = payload.params[0]
      // approve
      self.approveTransaction(txParams, function(err, didApprove){
        if (err) return end(err)
        if (!didApprove) return end(new Error('User denied transaction.'))
        // autofill
        self.fillInTxExtras(txParams, function(err, fullTxParams){
          if (err) return end(err)
          // sign
          self.signTransaction(fullTxParams, function(err, rawTx){
            if (err) return end(err)
            // submit
            self.submitTx(rawTx, end)
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
    reqs.gas = self.emitPayload.bind(self, { method: 'eth_estimateGas', params: [ txParams, 'pending'] })
  }

  async.parallel(reqs, function(err, result) {
    if (err) return cb(err)
    // console.log('fillInTxExtras - result:', result)

    var res = { }
    if (result.gasPrice)
      res.gasPrice = result.gasPrice.result
    if (result.nonce)
      res.nonce = result.nonce.result
    if (result.gas)
      res.gas = result.gas.result

    cb(null, extend(res, txParams))
  })
}
