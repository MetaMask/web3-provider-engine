const EventEmitter = require('events').EventEmitter
const inherits = require('util').inherits
const createPayload = require('./util/create-payload.js')
const ethUtil = require('ethereumjs-util')

module.exports = PollingBlockTracker


inherits(PollingBlockTracker, EventEmitter)

function PollingBlockTracker(provider, opts) {
  const self = this
  // parse options
  opts = opts || {}
  // super constructor
  EventEmitter.call(self)
  self.setMaxListeners(opts.maxListeners || 100)
  // config
  self._provider = provider
  self._pollingInterval = opts.interval || 4000
  self._pollingShouldUnref = opts.pollingShouldUnref !== false
  // local state
  self.currentBlock = null
}

// public

PollingBlockTracker.prototype.start = function(){
  const self = this

  self._fetchLatestBlock()

  // start block polling
  self._pollIntervalId = setInterval(function() {
    self._fetchLatestBlock()
  }, self._pollingInterval)

  // Tell node that block polling shouldn't keep the process open.
  // https://nodejs.org/api/timers.html#timers_timeout_unref
  if (self._pollIntervalId.unref && self._pollingShouldUnref) {
    self._pollIntervalId.unref()
  }

}

PollingBlockTracker.prototype.stop = function(){
  const self = this
  // stop block polling
  clearInterval(self._pollIntervalId)
}

PollingBlockTracker.prototype._fetchLatestBlock = function(cb) {
  const self = this

  // log errors if no callback
  if (!cb) cb = function(err) { if (err) return console.error(err) }


  self._fetchBlock('latest', function(err, block) {
    if (err) {
      self.emit('error', err)
      return cb(err)
    }

    // accept new block
    if (!self.currentBlock || 0 !== self.currentBlock.hash.compare(block.hash)) {
      self._setCurrentBlock(block)
    }

    cb(null, block)
  })
}

PollingBlockTracker.prototype._setCurrentBlock = function(block){
  const self = this
  self.currentBlock = block
  self.emit('block', block)
}

PollingBlockTracker.prototype._fetchBlock = function(number, cb){
  const self = this

  self._provider.sendAsync(createPayload({
    method: 'eth_getBlockByNumber',
    params: [number, false],
  }), function(err, resultObj){
    if (err) return cb(err)
    if (resultObj.error) return cb(resultObj.error)
    var data = resultObj.result;

    // json -> buffers
    var block = {
      number:           ethUtil.toBuffer(data.number),
      hash:             ethUtil.toBuffer(data.hash),
      parentHash:       ethUtil.toBuffer(data.parentHash),
      nonce:            ethUtil.toBuffer(data.nonce),
      sha3Uncles:       ethUtil.toBuffer(data.sha3Uncles),
      logsBloom:        ethUtil.toBuffer(data.logsBloom),
      transactionsRoot: ethUtil.toBuffer(data.transactionsRoot),
      stateRoot:        ethUtil.toBuffer(data.stateRoot),
      receiptRoot:      ethUtil.toBuffer(data.receiptRoot),
      miner:            ethUtil.toBuffer(data.miner),
      difficulty:       ethUtil.toBuffer(data.difficulty),
      totalDifficulty:  ethUtil.toBuffer(data.totalDifficulty),
      size:             ethUtil.toBuffer(data.size),
      extraData:        ethUtil.toBuffer(data.extraData),
      gasLimit:         ethUtil.toBuffer(data.gasLimit),
      gasUsed:          ethUtil.toBuffer(data.gasUsed),
      timestamp:        ethUtil.toBuffer(data.timestamp),
      transactions:     data.transactions,
    }

    cb(null, block)
  })
}

PollingBlockTracker.prototype._inspectResponseForNewBlock = function(payload, resultObj, cb) {

  // only these methods return responses with a block reference
  // exit if not these methods
  if (payload.method != 'eth_getTransactionByHash'
   && payload.method != 'eth_getTransactionReceipt') {
    return cb(null, resultObj)
  }

  // exit if no result or blockNumber
  if (resultObj.result == null || resultObj.result.blockNumber == null) {
    return cb(null, resultObj)
  }

  var blockNumber = ethUtil.toBuffer(resultObj.result.blockNumber)

  // If we found a new block number on the result,
  // fetch the block details before returning the original response.
  // We do this b/c a user might be polling for a tx by hash,
  // and when getting a response may assume that we are on the new block and
  // try to query data from that block but would otherwise get old data due to
  // our blockTag-rewriting mechanism
  if (0 !== this.currentBlock.number.compare(blockNumber)) {
    // fetch for the new latest block!
    this._fetchLatestBlock(function(err, block) {
      cb(null, resultObj)
    })
  } else {
    // exit
    cb(null, resultObj)
  }

}

