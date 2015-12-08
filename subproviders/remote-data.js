const EventEmitter = require('events').EventEmitter
const inherits = require('util').inherits
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const Stoplight = require('../util/stoplight.js')

module.exports = RemoteDataSource


inherits(RemoteDataSource, EventEmitter)

function RemoteDataSource(){
  const self = this
  EventEmitter.call(self)
  // set initialization blocker
  self._ready = new Stoplight()
  self.once('block', function(){ self._ready.go() })
  // local state
  self._blocks = {}
  self._blockCache = {}
  // start block polling
  self.startPolling()
  self.methods = [
    'eth_hashrate',
    'eth_gasPrice',
    'eth_blockNumber',
    'eth_getBalance',
    'eth_getStorageAt',
    'eth_getTransactionCount',
    'eth_getBlockTransactionCountByHash',
    'eth_getBlockTransactionCountByNumber',
    'eth_getUncleCountByBlockHash',
    'eth_getUncleCountByBlockNumber',
    'eth_getCode',
    // 'eth_sendRawTransaction',
    'eth_getBlockByHash',
    'eth_getBlockByNumber',
    'eth_getTransactionByHash',
    'eth_getTransactionByBlockHashAndIndex',
    'eth_getTransactionByBlockNumberAndIndex',
    'eth_getTransactionReceipt',
    'eth_getUncleByBlockHashAndIndex',
    'eth_getUncleByBlockNumberAndIndex',
    // 'eth_newFilter',
    // 'eth_newBlockFilter',
    // 'eth_newPendingTransactionFilter',
    // 'eth_uninstallFilter',
    // 'eth_getFilterChanges',
    // 'eth_getFilterLogs',
    'eth_getLogs',
  ]
}

RemoteDataSource.prototype.handleAsync = function(payload, cb){
  const self = this
  self._ready.await(function(){

    // parse blockTag
    var blockTag = blockTagForPayload(payload)
    if (blockTag === 'latest') blockTag = formatBlockNumber(self._blocks.latest)

    // check cache
    var blockCache = self._blockCache[blockTag]
    var requestIdentifier = requestIdentifierForPayload(payload)
    if (blockCache) {
      var result = blockCache[requestIdentifier]
      if (result !== undefined) {
        console.log('CACHE HIT:', blockTag, requestIdentifier)
        return cb(null, result)
      }
    }

    // perform request
    console.log('CACHE MISS:', blockTag, requestIdentifier)
    self._handleAsync(payload, function(err, result){
      if (err) return cb(err)
      // populate cache
      if (blockCache) {
        blockCache[requestIdentifier] = result
        console.log('CACHE POPULATE:', blockTag, requestIdentifier, '->', result)
      } else {
        console.log('CACHE POPULATE MISS:', blockTag, requestIdentifier)
      }
      cb(null, result)
    })

  })
}

RemoteDataSource.prototype.fetchBlock = function(number, cb){
  const self = this
  // skip cache
  self._handleAsync({
    method: 'eth_getBlockByNumber',
    params: [number, false],
  }, function(err, data){
    if (err) return cb(err)

    var block = {
      hash: new Buffer(ethUtil.stripHexPrefix(data.hash), 'hex'),
      number: new BN(ethUtil.stripHexPrefix(data.number), 16),
      stateRoot: new Buffer(ethUtil.stripHexPrefix(data.stateRoot), 16),
      transactions: data.transactions,
    }

    cb(null, block)
  })
}

RemoteDataSource.prototype.startPolling = function(){
  const self = this
  pollForBlock()

  function pollForBlock(){
    fetchLatestBlock(function onBlockFetchResponse(err, block){
      if (block) checkIfUpdated(block)
      setTimeout(pollForBlock, 2000)
    })
  }

  function fetchLatestBlock(cb){
    self.fetchBlock('latest', cb)
  }

  function checkIfUpdated(block){
    if (!self._blocks.latest || 0 !== self._blocks.latest.hash.compare(block.hash)) {
      self.setCurrentBlock(block)
    }
  }
}

RemoteDataSource.prototype.setCurrentBlock = function(block){
  const self = this
  // self.resetBlockCache()
  var blockNumber = formatBlockNumber(block)
  self._blocks[blockNumber] = block
  self._blocks.latest = block
  self._blockCache[blockNumber] = {}
  self.emit('block', block)
}

// private


// util

function formatBlockNumber(block){
  // return ethUtil.addHexPrefix(block.number.toString())
  return block.number.toString()
}

function requestIdentifierForPayload(payload){
  var simpleParams = paramsWithoutBlockTag(payload)
  var identifier = payload.method+':'+simpleParams.join(',')
  return identifier
}

function blockTagForPayload(payload){
  switch(payload.method) {
    case 'eth_getBalance':
    case 'eth_getCode':
    case 'eth_getTransactionCount':
    case 'eth_getStorageAt':
    case 'eth_call':
      return payload.params[payload.params.length-1]
    case 'eth_getBlockByNumber':
      return payload.params[0]
    default:
      return null
  }
}

function paramsWithoutBlockTag(payload){
  switch(payload.method) {
    case 'eth_getBalance':
    case 'eth_getCode':
    case 'eth_getTransactionCount':
    case 'eth_getStorageAt':
    case 'eth_call':
      return payload.params.slice(0,-1)
    case 'eth_getBlockByNumber':
      return payload.params.slice(1)
    default:
      return payload.params.slice()
  }
}