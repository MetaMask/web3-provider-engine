const cacheUtils = require('../util/rpc-cache-utils.js')
const ethUtil = require('ethereumjs-util')
const inherits = require('util').inherits
const Subprovider = require('./subprovider.js')

module.exports = BlockCacheProvider

inherits(BlockCacheProvider, Subprovider)

function BlockCacheProvider() {
  const self = this
  self._blockCache = {}
  self._permaCache = {}
}

BlockCacheProvider.prototype.handleRequest = function(payload, next, end){
  const self = this

  if (payload.cache === false) {
    //throw new Error('Skipping cache')
    return next()
  }

  // Ignore block polling requests.
  if (payload.method === 'eth_getBlockByNumber' && payload.params[0] === 'latest') {
    return next()
  }

  if (!self.currentBlock) {
    return next()
  }
  
  // parse blockTag
  var blockTag = cacheUtils.blockTagForPayload(payload)
  // rewrite 'latest' blockTags to block number
  if (!blockTag || blockTag === 'latest') blockTag = bufferToHex(self.currentBlock.number)

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
      end(null, result)
      return
    } else {
      // console.log('CACHE MISS:', blockTag, cacheIdentifier)
    }
  }

  // continue down provider chain, caching the result on the way back up.
  next(function(err, result, cb) {
    if (err) return cb()

    // populate cache with result
    if (cacheIdentifier && result) {
      if (cacheUtils.canPermaCache(payload)) {
        self._permaCache[cacheIdentifier] = result
        // console.log('CACHE POPULATE:', 'PERMA', cacheIdentifier, '->', resultObj.result)
      } else if (blockCache && cacheUtils.canBlockCache(payload)) {
        blockCache[cacheIdentifier] = result
        // console.log('CACHE POPULATE:', blockTag, cacheIdentifier, '->', resultObj.result)
      } else {
        // console.warn('CACHE POPULATE MISS:', blockTag, cacheIdentifier)
      }
    } else {
      // console.log('CACHE SKIP:', payload.method, resultObj)
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