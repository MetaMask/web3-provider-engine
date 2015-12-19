const async = require('async')
const EventEmitter = require('events').EventEmitter
const inherits = require('util').inherits
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const Stoplight = require('./util/stoplight.js')
const cacheUtils = require('./util/rpc-cache-utils.js')
const POLLING_INTERVAL = 4000

module.exports = Web3ProviderEngine


inherits(Web3ProviderEngine, EventEmitter)

function Web3ProviderEngine(opts) {
  const self = this
  EventEmitter.call(self)
  // set initialization blocker
  self._ready = new Stoplight()
  self.once('block', function(){ self._ready.go() })
  // local state
  self.currentBlock = null
  self._sources = []
  self._blocks = {}
  self._blockCache = {}
  self._permaCache = {}
}

// public

Web3ProviderEngine.prototype.start = function(){
  const self = this
  // start block polling
  self._startPolling()
}

Web3ProviderEngine.prototype.addSource = function(source){
  const self = this
  self._sources.push(source)
}

Web3ProviderEngine.prototype.send = function(payload){
  const self = this
  // console.warn('SYNC REQUEST:', payload)
  return self._handleSync(payload)
}

Web3ProviderEngine.prototype.sendAsync = function(payload, cb){
  const self = this
  self._ready.await(function(){
  
    if (Array.isArray(payload)) {
      // handle batch
      async.map(payload, self._handleAsyncTryCache.bind(self), cb)
    } else {
      // handle single
      self._handleAsyncTryCache(payload, cb)
    }

  })
}

// private

Web3ProviderEngine.prototype._sourceForMethod = function(method){
  const self = this
  return self._sources.find(function(source){
    return source.methods.indexOf(method) !== -1
  })
}

Web3ProviderEngine.prototype._handleSync = function(payload){
  const self = this
  var source = self._sourceForMethod(payload.method)
  if (!source) throw SourceNotFoundError(payload)
  var result = source.handleSync(payload)
  return { 
    id: payload.id,
    jsonrpc: payload.jsonrpc,
    result: result,
  }
}

Web3ProviderEngine.prototype._handleAsyncTryCache = function(payload, cb){
  const self = this
  // parse blockTag
  var blockTag = cacheUtils.blockTagForPayload(payload)
  // rewrite 'latest' blockTags to block number
  if (!blockTag || blockTag === 'latest') blockTag = bufferToHex(self._blocks.latest.number)

  // first try cache
  var blockCache = self._cacheForBlockTag(blockTag)
  var cacheIdentifier = cacheUtils.cacheIdentifierForPayload(payload)
  if (cacheIdentifier) {
    var result = null
    if (cacheUtils.canPermaCache(payload)) {
      result = self._permaCache[cacheIdentifier]
    } else if (blockCache) {
      result = blockCache[cacheIdentifier]
    }
    // if cache had a value, return it
    // note: null is legitimate value (e.g. coinbase thats not set)
    if (result !== undefined) {
      // console.log('CACHE HIT:', blockTag, cacheIdentifier, '->', result)
      var resultObj = {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: result
      }
      return cb(null, resultObj)
    } else {
      // console.log('CACHE MISS:', blockTag, cacheIdentifier)
    }
  }

  // fallback to request
  self._handleAsync(payload, function(err, resultObj){
    if (err) return cb(err)

    // populate cache with result
    if (cacheIdentifier && resultObj.result) {
      if (cacheUtils.canPermaCache(payload)) {
        self._permaCache[cacheIdentifier] = resultObj.result
        // console.log('CACHE POPULATE:', 'PERMA', cacheIdentifier, '->', resultObj.result)
      } else if (blockCache && cacheUtils.canBlockCache(payload)) {
        blockCache[cacheIdentifier] = resultObj.result
        // console.log('CACHE POPULATE:', blockTag, cacheIdentifier, '->', resultObj.result)
      } else {
        // console.warn('CACHE POPULATE MISS:', blockTag, cacheIdentifier)
      }
    } else {
      // console.log('CACHE SKIP:', payload.method, resultObj)
    }
    
    cb(null, resultObj)
  })
}

