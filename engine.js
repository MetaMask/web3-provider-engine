const async = require('async')
const EventEmitter = require('events').EventEmitter
const inherits = require('util').inherits
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const Stoplight = require('./util/stoplight.js')

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
  return self._handleSync(payload)
}

Web3ProviderEngine.prototype.sendAsync = function(payload, cb){
  const self = this
  self._ready.await(function(){
  
    if (Array.isArray(payload)) {
      // handle batch
      async.each(payload, self._handleAsyncTryCache.bind(self), cb)
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
  var blockTag = blockTagForPayload(payload)
  // rewrite 'latest' blockTags to block number
  if (blockTag === 'latest') blockTag = bufferToHex(self._blocks.latest.number)

  // first try cache
  var blockCache = self._cacheForBlockTag(blockTag)
  var requestIdentifier = getCacheIdentifierForPayload(payload)
  if (requestIdentifier && blockCache) {
    var result = blockCache[requestIdentifier]
    if (result !== undefined) {
      console.log('CACHE HIT:', blockTag, requestIdentifier, '->', result)
      return cb(null, result)
    }
  }

  // fallback to request
  console.log('CACHE MISS:', blockTag, requestIdentifier)
  self._handleAsync(payload, function(err, resultObj){

    if (err) return cb(err)

    // rpc result object - fill in request metadata
    // var resultObj = {
    //   id: payload.id,
    //   jsonrpc: payload.jsonrpc,
    // }

    // // handle error
    // // javascript error obj
    // if (err) {
    //   throw err
    //   resultObj.error = {
    //     code: -32000,
    //     message: err.message,
    //     stack: err.stack,
    //   }
    //   return cb(null, resultObj)
    
    // // json rpc error obj
    // } else if (result.error) {
    
    //   console.error('JSON RPC ERROR?')
    //   console.error(result.error)
    //   throw new Error(result.error)

    //   resultObj.error = result.error
    //   return cb(null, resultObj)

    // }

    // populate cache with result
    if (blockCache && resultObj.result) {
      blockCache[requestIdentifier] = resultObj.result
      console.log('CACHE POPULATE:', blockTag, requestIdentifier, '->', resultObj.result)
    } else {
      console.log('CACHE POPULATE MISS:', blockTag, requestIdentifier)
      console.log(self._blockCache)
    }
    
    // // return result
    // resultObj.result = result
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
      setTimeout(pollForBlock, 2000)
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
  console.log('saving block cache with number:', blockNumber)
  // broadcast new block
  self.currentBlock = block
  self.emit('block', block)
}

Web3ProviderEngine.prototype._cacheForBlockTag = function(blockTag){
  const self = this
  if (blockTag === 'pending') return null
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

function getCacheIdentifierForPayload(payload){
  var simpleParams = paramsWithoutBlockTag(payload)
  switch(payload.method) {
    // dont cache
    case 'eth_coinbase':
    case 'eth_accounts':
    case 'eth_sendTransaction':
    case 'eth_sign':
      return null
    // cache based on all params
    default:
      return payload.method+':'+JSON.stringify(simpleParams)
  }
}

function blockTagForPayload(payload){
  switch(payload.method) {
    // blockTag is last param
    case 'eth_getBalance':
    case 'eth_getCode':
    case 'eth_getTransactionCount':
    case 'eth_getStorageAt':
    case 'eth_call':
    case 'eth_estimateGas':
      return payload.params[payload.params.length-1]
    // blockTag is first param
    case 'eth_getBlockByNumber':
      return payload.params[0]
    // there is no blockTag
    default:
      return null
  }
}

function paramsWithoutBlockTag(payload){
  switch(payload.method) {
    // blockTag is last param
    case 'eth_getBalance':
    case 'eth_getCode':
    case 'eth_getTransactionCount':
    case 'eth_getStorageAt':
    case 'eth_call':
    case 'eth_estimateGas':
      return payload.params.slice(0,-1)
    // blockTag is first param
    case 'eth_getBlockByNumber':
      return payload.params.slice(1)
    // there is no blockTag
    default:
      return payload.params.slice()
  }
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