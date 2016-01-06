const KeyStore = require('eth-lightwallet').keystore
const txUtils = require('eth-lightwallet').txutils
const createPayload = require('../util/create-payload.js')
const inherits = require('util').inherits
const Subprovider = require('./subprovider.js')

module.exports = LightWalletSubprovider

inherits(LightWalletSubprovider, Subprovider)

function LightWalletSubprovider(opts){
  const self = this

  self.rootProvider = opts.rootProvider

  self.methods = [
    'eth_coinbase',
    'eth_accounts',
    'eth_sendTransaction',
    // 'eth_sign',
  ]

  var password = 'secret_password_shhhhh'
  var serializedKeystore = localStorage['lightwallet']
  // returning user
  if (serializedKeystore) {
    self.keystore = KeyStore.deserialize(serializedKeystore)
  // first time here
  } else {
    var secretSeed = KeyStore.generateRandomSeed()
    self.keystore = new KeyStore(secretSeed, password)
    self.keystore.generateNewAddress(password, 1)
    self.save()
  }
  self.keystore.passwordProvider = self.unlock.bind(self)

  // debug
  var addresses = self.keystore.getAddresses()
  console.log('addresses:', addresses)
  var privateKeys = addresses.map(function(address){
    return self.keystore.exportPrivateKey(address, password)
  })
  console.log('privateKeys:', privateKeys)
}

LightWalletSubprovider.prototype.save = function(){
  const self = this
  var serializedKeystore = self.keystore.serialize()
  localStorage['lightwallet'] = serializedKeystore
}

LightWalletSubprovider.prototype.unlock = function(cb){
  const self = this
  var password = 'secret_password_shhhhh'
  console.warn('LightWalletSubprovider - unlocking...')
  // var password = prompt('Please enter password', 'Password')
  cb(null, password)
}

LightWalletSubprovider.prototype.handleRequest = function(payload, next, end){
  const self = this

  switch(payload.method) {

    case 'eth_coinbase':
      var result = self.keystore.getAddresses()[0] || null
      if (result) result = appendHexPrefix(result)
      return end(null, result);

    case 'eth_accounts':
      var result = self.keystore.getAddresses().map(appendHexPrefix)
      return end(null, result);

    case 'eth_sendTransaction':
      var txData = payload.params[0]
      var fromAddress = stripHexPrefix(txData.from)

      self.signAndSerializeTx(txData, function(err, rawTx){
        if (err) return cb(err)
        self._submitRawTx(rawTx, function(err, txHash){
          if (err) return cb(err)
          console.log('tx submit completed')
          end(null, txHash);
        })
      })
      return

    // case 'eth_sign':
    //   var result = self.keystore.getAddresses()
    //   resultObj.result = result
    //   cb(null, resultObj)
    //   return

    default:
      next();
      return

  }
}

LightWalletSubprovider.prototype._fetchAccountNonce = function(address, cb){
  const self = this
  self._emitPayload({ method: 'eth_getTransactionCount', params: [address, 'latest'] }, function(err, results){
    if (err) return cb(err)
    cb(null, results.result)
  })
}

LightWalletSubprovider.prototype._submitRawTx = function(rawTx, cb){
  const self = this
  self._emitPayload({ method: 'eth_sendRawTransaction', params: [rawTx] }, function(err, results){
    if (err) return cb(err)
    cb(null, results.result)
  })
}

LightWalletSubprovider.prototype._emitPayload = function(payload, cb){
  const self = this
  // console.log('emit payload!', payload)
  self.rootProvider.sendAsync(createPayload(payload), cb)
  // self.rootProvider.sendAsync(createPayload(payload), function(){
  //   // console.log('payload return!', arguments)
  //   cb.apply(null, arguments)
  // })

}

LightWalletSubprovider.prototype.signAndSerializeTx = function(txData, cb){
  const self = this

  var fromAddress = stripHexPrefix(txData.from)
  // web3 params -> ethereumjs params
  txData.gasLimit = txData.gas
  txData.value = txData.value || '0x00'

  // fill in nonce
  if (txData.nonce === undefined) {
    self._fetchAccountNonce(txData.from, signTx)
  } else {
    signTx(null, txData.nonce)
  }

  function signTx(err, nonce){
    if (err) return cb(err)
    txData.nonce = nonce
    var rlpTx = txUtils.createContractTx(fromAddress, txData)
    self.unlock(function(err, password){
      if (err) return cb(err)

      var rawTx = appendHexPrefix(self.keystore.signTx(rlpTx.tx, password, fromAddress))

      // logging
      // var buf = new Buffer(rawTx, 'hex')
      // var newFormat = buf.toString('binary')
      // console.warn('serializing tx:', txData)
      // console.warn('rlpTx.tx:', rlpTx.tx)
      // console.warn('rawTx:', rawTx)
      // console.warn('newFormat:', newFormat)

      cb(null, rawTx)
    })
  }
}

function appendHexPrefix(hexString){
  return '0x'+hexString
}

function stripHexPrefix(hexString){
  return hexString.slice(2)
}
