const VM = require('ethereumjs-vm')
const async = require('async')
const inherits = require('util').inherits
const FakeMerklePatriciaTree = require('fake-merkle-patricia-tree')
const ethUtil = require('ethereumjs-util')
const createPayload = require('../util/create-payload.js')


module.exports = VmSubprovider


function VmSubprovider(opts){
  const self = this
  self.rootProvider = opts.rootProvider
  self.currentBlock = 'latest'
  var vm = self.vm = new VM()

  // intercept state lookups
  vm.stateManager._lookupStorageTrie = self._createAccountStorageTrie.bind(self)
  vm.stateManager.cache._lookupAccount = self._fetchAccount.bind(self)
}

VmSubprovider.prototype._createAccountStorageTrie = function(address, cb){
  const self = this
  var block = self.currentBlock
  var storageTrie = new LazyStorageTrie({
    fetchStorage: fetchStorage,
  })
  cb(null, storageTrie)

  function fetchStorage(key, cb){
    self._fetchAccountStorage(address, key, block, cb)
  }
}

VmSubprovider.prototype._emitPayload = function(payload, cb){
  const self = this
  // console.log('emit payload!', payload)
  self.rootProvider.sendAsync(createPayload(payload), cb)
  // self.rootProvider.sendAsync(createPayload(payload), function(){
  //   // console.log('payload return!', arguments)
  //   cb.apply(null, arguments)
  // })

}

VmSubprovider.prototype._fetchAccount = function(address, cb){
  const self = this
  var block = self.currentBlock
  console.log('fetch account:', address)
  async.parallel({
    nonce: self._fetchAccountNonce.bind(self, address, block),
    balance: self._fetchAccountBalance.bind(self, address, block),
    _code: self._fetchAccountCode.bind(self, address, block),
  }, function(err, results){
    if (err) return cb(err)

    results._exists = results.nonce !== '0x0' || results.balance != '0x0' || results._code != '0x'
    // console.log('fetch account results:', results)
    var account = new LazyAccount(results)

    cb(null, account)
  })

}

VmSubprovider.prototype._fetchAccountStorage = function(address, key, block, cb){
  const self = this
  self._emitPayload({ method: 'eth_getStorageAt', params: [address, key, block] }, function(err, results){
    if (err) return cb(err)
    cb(null, results.result)
  })
}

VmSubprovider.prototype._fetchAccountBalance = function(address, block, cb){
  const self = this
  self._emitPayload({ method: 'eth_getBalance', params: [address, block] }, function(err, results){
    if (err) return cb(err)
    cb(null, results.result)
  })
}

VmSubprovider.prototype._fetchAccountNonce = function(address, block, cb){
  const self = this
  self._emitPayload({ method: 'eth_getTransactionCount', params: [address, block] }, function(err, results){
    if (err) return cb(err)
    cb(null, results.result)
  })
}

VmSubprovider.prototype._fetchAccountCode = function(address, block, cb){
  const self = this
  self._emitPayload({ method: 'eth_getCode', params: [address, block] }, function(err, results){
    if (err) return cb(err)
    cb(null, results.result)
  })
}

//

function LazyAccount(opts) {
  const self = this
  self._code = opts._code
  self.exists = opts._exists
  self.balance = opts.balance
  self.stateRoot = '0x00'
}

LazyAccount.prototype.serialize = function(){
  return new Buffer('')
}

LazyAccount.prototype.setCode = function(_, value, cb){
  const self = this
  self._code = value
  cb()
}

LazyAccount.prototype.getCode = function(_, cb){
  const self = this
  cb(null, self._code)
}

//

inherits(LazyStorageTrie, FakeMerklePatriciaTree)

function LazyStorageTrie(opts) {
  const self = this
  FakeMerklePatriciaTree.call(self)
  self._fetchStorage = opts.fetchStorage
}

LazyStorageTrie.prototype.get = function(key, cb){
  const self = this
  var _super = FakeMerklePatriciaTree.prototype.get.bind(self)
  
  _super(key, function(err, value){
    if (err) return cb(err)
    if (value) return cb(null, value)
    // if value not in tree, try network
    var keyHex = key.toString('hex')  
    self._fetchStorage(keyHex, function(err, rawValue){
      if (err) return cb(err)
      var value = new Buffer(ethUtil.stripHexPrefix(rawValue), 'hex')
      cb(null, value)
    })
  })
}