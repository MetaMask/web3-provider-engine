const lightwallet = require('lightwallet')
const createPayload = require('../util/create-payload.js')

module.exports = LightWalletSubprovider


function LightWalletSubprovider(opts){
  const self = this

  self.rootProvider = opts.rootProvider

  self.methods = [
    'eth_coinbase',
    'eth_accounts',
    'eth_sendTransaction',
    // 'eth_sign',
  ]

  var secretSeed = lightwallet.keystore.generateRandomSeed()
  // the seed is stored encrypted by a user-defined password
  var password = prompt('Enter password for encryption', 'password')
  self.keystore = new lightwallet.keystore(secretSeed, password)
  self.keystore.passwordProvider = self.unlock.bind(self)

  // generate five new address/private key pairs
  // the corresponding private keys are also encrypted
  self.keystore.generateNewAddress(password, 5)
  var addresses = self.keystore.getAddresses()
  console.log('addresses:', addresses)
}

LightWalletSubprovider.prototype.unlock = function(cb){
  const self = this
  var password = prompt('Please enter password', 'Password')
  cb(null, password)
}

LightWalletSubprovider.prototype.send = function(payload, cb){
  const self = this
  
  var resultObj = {
    id: payload.id,
    jsonrpc: '2.0',
  }

  switch(payload.method) {
    
    case 'eth_coinbase':
      var result = self.keystore.getAddresses()[0] || null
      resultObj.result = result
      return resultObj
    
    case 'eth_accounts':
      var result = self.keystore.getAddresses()
      resultObj.result = result
      return resultObj

    default:
      cb(new Error('RPC Methd '+payload.method+' does not support synch'))
      return

  }
}

LightWalletSubprovider.prototype.sendAsync = function(payload, cb){
  const self = this
  
  var resultObj = {
    id: payload.id,
    jsonrpc: '2.0',
  }

  switch(payload.method) {
    
    case 'eth_sendTransaction':
      var txData = payload.params[0]
      var rlpTx = lighwallet.txutils.createContractTx(txData.from, txData)
      self.unlock(function(err, password){
        var rawTx = self.keystore.signTx(rlpTx.tx, password, txData.from)
        self.rootProvider.sendAsync(createPayload({
          method: 'eth_sendRawTransaction',
          params: [{ data: rawTx }],
        }), function(err){
          if (err) return cb(err)
          console.log('tx submit completed')
          resultObj.result = rawTx
          cb(null, resultObj)
        })
      })
      return
    
    // case 'eth_sign':
    //   var result = self.keystore.getAddresses()
    //   resultObj.result = result
    //   cb(null, resultObj)
    //   return

    default:
      var resultObj = self.send(payload)
      cb(null, resultObj)
      return

  }
}
