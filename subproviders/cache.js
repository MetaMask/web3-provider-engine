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
  self._blockCache = {}
  self._permaCache = {}
  self.cacheLength = opts.cacheLength || 4
  // set initialization blocker
  self._ready = new Stoplight()
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
    self.cacheRollOff()
  })
}

// naively removes older block caches
BlockCacheProvider.prototype.cacheRollOff = function(){
  const self = this
  var currentNumber = ethUtil.bufferToInt(self.currentBlock.number)
  var previousHex = ethUtil.intToHex(currentNumber-1)
  delete self._blockCache[previousHex]
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
  
  // parse blockTag
  var blockTag = cacheUtils.blockTagForPayload(payload)
  // rewrite 'latest' blockTag to current block number
  if (!blockTag || blockTag === 'latest') blockTag = bufferToHex(self.currentBlock.number)
  var blockCache = self._cacheForBlockTag(blockTag)
  var cacheIdentifier = cacheUtils.cacheIdentifierForPayload(payload)

  //
  // read from cache
  //

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
      // console.log('CACHE HIT:', result)
      end(null, result)
      return
    } else {
      // console.log('CACHE MISS:', blockTag, cacheIdentifier)
    }
  }

  //
  // populate cache
  //

  // fallthrough to provider chain, caching the result on the way back up.
  next(function(err, result, cb) {
    // err is already handled by engine
    if (err) return cb()

    // populate cache with result
    if (cacheIdentifier && result !== undefined) {
      // cache permanently (only truthy values)
      if (result && cacheUtils.canPermaCache(payload)) {
        self._permaCache[cacheIdentifier] = result
        // console.log('CACHE POPULATE:', 'PERMA', cacheIdentifier, '->', result)
      // cache for block (any value)
      } else if (blockCache && cacheUtils.canBlockCache(payload)) {
        blockCache[cacheIdentifier] = result
        // console.log('CACHE POPULATE:', blockTag, cacheIdentifier, '->', result)
      // cache miss
      } else {
        // console.log('CACHE POPULATE MISS:', blockTag, cacheIdentifier)
      }
    // cache not possible
    } else {
      // console.log('CACHE SKIP:', payload.method, result)
    }

    cb()
  })
}

BlockCacheProvider.prototype._cacheForBlockTag = function(blockTag){
  const self = this
  if (!blockTag || blockTag === 'pending') return null
  var cache = self._blockCache[blockTag]
  // create new cache if necesary
  if (!cache) cache = self._blockCache[blockTag] = {}
  return cache
}

// TODO: This should be in utils somewhere.
function bufferToHex(buffer){
  return ethUtil.addHexPrefix(buffer.toString('hex'))
}
