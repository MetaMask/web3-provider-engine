const inherits = require('util').inherits
const async = require('async')
const VM = require('ethereumjs-vm')
const Block = require('ethereumjs-block')
const Account = require('ethereumjs-account')
const Transaction = require('ethereumjs-tx')
const FakeMerklePatriciaTree = require('fake-merkle-patricia-tree')
const ethUtil = require('ethereumjs-util')
const createPayload = require('../util/create-payload.js')
const Stoplight = require('../util/stoplight.js')

module.exports = VmSubprovider


function VmSubprovider(opts){
  const self = this
  self.methods = ['eth_call', 'eth_estimateGas']
  self.rootProvider = opts.rootProvider
  self.currentBlock = 'latest'
  self._ready = new Stoplight()
  // hack - pending moving currentBlock to engine
  // self.rootProvider.once('block', function(){ self._ready.go() })
  self.rootProvider._sources[0].once('block', setTimeout.bind(null, function(){ self._ready.go() }))
}

VmSubprovider.prototype.handleAsync = function(payload, cb){
  const self = this
  self.runVm(payload, function(err, results){
    if (err) return cb(err)

    switch (payload.method) {
      
      case 'eth_call':
        var returnValue = null
        if (results.vm.returnValue) {
          returnValue = ethUtil.addHexPrefix(results.vm.returnValue.toString('hex'))
        }
        return cb(null, returnValue)
      
      case 'eth_estimateGas':
        console.log(results)
        var returnValue = ethUtil.addHexPrefix(results.gasUsed.toString('hex'))
        return cb(null, returnValue)

    }
  })
}

VmSubprovider.prototype.runVm = function(payload, cb){
  const self = this
  self._ready.await(function(){
    // lock processing - one vm at a time
    self._ready.stop()
    
    var blockData = self.rootProvider.currentBlock
    var block = blockFromBlockData(blockData)
    var blockNumber = ethUtil.addHexPrefix(blockData.number.toString('hex'))

    // create vm with state lookup intercepted
    var vm = self.vm = new VM()
    vm.stateManager._lookupStorageTrie = self._createAccountStorageTrie.bind(self, blockNumber)
    vm.stateManager.cache._lookupAccount = self._fetchAccount.bind(self, blockNumber)
    var codeStore = new FallbackAsyncStore(function(address, cb){ self._fetchAccountCode(address, blockNumber, cb) })
    vm.stateManager.getContractCode = codeStore.get.bind(codeStore)
    vm.stateManager.setContractCode = codeStore.set.bind(codeStore)
    // create tx
    var txParams = payload.params[0]
    // console.log('params:', payload.params)
    var tx = new Transaction({
      to: txParams.to,
      from: txParams.from,
      value: txParams.value,
      data: txParams.data,
      gasLimit: txParams.gas || block.gasLimit,//'0xffffffffffffffff',
      gasPrice: txParams.gasPrice,
    })
    tx.from = new Buffer(ethUtil.stripHexPrefix(txParams.from), 'hex')

    // console.log('block:', block)

    vm.runTx({
      tx: tx,
      block: block,
      // skipNonce: true,
    }, function(err, results) {
      // unlock vm
      self._ready.go()

      if (err) return cb(err)
      cb(null, results)
    });

  })
}

VmSubprovider.prototype._createAccountStorageTrie = function(blockNumber, address, cb){
  const self = this
  var storageTrie = new FallbackStorageTrie({
    fetchStorage: fetchStorage,
  })
  cb(null, storageTrie)

  function fetchStorage(key, cb){
    self._fetchAccountStorage(address, key, blockNumber, cb)
  }
}

VmSubprovider.prototype._fetchAccount = function(blockNumber, address, cb){
  const self = this
  var addressHex = ethUtil.addHexPrefix(address.toString('hex'))
  async.parallel({
    nonce: self._fetchAccountNonce.bind(self, addressHex, blockNumber),
    balance: self._fetchAccountBalance.bind(self, addressHex, blockNumber),
  }, function(err, results){
    if (err) return cb(err)

    results._exists = results.nonce !== '0x0' || results.balance != '0x0' || results._code != '0x'
    // console.log('fetch account results:', results)
    var account = new Account(results)

    cb(null, account)
  })

}

VmSubprovider.prototype._fetchAccountStorage = function(address, key, blockNumber, cb){
  const self = this
  self._emitPayload({ method: 'eth_getStorageAt', params: [address, key, blockNumber] }, function(err, results){
    if (err) return cb(err)
    cb(null, results.result)
  })
}

VmSubprovider.prototype._fetchAccountBalance = function(address, blockNumber, cb){
  const self = this
  self._emitPayload({ method: 'eth_getBalance', params: [address, blockNumber] }, function(err, results){
    if (err) return cb(err)
    cb(null, results.result)
  })
}

VmSubprovider.prototype._fetchAccountNonce = function(address, blockNumber, cb){
  const self = this
  self._emitPayload({ method: 'eth_getTransactionCount', params: [address, blockNumber] }, function(err, results){
    if (err) return cb(err)
    cb(null, results.result)
  })
}

VmSubprovider.prototype._fetchAccountCode = function(address, blockNumber, cb){
  const self = this
  self._emitPayload({ method: 'eth_getCode', params: [address, blockNumber] }, function(err, results){
    if (err) return cb(err)
    cb(null, results.result)
  })
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


//
// FallbackStorageTrie
//
// is a FakeMerklePatriciaTree that will let lookups
// fallback to the network. writes shadow the network.
// doesn't bother with a stateRoot
//

inherits(FallbackStorageTrie, FakeMerklePatriciaTree)

function FallbackStorageTrie(opts) {
  const self = this
  FakeMerklePatriciaTree.call(self)
  self._fetchStorage = opts.fetchStorage
}

FallbackStorageTrie.prototype.get = function(key, cb){
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

//
// FallbackAsyncStore
//
// is an async key-value store that will let lookups
// fallback to the network. puts are not sent.
//

function FallbackAsyncStore(fetchValue){
  const self = this
  self.fetch = fetchValue
  self.cache = {}
}

FallbackAsyncStore.prototype.get = function(address, cb){
  const self = this
  var code = self.cache[address]
  if (code !== undefined) {
    cb(null, code)
  } else {
    self.fetch(address, function(err, value){
      if (err) return cb(err)
      self.cache[address] = value
      cb(null, value)
    })
  }
}

FallbackAsyncStore.prototype.set = function(address, code, cb){
  const self = this
  self.cache[address] = code
  cb()
}

// util

function blockFromBlockData(blockData){
  var block = new Block()
  // block.header.hash = ethUtil.addHexPrefix(blockData.hash.toString('hex'))
  block.header.parentHash = blockData.parentHash
  block.header.uncleHash = blockData.sha3Uncles
  block.header.coinbase = blockData.miner
  block.header.stateRoot = blockData.stateRoot
  block.header.transactionTrie = blockData.transactionsRoot
  block.header.receiptTrie = blockData.receiptRoot
  block.header.bloom = blockData.logsBloom
  block.header.difficulty = blockData.difficulty
  block.header.number = blockData.number
  block.header.gasLimit = blockData.gasLimit
  block.header.gasUsed = blockData.gasUsed
  block.header.timestamp = blockData.timestamp
  block.header.extraData = blockData.extraData
  return block
}