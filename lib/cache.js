const ethUtil = require('ethereumjs-util')
const cacheUtils = require('../util/rpc-cache-utils.js')
const Stoplight = require('../util/stoplight.js')
const PermaCacheStrategy = require('./cache-strategies.js').PermaCacheStrategy
const BlockCacheStrategy = require('./cache-strategies.js').BlockCacheStrategy

module.exports = CacheMiddleware


function CacheMiddleware(blockTracker, opts) {
  opts = opts || {}

  // setup caching strategies
  var strategies = opts.strategies || {
    perma: new PermaCacheStrategy({
      eth_getTransactionByHash: function(result) {
        return Boolean(result && result.blockHash)
      },
    }),
    block: new BlockCacheStrategy(),
    fork: new BlockCacheStrategy(),
  }

  // set initialization blocker
  var stoplight = new Stoplight()
  // unblock after first block
  blockTracker.once('block', function(block) {
    stoplight.go()
  })

  // listen for new block
  var currentBlock = null
  blockTracker.on('block', function(block) {
    currentBlock = block
    strategies.block.cacheRollOff(block)
    strategies.fork.cacheRollOff(block)
  })

  return handleRequest


  function handleRequest(req, res, next){
    // skip cache if told to do so
    if (req.skipCache) {
      // console.log('CACHE SKIP - skip cache if told to do so')
      return next()
    }
    // wait for first block
    stoplight.await(function(){
      // actually handle the request
      tryCache(req, res, next)
    })
  }

  function tryCache(req, res, next){

    var type = cacheUtils.cacheTypeForPayload(req)
    var strategy = strategies[type]

    // If there's no strategy in place, pass it down the chain.
    if (!strategy) return next()

    // If the strategy can't cache this request, ignore it.
    if (!strategy.canCache(req)) return next()

    // extract requested block number
    var blockTag = cacheUtils.blockTagForPayload(req)
    if (!blockTag) blockTag = 'latest'
    var requestedBlockNumber
    if (blockTag === 'earliest') {
      requestedBlockNumber = '0x00'
    } else if (blockTag === 'latest') {
      requestedBlockNumber = ethUtil.bufferToHex(currentBlock.number)
    } else {
      // blockTag is hex string
      requestedBlockNumber = blockTag
    }

    // end on a hit, continue on a miss
    strategy.hitCheck(req, requestedBlockNumber, cacheHit, cacheMiss)

    function cacheHit(err, result) {
      if (err) return next(err)
      // console.log('CACHE HIT -', req, result)
      res.result = result
      next()
    }

    function cacheMiss() {
      // fallthrough, catch and cache the result on the way back up
      // console.log('CACHE MISS -', req)
      next(null, function(req, res, cb) {
        // console.log('CACHE INSERT -', req, res)
        if (res.result === undefined) return cb()
        // console.log('CACHE strategy:', strategy.constructor.name)
        strategy.cacheResult(req, res.result, requestedBlockNumber, cb)
      })
    }
  }

}
