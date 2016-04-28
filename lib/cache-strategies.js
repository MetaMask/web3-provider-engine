const ethUtil = require('ethereumjs-util')
const cacheUtils = require('../util/rpc-cache-utils.js')

//
// Cache Strategies - for the CacheMiddleware
//

module.exports = {
  PermaCacheStrategy: PermaCacheStrategy,
  BlockCacheStrategy: BlockCacheStrategy,
}

//
// PermaCacheStrategy
//

function PermaCacheStrategy(conditionals) {
  this.cache = {}
  this.conditionals = conditionals || {}
}

PermaCacheStrategy.prototype.hitCheck = function(payload, requestedBlockNumber, hit, miss) {
  var identifier = cacheUtils.cacheIdentifierForPayload(payload)
  var cached = this.cache[identifier]

  if (!cached) return miss()

  // If the block number we're requesting at is greater than or
  // equal to the block where we cached a previous response,
  // the cache is valid. If it's from earlier than the cache,
  // send it back down to the client (where it will be recached.)
  var cacheIsEarlyEnough = compareHex(requestedBlockNumber, cached.blockNumber) >= 0
  if (cacheIsEarlyEnough) {
    return hit(null, cached.result)
  } else {
    return miss()
  }
}

PermaCacheStrategy.prototype.cacheResult = function(payload, result, requestedBlockNumber, callback) {
  var identifier = cacheUtils.cacheIdentifierForPayload(payload)
  var conditional = this.conditionals[payload.method]

  // dont cache if undefined
  if (result === undefined) return callback()
  // dont cache if theres a conditional and it fails
  if (conditional && !conditional(result)) return callback()

  // insert into cache
  this.cache[identifier] = {
    blockNumber: requestedBlockNumber,
    result: result
  }

  callback()
}

PermaCacheStrategy.prototype.canCache = function(payload) {
  return cacheUtils.canCache(payload)
}


//
// BlockCacheStrategy
//

function BlockCacheStrategy() {
  this.cache = {}
}

BlockCacheStrategy.prototype.getBlockCacheForPayload = function(payload, blockNumber) {
  var blockTag = cacheUtils.blockTagForPayload(payload)
  var blockCache = this.cache[blockNumber]
  // create new cache if necesary
  if (!blockCache) blockCache = this.cache[blockNumber] = {}

  return blockCache
}

BlockCacheStrategy.prototype.hitCheck = function(payload, requestedBlockNumber, hit, miss) {
  var blockCache = this.getBlockCacheForPayload(payload, requestedBlockNumber)

  if (!blockCache) {
    return miss()
  }

  var identifier = cacheUtils.cacheIdentifierForPayload(payload)
  var cached = blockCache[identifier]

  if (cached) {
    return hit(null, cached)
  } else {
    return miss()
  }
}

BlockCacheStrategy.prototype.cacheResult = function(payload, result, requestedBlockNumber, callback) {
  if (result) {
    var blockCache = this.getBlockCacheForPayload(payload, requestedBlockNumber)
    var identifier = cacheUtils.cacheIdentifierForPayload(payload)
    blockCache[identifier] = result
  }
  callback()
}

BlockCacheStrategy.prototype.canCache = function(payload) {
  if (!cacheUtils.canCache(payload)) {
    return false
  }

  var blockTag = cacheUtils.blockTagForPayload(payload)

  return (blockTag !== 'pending')
}

// naively removes older block caches
BlockCacheStrategy.prototype.cacheRollOff = function(currentBlock){
  const self = this
  var currentNumber = ethUtil.bufferToInt(currentBlock.number)
  if (currentNumber > 0) {
    var previousHex = ethUtil.intToHex(currentNumber-1)
    delete self.cache[previousHex]
  }
}


// util

function compareHex(hexA, hexB){
  var numA = parseInt(hexA, 16)
  var numB = parseInt(hexB, 16)
  return numA === numB ? 0 : (numA > numB ? 1 : -1 )
}