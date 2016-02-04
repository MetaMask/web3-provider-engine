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
  self.cacheLength = opts.cacheLength || 4
  // set initialization blocker
  self._ready = new Stoplight()
  self.strategies = {
    perma: new PermaCacheStrategy(),
    conditional: new ConditionalPermaCacheStrategy({
      eth_getTransactionByHash: function(result) {
        if (result && result.blockHash != null) {
          return true;
        }
        return false;
      }
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
    self.strategies.block.cacheRollOff()
    self.strategies.fork.cacheRollOff()
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

  var type = cacheUtils.cacheTypeForPayload(payload);
  var strategy = this.strategies[type];

  // If there's no strategy in place, pass it down the chain.
  if (strategy == null) {
    return next();
  }

  // If the strategy can't cache this request, ignore it.
  if (strategy.canCache(payload) == false) {
    return next();
  }

  // end on a hit, continue on a miss
  strategy.hitCheck(payload, end, function() {
    // miss; fallthrough to provider chain, caching the result on the way back up.
    next(function(err, result, cb) {
      // err is already handled by engine
      if (err) return cb()
      strategy.cacheResult(payload, result, cb);
    })
  });
}

// TODO: This should be in utils somewhere.
function bufferToHex(buffer){
  return ethUtil.addHexPrefix(buffer.toString('hex'))
}

function PermaCacheStrategy() {
  this.cache = {};
}

PermaCacheStrategy.prototype.hitCheck = function(payload, hit, miss) {
  var identifier = cacheUtils.cacheIdentifierForPayload(payload)
  var cached = this.cache[identifier];

  if (cached != null) {
    return hit(null, cached);
  } else {
    return miss();
  }
};

PermaCacheStrategy.prototype.cacheResult = function(payload, result, callback) {
  var identifier = cacheUtils.cacheIdentifierForPayload(payload)

  if (result != null) {
    this.cache[identifier] = result;
  }

  callback();
}

PermaCacheStrategy.prototype.canCache = function(payload) {
  return cacheUtils.canCache(payload)
}

function ConditionalPermaCacheStrategy(conditionals) {
  this.strategy = new PermaCacheStrategy();
  this.conditionals = conditionals;
}

ConditionalPermaCacheStrategy.prototype.hitCheck = function(payload, hit, miss) {
  return this.strategy.hitCheck(payload, hit, miss);
}

ConditionalPermaCacheStrategy.prototype.cacheResult = function(payload, result, callback) {
  var conditional = this.conditionals[payload.method];

  if (conditional && conditional(result)) {
    this.strategy.cacheResult(payload, result, callback);
  } else {
    callback();
  }
}

ConditionalPermaCacheStrategy.prototype.canCache = function(payload) {
  return this.strategy.canCache(payload);
}

function BlockCacheStrategy(subprovider) {
  this.cache = {};
  this.subprovider = subprovider;
};

BlockCacheStrategy.prototype.getBlockCache = function(payload) {
  var blockTag = cacheUtils.blockTagForPayload(payload)

  if (blockTag == "pending") {
    return null;
  }

  // rewrite 'latest' blockTag to current block number
  if (!blockTag || blockTag === 'latest') blockTag = bufferToHex(this.subprovider.currentBlock.number)

  var blockCache = this.cache[blockTag]
  // create new cache if necesary
  if (!blockCache) blockCache = this.cache[blockTag] = {}

  return blockCache;
}

BlockCacheStrategy.prototype.hitCheck = function(payload, hit, miss) {
  var blockCache = this.getBlockCache(payload);

  if (blockCache == null) {
    return miss();
  }

  var identifier = cacheUtils.cacheIdentifierForPayload(payload);
  var cached = blockCache[identifier];

  if (cached != null) {
    return hit(null, cached);
  } else {
    return miss();
  }
};

BlockCacheStrategy.prototype.cacheResult = function(payload, result, callback) {
  if (result != null) {
    var blockCache = this.getBlockCache(payload);
    var identifier = cacheUtils.cacheIdentifierForPayload(payload);
    blockCache[identifier] = result;
  }
  callback();
}

BlockCacheStrategy.prototype.canCache = function(payload) {
  if (cacheUtils.canCache(payload) == false) {
    return false;
  }

  var blockTag = cacheUtils.blockTagForPayload(payload)

  if (blockTag == "pending") {
    return false;
  }

  return true;
}

// naively removes older block caches
BlockCacheStrategy.prototype.cacheRollOff = function(){
  const self = this
  var currentNumber = ethUtil.bufferToInt(self.subprovider.currentBlock.number)
  var previousHex = ethUtil.intToHex(currentNumber-1)
  delete self.cache[previousHex]
}
