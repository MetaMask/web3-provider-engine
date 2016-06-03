const EventEmitter = require('events').EventEmitter
const inherits = require('util').inherits
const Stoplight = require('./util/stoplight.js')
const cacheUtils = require('./util/rpc-cache-utils.js')
const createPayload = require('./util/create-payload.js')
const async = require('async')

module.exports = Web3ProviderEngine


inherits(Web3ProviderEngine, EventEmitter)

function Web3ProviderEngine(opts) {
  const self = this
  EventEmitter.call(self)
  self.setMaxListeners(30)
  // set initialization blocker
  self._ready = new Stoplight()
  // unblock initialization after first block
  self.once('block', function(){
    self._ready.go()
  })
  // parse options
  opts = opts || {}
  self._pollingInterval = opts.pollingInterval || 4000
  // local state
  self.currentBlock = null
  self._providers = []
}

// public

Web3ProviderEngine.prototype.start = function(){
  const self = this
  // start block polling
  self._startPolling()
}

Web3ProviderEngine.prototype.stop = function(){
  const self = this
  // stop block polling
  self._stopPolling()
}

Web3ProviderEngine.prototype.addProvider = function(source){
  const self = this
  self._providers.push(source)
  source.setEngine(this)
}

Web3ProviderEngine.prototype.send = function(payload){
  throw new Error('Web3ProviderEngine does not support synchronous requests.')
}

Web3ProviderEngine.prototype.sendAsync = function(payload, cb){
  const self = this
  self._ready.await(function(){

    if (Array.isArray(payload)) {
      // handle batch
      async.map(payload, self._handleAsync.bind(self), cb)
    } else {
      // handle single
      self._handleAsync(payload, cb)
    }

  })
}

// private

Web3ProviderEngine.prototype._handleAsync = function(payload, finished) {
  var self = this
  var currentProvider = -1
  var result = null
  var error = null

  var stack = []

  next()

  function next(after) {
    currentProvider += 1
    stack.unshift(after)

    // Bubbled down as far as we could go, and the request wasn't
    // handled. Return an error.
    if (currentProvider >= self._providers.length) {
      end(new Error('Request for method "' + payload.method + '" not handled by any subprovider. Please check your subprovider configuration to ensure this method is handled.'))
    } else {
      try {
        var provider = self._providers[currentProvider]
        provider.handleRequest(payload, next, end)
      } catch (e) {
        end(e)
      }
    }
  }

  function end(_error, _result) {
    error = _error
    result = _result

    async.eachSeries(stack, function(fn, callback) {

      if (fn) {
        fn(error, result, callback)
      } else {
        callback()
      }
    }, function() {
      // console.log('COMPLETED:', payload)
      // console.log('RESULT: ', result)

      var resultObj = {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: result
      }

      if (error != null) {
        resultObj.error = {
          message: error.stack || error.message || error,
          code: -32000
        }
        // respond with both error formats
        finished(error, resultObj)
      } else {
        self._inspectResponseForNewBlock(payload, resultObj, finished)
      }
    })
  }
}

//
// from remote-data
//

Web3ProviderEngine.prototype._startPolling = function(){
  const self = this

  self._fetchLatestBlock()

  self._pollIntervalId = setInterval(function() {
    self._fetchLatestBlock()
  }, self._pollingInterval)
}

Web3ProviderEngine.prototype._stopPolling = function(){
  const self = this
  clearInterval(self._pollIntervalId)
}

Web3ProviderEngine.prototype._fetchLatestBlock = function(cb) {
  if (!cb) cb = function(err) { if (err) return console.error(err) }

  const self = this

  self._fetchBlock('latest', function(err, block) {
    if (err) {
      self.emit('error', err)
      return cb(err)
    }

    if (!self.currentBlock || 0 !== self.currentBlock.hash.compare(block.hash)) {
      self._setCurrentBlock(block)
    }

    cb(null, block)
  })
}

Web3ProviderEngine.prototype._setCurrentBlock = function(block){
  const self = this
  self.currentBlock = block
  self.emit('block', block)
}

Web3ProviderEngine.prototype._fetchBlock = function(number, cb){
  const self = this

  // skip: cache, readiness, block number rewrite
  self._handleAsync(createPayload({
    method: 'eth_getBlockByNumber',
    params: [number, false],
  }), function(err, resultObj){
    if (err) return cb(err)
    if (resultObj.error) return cb(resultObj.error)
    var data = resultObj.result;


    // json -> buffers
    var block = {
      number:           hexToBuffer(data.number),
      hash:             hexToBuffer(data.hash),
      parentHash:       hexToBuffer(data.parentHash),
      nonce:            hexToBuffer(data.nonce),
      sha3Uncles:       hexToBuffer(data.sha3Uncles),
      logsBloom:        hexToBuffer(data.logsBloom),
      transactionsRoot: hexToBuffer(data.transactionsRoot),
      stateRoot:        hexToBuffer(data.stateRoot),
      receiptRoot:      hexToBuffer(data.receiptRoot),
      miner:            hexToBuffer(data.miner),
      difficulty:       hexToBuffer(data.difficulty),
      totalDifficulty:  hexToBuffer(data.totalDifficulty),
      size:             hexToBuffer(data.size),
      extraData:        hexToBuffer(data.extraData),
      gasLimit:         hexToBuffer(data.gasLimit),
      gasUsed:          hexToBuffer(data.gasUsed),
      timestamp:        hexToBuffer(data.timestamp),
      transactions:     data.transactions,
    }

    cb(null, block)
  })
}

Web3ProviderEngine.prototype._inspectResponseForNewBlock = function(payload, resultObj, cb) {

  // these methods return responses with a block reference
  if (payload.method != 'eth_getTransactionByHash'
   && payload.method != 'eth_getTransactionReceipt') {
    return cb(null, resultObj)
  }

  if (resultObj.result == null || resultObj.result.blockNumber == null) {
    return cb(null, resultObj)
  }

  var blockNumber = hexToBuffer(resultObj.result.blockNumber)

  // If we found a new block number on the result,
  // fetch the block details before returning the original response.
  // We do this b/c a user might be polling for a tx by hash,
  // and when getting a response may assume that we are on the new block and
  // try to query data from that block but would otherwise get old data due to
  // our blockTag-rewriting mechanism
  if (0 !== this.currentBlock.number.compare(blockNumber)) {
    this._fetchLatestBlock(function(err, block) {
      cb(null, resultObj)
    })
  } else {
    cb(null, resultObj)
  }

}

// util

function SourceNotFoundError(payload){
  return new Error('Source for RPC method "'+payload.method+'" not found.')
}

function stripHexPrefix(hexString) {
  return hexString.replace('0x', '');
}

function addHexPrefix(str) {
  if (str.indexOf('0x') < 0) {
    str = '0x' + str;
  }
  return str;
}

function hexToBuffer(hexString){
  hexString = stripHexPrefix(hexString)
  if (hexString.length%2) hexString = '0'+hexString
  return new Buffer(hexString, 'hex')
}

// TODO: This should be in utils somewhere.
function bufferToHex(buffer){
  return addHexPrefix(buffer.toString('hex'))
}
