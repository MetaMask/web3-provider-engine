const EventEmitter = require('events').EventEmitter
const inherits = require('util').inherits
const ethUtil = require('ethereumjs-util')
const { PollingBlockTracker } = require('eth-block-tracker')
const map = require('async/map')
const eachSeries = require('async/eachSeries')
const Stoplight = require('./util/stoplight.js')
const cacheUtils = require('./util/rpc-cache-utils.js')
const createPayload = require('./util/create-payload.js')
const noop = function(){}

module.exports = Web3ProviderEngine


inherits(Web3ProviderEngine, EventEmitter)

function Web3ProviderEngine(opts) {
  const self = this
  EventEmitter.call(self)
  self.setMaxListeners(30)
  // parse options
  opts = opts || {}

  // block polling
  const directProvider = { sendAsync: self._handleAsync.bind(self) }
  const blockTrackerProvider = opts.blockTrackerProvider || directProvider
  self._blockTracker = opts.blockTracker || new PollingBlockTracker({
    provider: blockTrackerProvider,
    pollingInterval: opts.pollingInterval || 4000,
    setSkipCacheFlag: true,
  })

  // set initialization blocker
  self._ready = new Stoplight()

  // local state
  self.currentBlock = null
  self._providers = []
}

// public

Web3ProviderEngine.prototype.start = function(cb = noop){
  const self = this

  // trigger start
  self._ready.go()

  // on new block, request block body and emit as events
  self._blockTracker.on('latest', (blockNumber) => {
    // get block body
    self._getBlockByNumberWithRetry(blockNumber, (err, block) => {
      if (err) {
        this.emit('error', err)
        return
      }
      if (!block) {
        console.log(block)
        this.emit('error', new Error("Could not find block"))
        return
      }
      const bufferBlock = toBufferBlock(block)
      // set current + emit "block" event
      self._setCurrentBlock(bufferBlock)
      // emit other events
      self.emit('rawBlock', block)
      self.emit('latest', block)
    })
  })

  // forward other events
  self._blockTracker.on('sync', self.emit.bind(self, 'sync'))
  self._blockTracker.on('error', self.emit.bind(self, 'error'))

  // update state
  self._running = true
  // signal that we started
  self.emit('start')
}

Web3ProviderEngine.prototype.stop = function(){
  const self = this
  // stop block polling by removing event listeners
  self._blockTracker.removeAllListeners()
  // update state
  self._running = false
  // signal that we stopped
  self.emit('stop')
}

Web3ProviderEngine.prototype.isRunning = function(){
  const self = this
  return self._running
}

Web3ProviderEngine.prototype.addProvider = function(source, index){
  const self = this
  if (typeof index === 'number') {
    self._providers.splice(index, 0, source)
  } else {
    self._providers.push(source)
  }
  source.setEngine(this)
}

Web3ProviderEngine.prototype.removeProvider = function(source){
  const self = this
  const index = self._providers.indexOf(source)
  if (index < 0) throw new Error('Provider not found.')
  self._providers.splice(index, 1)
}

Web3ProviderEngine.prototype.send = function(payload){
  throw new Error('Web3ProviderEngine does not support synchronous requests.')
}

Web3ProviderEngine.prototype.sendAsync = function(payload, cb){
  const self = this
  self._ready.await(function(){

    if (Array.isArray(payload)) {
      // handle batch
      map(payload, self._handleAsync.bind(self), cb)
    } else {
      // handle single
      self._handleAsync(payload, cb)
    }

  })
}

// private

Web3ProviderEngine.prototype._getBlockByNumberWithRetry = function(blockNumber, cb) {
  const self = this

  let retriesRemaining = 5

  attemptRequest()
  return

  function attemptRequest () {
    self._getBlockByNumber(blockNumber, afterRequest)
  }

  function afterRequest (err, block) {
    // anomalous error occurred
    if (err) return cb(err)
    // block not ready yet
    if (!block) {
      if (retriesRemaining > 0) {
        // wait 1s then try again
        retriesRemaining--
        setTimeout(function () {
          attemptRequest()
        }, 1000)
        return
      } else {
        // give up, return a null block
        cb(null, null)
        return
      }
    }
    // otherwise return result
    cb(null, block)
    return
  }
}


Web3ProviderEngine.prototype._getBlockByNumber = function(blockNumber, cb) {
  const req = createPayload({ method: 'eth_getBlockByNumber', params: [blockNumber, false], skipCache: true })
  this._handleAsync(req, (err, res) => {
    if (err) return cb(err)
    return cb(null, res.result)
  })
}

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

    eachSeries(stack, function(fn, callback) {

      if (fn) {
        fn(error, result, callback)
      } else {
        callback()
      }
    }, function() {

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
        finished(null, resultObj)
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

// util

function toBufferBlock (jsonBlock) {
  return {
    number:           ethUtil.toBuffer(jsonBlock.number),
    hash:             ethUtil.toBuffer(jsonBlock.hash),
    parentHash:       ethUtil.toBuffer(jsonBlock.parentHash),
    nonce:            ethUtil.toBuffer(jsonBlock.nonce),
    mixHash:          ethUtil.toBuffer(jsonBlock.mixHash),
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