Web3ProviderEngine.prototype._handleAsync = function(payload, cb){
  const self = this
  var source = self._sourceForMethod(payload.method)
  if (!source) return cb(SourceNotFoundError(payload))
  source.sendAsync(payload, cb)
}

//
// from remote-data
//

Web3ProviderEngine.prototype._startPolling = function(){
  const self = this
  pollForBlock()

  function pollForBlock(){
    fetchLatestBlock(function onBlockFetchResponse(err, block){
      if (block) checkIfUpdated(block)
      setTimeout(pollForBlock, POLLING_INTERVAL)
    })
  }

  function fetchLatestBlock(cb){
    self._fetchBlock('latest', cb)
  }

  function checkIfUpdated(block){
    if (!self._blocks.latest || 0 !== self._blocks.latest.hash.compare(block.hash)) {
      self._setCurrentBlock(block)
    }
  }
}

Web3ProviderEngine.prototype._setCurrentBlock = function(block){
  const self = this
  // self.resetBlockCache()
  var blockNumber = bufferToHex(block.number)
  self._blocks[blockNumber] = block
  self._blocks.latest = block
  // console.log('saving block cache with number:', blockNumber)
  // broadcast new block
  self.currentBlock = block
  self.emit('block', block)
}

Web3ProviderEngine.prototype._cacheForBlockTag = function(blockTag){
  const self = this
  if (!blockTag || blockTag === 'pending') return null
  var cache = self._blockCache[blockTag]
  // create new cache if necesary
  if (!cache) cache = self._blockCache[blockTag] = {}
  return cache
}

Web3ProviderEngine.prototype._fetchBlock = function(number, cb){
  const self = this
  
  // skip: cache, readiness, block number rewrite
  self._handleAsync({
    method: 'eth_getBlockByNumber',
    params: [number, false],
  }, function(err, resultObj){
    if (err) return cb(err)
      var data = resultObj.result
    // json -> buffers
    var block = {
      number: hexToBuffer(data.number),
      hash: hexToBuffer(data.hash),
      parentHash: hexToBuffer(data.parentHash),
      nonce: hexToBuffer(data.nonce),
      sha3Uncles: hexToBuffer(data.sha3Uncles),
      logsBloom: hexToBuffer(data.logsBloom),
      transactionsRoot: hexToBuffer(data.transactionsRoot),
      stateRoot: hexToBuffer(data.stateRoot),
      receiptRoot: hexToBuffer(data.receiptRoot),
      miner: hexToBuffer(data.miner),
      difficulty: hexToBuffer(data.difficulty),
      totalDifficulty: hexToBuffer(data.totalDifficulty),
      size: hexToBuffer(data.size),
      extraData: hexToBuffer(data.extraData),
      gasLimit: hexToBuffer(data.gasLimit),
      gasUsed: hexToBuffer(data.gasUsed),
      timestamp: hexToBuffer(data.timestamp),
      transactions: data.transactions,
    }

    cb(null, block)
  })
}


// util

function SourceNotFoundError(payload){
  return new Error('Source for RPC method "'+payload.method+'" not found.')
}

function hexToBuffer(hexString){
  hexString = ethUtil.stripHexPrefix(hexString)
  if (hexString.length%2) hexString = '0'+hexString
  return new Buffer(hexString, 'hex')
}

function bufferToHex(buffer){
  return ethUtil.addHexPrefix(buffer.toString('hex'))
}

// function materializeTransaction(data){
//   var tx = new Transaction({
//     nonce: data.nonce,
//     gasPrice: data.gasPrice,
//     gasLimit: data.gas,
//     to: data.to,
//     value: data.value,
//     data: data.input,
//   })
//   tx.from = new Buffer(ethUtil.stripHexPrefix(data.from), 'hex')
//   return tx
// }