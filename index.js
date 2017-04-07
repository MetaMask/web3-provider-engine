const EventEmitter = require('events').EventEmitter
const inherits = require('util').inherits
const ethUtil = require('ethereumjs-util')
const EthBlockTracker = require('eth-block-tracker')
const async = require('async')
const Stoplight = require('./util/stoplight.js')
const cacheUtils = require('./util/rpc-cache-utils.js')
const createPayload = require('./util/create-payload.js')

module.exports = Web3ProviderEngine


inherits(Web3ProviderEngine, EventEmitter)

function Web3ProviderEngine(opts) {
  const self = this
  EventEmitter.call(self)
  self.setMaxListeners(30)
  // parse options
  opts = opts || {}
  // block polling
  const skipInitBlockProvider = { sendAsync: self._handleAsync.bind(self) }
  self._blockTracker = new EthBlockTracker({
    provider: skipInitBlockProvider,
    pollingInterval: opts.pollingInterval || 4000,
  })
  // handle new block
  self._blockTracker.on('block', (jsonBlock) => {
    const bufferBlock = toBufferBlock(jsonBlock)
    self._setCurrentBlock(bufferBlock)
  })
  // set initialization blocker
  self._ready = new Stoplight()
  // unblock initialization after first block
  self._blockTracker.once('latest', () => {
    console.log('_blockTracker wait for first block')
    self._ready.go()
  })
  // local state
  self.currentBlock = null
  self._providers = []
}

// public

Web3ProviderEngine.prototype.start = function(){
  const self = this
  // start block polling
  self._blockTracker.start()
}

Web3ProviderEngine.prototype.stop = function(){
  const self = this
  // stop block polling
  self._blockTracker.stop()
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

Web3ProviderEngine.prototype._setCurrentBlock = function(block){
  const self = this
  self.currentBlock = block
  self.emit('block', block)
}

Web3ProviderEngine.prototype._inspectResponseForNewBlock = function(payload, resultObj, cb) {
  const self = this

  // these methods return responses with a block reference
  if (payload.method !== 'eth_getTransactionByHash'
   && payload.method !== 'eth_getTransactionReceipt') {
    return cb(null, resultObj)
  }

  if (resultObj.result === null
   || resultObj.result.blockNumber === null) {
    return cb(null, resultObj)
  }

  const blockNumber = ethUtil.toBuffer(resultObj.result.blockNumber)

  // If we found a new block number on the result,
  // and it is higher than our current block,
  // fetch for a new latest block before returning the original response.
  // We do this b/c a user might be polling for a tx by hash,
  // and may get a result that includes a reference to a block we havent seen yet.
  // Without this blocker, the user may assume that we are on the new block and
  // try to query data from that block but would otherwise get old data due to
  // our blockTag-rewriting mechanism
  if (-1 === self.currentBlock.number.compare(blockNumber)) {
    console.log('_inspectResponseForNewBlock start')
    self._blockTracker._performSync().then(() => {
      console.log('_inspectResponseForNewBlock end')
      cb(null, resultObj)
    })
  } else {
    cb(null, resultObj)
  }

}

// util

function SourceNotFoundError (payload) {
  return new Error('Source for RPC method "'+payload.method+'" not found.')
}

function toBufferBlock (jsonBlock) {
  return {
    number:           ethUtil.toBuffer(jsonBlock.number),
    hash:             ethUtil.toBuffer(jsonBlock.hash),
    parentHash:       ethUtil.toBuffer(jsonBlock.parentHash),
    nonce:            ethUtil.toBuffer(jsonBlock.nonce),
    sha3Uncles:       ethUtil.toBuffer(jsonBlock.sha3Uncles),
    logsBloom:        ethUtil.toBuffer(jsonBlock.logsBloom),
    transactionsRoot: ethUtil.toBuffer(jsonBlock.transactionsRoot),
    stateRoot:        ethUtil.toBuffer(jsonBlock.stateRoot),
    receiptsRoot:     ethUtil.toBuffer(jsonBlock.receiptRoot || jsonBlock.receiptsRoot),
    miner:            ethUtil.toBuffer(jsonBlock.miner),
    difficulty:       ethUtil.toBuffer(jsonBlock.difficulty),
    totalDifficulty:  ethUtil.toBuffer(jsonBlock.totalDifficulty),
    size:             ethUtil.toBuffer(jsonBlock.size),
    extraData:        ethUtil.toBuffer(jsonBlock.extraData),
    gasLimit:         ethUtil.toBuffer(jsonBlock.gasLimit),
    gasUsed:          ethUtil.toBuffer(jsonBlock.gasUsed),
    timestamp:        ethUtil.toBuffer(jsonBlock.timestamp),
    transactions:     jsonBlock.transactions,
  }
}