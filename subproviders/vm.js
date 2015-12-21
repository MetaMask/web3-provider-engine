const inherits = require('util').inherits
const async = require('async')
const VM = require('ethereumjs-vm')
const Block = require('ethereumjs-block')
const Account = require('ethereumjs-account')
const Transaction = require('ethereumjs-tx')
const FakeMerklePatriciaTree = require('fake-merkle-patricia-tree')
const ethUtil = require('ethereumjs-util')
const createPayload = require('../util/create-payload.js')
const Semaphore = require('semaphore')

module.exports = VmSubprovider


function VmSubprovider(opts){
  const self = this
  self.methods = ['eth_call', 'eth_estimateGas']
  self.rootProvider = opts.rootProvider
  self.currentBlock = 'latest'
  // readiness lock, used to keep vm calls down to 1 at a time
  self.lock = Semaphore(1)
}

VmSubprovider.prototype.sendAsync = function(payload, cb){
  const self = this
  console.log('VmSubprovider - runVm init', arguments)
  self.runVm(payload, function(err, results){
    console.log('VmSubprovider - runVm return', arguments)
    if (err) return cb(err)

    var resultObj = {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
    }

    switch (payload.method) {
      
      case 'eth_call':
        var returnValue = '0x'
        if (results.error) {
          returnValue = '0x'
        } else if (results.vm.return) {
          returnValue = ethUtil.addHexPrefix(results.vm.return.toString('hex'))
        }
        resultObj.result = returnValue
        return cb(null, resultObj)
      
      case 'eth_estimateGas':
        // i considered transforming request to eth_call
        // to reduce the cache area, but we'd need to store
        // metadata somewhere or something, instead of just
        // the simple return value

        // self.rootProvider.sendAsync(createPayload({
        //   method: 'eth_call',
        //   params: payload.params,
        // }), function(err, results){
        //   // if (err) return cb(err)
        //   console.log('gas -> call results:', results)
        // })

        var returnValue = ethUtil.addHexPrefix(results.gasUsed.toString('hex'))
        resultObj.result = returnValue
        return cb(null, resultObj)

    }
  })
}

VmSubprovider.prototype.runVm = function(payload, cb){
  const self = this
  // lock processing - one vm at a time
  self.lock.take(function(){
    
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
      gasLimit: txParams.gas || block.header.gasLimit,
      gasPrice: txParams.gasPrice,
      nonce: txParams.nonce,
    })
    tx.from = ethUtil.toBuffer(txParams.from)

    // vm.on('step', function(data, cb){
    //   var name = data.opcode
    //   console.warn('op coooodes:', name, data)
    //   // debugger
    //   cb()
    // })

    vm.runTx({
      tx: tx,
      block: block,
      skipNonce: !txParams.nonce,
    }, function(err, results) {
      // unlock vm
      self.lock.leave()

      if (err) {
        debugger
        if (isNormalVmError(err.message)) {
          return cb(null, { error: err })
        } else {
          return cb(err)
        }
      }

      cb(null, results)
    });

  })
}

VmSubprovider.prototype._createAccountStorageTrie = function(blockNumber, address, cb){
  const self = this
  var addressHex = ethUtil.addHexPrefix(address.toString('hex'))
  var storageTrie = new FallbackStorageTrie({
    fetchStorage: fetchStorage,
  })
  cb(null, storageTrie)

  function fetchStorage(key, cb){
    self._fetchAccountStorage(addressHex, key, blockNumber, cb)
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
    // needs to be anything but the default (ethUtil.SHA3_NULL)
    account.codeHash = new Buffer('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
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
      var value = ethUtil.toBuffer(rawValue)
      var encodedValue = ethUtil.rlp.encode(value)
      cb(null, encodedValue)
    })
  })
}

//
// FallbackAsyncStore
//
// is an async key-value store that will let lookups
// fallback to the network. puts are not sent.
//

function FallbackAsyncStore(fetchFn){
  console.log('FallbackAsyncStore - new')
  const self = this
  self.fetch = fetchFn
  self.cache = {}
}

FallbackAsyncStore.prototype.get = function(address, cb){
  console.log('FallbackAsyncStore - get', arguments)
  const self = this
  var addressHex = '0x'+address.toString('hex')
  var code = self.cache[addressHex]
  if (code !== undefined) {
    cb(null, code)
  } else {
    console.log('FallbackAsyncStore - fetch init')
    self.fetch(addressHex, function(err, value){
      console.log('FallbackAsyncStore - fetch return', arguments)
      if (err) return cb(err)
      self.cache[addressHex] = value
      cb(null, ethUtil.toBuffer(value))
    })
  }
}

FallbackAsyncStore.prototype.set = function(address, code, cb){
  console.log('FallbackAsyncStore - set', arguments)
  const self = this
  var addressHex = '0x'+address.toString('hex')
  self.cache[addressHex] = code
  cb()
}

// util
const NOT_ENOUGH_FUNDS = 'sender doesn\'t have enough funds to send tx.'
const WRONG_NONCE = 'the tx doesn\'t have the correct nonce. account has nonce of:'
const VM_INTERNAL_ERRORS = [NOT_ENOUGH_FUNDS, WRONG_NONCE]
function isNormalVmError(message){
  var matchedErrors = VM_INTERNAL_ERRORS.filter(function(errorPattern){
    var submessage = message.slice(0,errorPattern.length)
    return submessage === errorPattern
  })
  return matchedErrors.length === 1
}

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