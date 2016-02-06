const inherits = require('util').inherits
const ethUtil = require('ethereumjs-util')
const cacheUtils = require('../util/rpc-cache-utils.js')
const Stoplight = require('../util/stoplight.js')
const Subprovider = require('./subprovider.js')

module.exports = BlockCacheProvider

inherits(BlockCacheProvider, Subprovider)

function BlockCacheProvider(opts) {
  const self = this
  opts = opts || {}
  // set initialization blocker
  self._ready = new Stoplight()
  self.strategies = {
    perma: new ConditionalPermaCacheStrategy({
      eth_getTransactionByHash: function(result) {
        return Boolean(result && result.blockHash)
      },
    }),
    block: new BlockCacheStrategy(self),
    fork: new BlockCacheStrategy(self),
  }
}

// setup a block listener on 'setEngine'
BlockCacheProvider.prototype.setEngine = function(engine) {
  const self = this
  Subprovider.prototype.setEngine.call(self, engine)
  // unblock initialization after first block
  engine.once('block', function(block) {
    self._ready.go()
  })
  // empty old cache
  engine.on('block', function(block) {
    self.strategies.block.cacheRollOff(block)
    self.strategies.fork.cacheRollOff(block)
  })
}

BlockCacheProvider.prototype.handleRequest = function(payload, next, end){
  const self = this

  // skip cache if told to do so
  if (payload.cache === false) {
    // console.log('CACHE SKIP - skip cache if told to do so')
    return next()
  }

  // Ignore block polling requests.
  if (payload.method === 'eth_getBlockByNumber' && payload.params[0] === 'latest') {
    // console.log('CACHE SKIP - Ignore block polling requests.')
    return next()
  }

  // wait for first block
  self._ready.await(function(){
    // actually handle the request
    self._handleRequest(payload, next, end)
  })
}

BlockCacheProvider.prototype._handleRequest = function(payload, next, end){
  const self = this

  var type = cacheUtils.cacheTypeForPayload(payload)
  var strategy = this.strategies[type]

  // If there's no strategy in place, pass it down the chain.
  if (!strategy) {
    return next()
  }

  // If the strategy can't cache this request, ignore it.
  if (!strategy.canCache(payload)) {
    return next()
  }

  var blockTag = cacheUtils.blockTagForPayload(payload)
  var requestedBlockNumber = bufferToBN(this.currentBlock.number)

  if (blockTag) {
    if (blockTag === 'earliest') {
      requestedBlockNumber = new ethUtil.BN('0', 'hex')
    } else if (blockTag === 'latest') {
      // already set to latest
    } else {
      // We have a hex number
      requestedBlockNumber = new ethUtil.BN(blockTag, 'hex')
    }
  }

  //console.log('REQUEST at block 0x' + requestedBlockNumber.toString('hex'))

  // end on a hit, continue on a miss
  strategy.hitCheck(payload, requestedBlockNumber, end, function() {
    // miss fallthrough to provider chain, caching the result on the way back up.
    next(function(err, result, cb) {
      // err is already handled by engine
      if (err) return cb()
      strategy.cacheResult(payload, result, requestedBlockNumber, cb)
    })
  })
}

// TODO: This should be in utils somewhere.
function bufferToHex(buffer){
  return ethUtil.addHexPrefix(buffer.toString('hex'))
}

function bufferToBN(buffer) {
  return new ethUtil.BN(buffer.toString('hex'), 'hex')
}

function PermaCacheStrategy() {
  this.cache = {}
}

PermaCacheStrategy.prototype.hitCheck = function(payload, requestedBlockNumber, hit, miss) {
  var identifier = cacheUtils.cacheIdentifierForPayload(payload)
  var cached = this.cache[identifier]

  if (cached && requestedBlockNumber.gte(cached.blockNumber)) {
    // If the block number we're requesting at is greater than or
    // equal to the block where we cached a previous response, return
    // the previous response. If it's less than the current block,
    // send it back down to the client where it will be recached.
    return hit(null, cached.result)
  } else {
    return miss()
  }
}

PermaCacheStrategy.prototype.cacheResult = function(payload, result, requestedBlockNumber, callback) {
  var identifier = cacheUtils.cacheIdentifierForPayload(payload)

  if (result) {
    this.cache[identifier] = {
      blockNumber: requestedBlockNumber,
      result: result
    }
  }

  callback()
}

PermaCacheStrategy.prototype.canCache = function(payload) {
  return cacheUtils.canCache(payload)
}

function ConditionalPermaCacheStrategy(conditionals) {
  this.strategy = new PermaCacheStrategy()
  this.conditionals = conditionals
}

ConditionalPermaCacheStrategy.prototype.hitCheck = function(payload, requestedBlockNumber, hit, miss) {
  return this.strategy.hitCheck(payload, requestedBlockNumber, hit, miss)
}

ConditionalPermaCacheStrategy.prototype.cacheResult = function(payload, result, requestedBlockNumber, callback) {
  var conditional = this.conditionals[payload.method]

  if (conditional) {
    if (conditional(result)) {
      this.strategy.cacheResult(payload, result, requestedBlockNumber, callback)
    } else {
      callback()
    }
  } else {
    // Cache all requests that don't have a conditional
    this.strategy.cacheResult(payload, result, requestedBlockNumber, callback)
  }
}

ConditionalPermaCacheStrategy.prototype.canCache = function(payload) {
  return this.strategy.canCache(payload)
}

function BlockCacheStrategy() {
  this.cache = {}
}

BlockCacheStrategy.prototype.getBlockCacheForPayload = function(payload, currentBlockNumber) {
  var blockTag = cacheUtils.blockTagForPayload(payload)

  // rewrite 'latest' blockTag to current block number
  if (!blockTag || blockTag === 'latest') blockTag = '0x' + currentBlockNumber.toString('hex')

  var blockCache = this.cache[blockTag]
  // create new cache if necesary
  if (!blockCache) blockCache = this.cache[blockTag] = {}

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
  var previousHex = ethUtil.intToHex(currentNumber-1)
  delete self.cache[previousHex]
}
