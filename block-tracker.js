const EventEmitter = require('events').EventEmitter
const inherits = require('util').inherits
const createPayload = require('./util/create-payload.js')
const ethUtil = require('ethereumjs-util')

module.exports = BlockTracker


inherits(BlockTracker, EventEmitter)

function BlockTracker(provider, opts) {
  const self = this
  // parse options
  opts = opts || {}
  // super constructor
  EventEmitter.call(self)
  self.setMaxListeners(opts.maxListeners || 100)
  // config
  self._provider = provider
  self._pollingInterval = opts.interval || 4000
  // local state
  self.currentBlock = null
}

// public

BlockTracker.prototype.start = function(){
  const self = this

  self._fetchLatestBlock()

  self._pollIntervalId = setInterval(function() {
    self._fetchLatestBlock()
  }, self._pollingInterval)
}

BlockTracker.prototype.stop = function(){
  const self = this
  clearInterval(self._pollIntervalId)
}

BlockTracker.prototype.inspectResponseForNewBlock = function(req, res, cb) {

  // these methods return responses with a block reference
  if (req.method != 'eth_getTransactionByHash'
   && req.method != 'eth_getTransactionReceipt') {
    return cb(null, res)
  }

  if (res.result == null || res.result.blockNumber == null) {
    return cb(null, res)
  }

  var blockNumber = ethUtil.toBuffer(res.result.blockNumber)

  // If we found a new block number on the result,
  // fetch the block details before returning the original response.
  // We do this b/c a user might be polling for a tx by hash,
  // and when getting a response may assume that we are on the new block and
  // try to query data from that block but would otherwise get old data due to
  // a blockTag-rewriting mechanism
  if (0 !== this.currentBlock.number.compare(blockNumber)) {
    this._fetchLatestBlock(function(err, block) {
      cb(null, res)
    })
  } else {
    cb(null, res)
  }

}


// private

BlockTracker.prototype._fetchLatestBlock = function(cb) {
  const self = this

  // log errors if no callback
  if (!cb) cb = function(err) { if (err) return console.error(err) }

  // TODO: check next block, not latest
  self._fetchBlock('latest', function(err, block) {
    if (err) return cb(err)

    // accept new block
    if (!self.currentBlock || 0 !== self.currentBlock.hash.compare(block.hash)) {
      self._setCurrentBlock(block)
    }

    cb(null, block)
  })
}

BlockTracker.prototype._setCurrentBlock = function(block){
  const self = this
  self.currentBlock = block
  // TODO: detect fork?
  self.emit('block', block)
}

BlockTracker.prototype._fetchBlock = function(number, cb){
  const self = this

  // skip: cache, readiness, block number rewrite
  self._provider.sendAsync(createPayload({
    method: 'eth_getBlockByNumber',
    params: [number, false],
  }), function(err, res){
    if (err) return cb(err)
    if (res.error) return cb(res.error)
    var blockData = res.result

    // json -> buffers
    console.log('blockData', arguments)

    var block = {
      number:           ethUtil.toBuffer(blockData.number),
      hash:             ethUtil.toBuffer(blockData.hash),
      parentHash:       ethUtil.toBuffer(blockData.parentHash),
      nonce:            ethUtil.toBuffer(blockData.nonce),
      sha3Uncles:       ethUtil.toBuffer(blockData.sha3Uncles),
      logsBloom:        ethUtil.toBuffer(blockData.logsBloom),
      transactionsRoot: ethUtil.toBuffer(blockData.transactionsRoot),
      stateRoot:        ethUtil.toBuffer(blockData.stateRoot),
      receiptRoot:      ethUtil.toBuffer(blockData.receiptRoot),
      miner:            ethUtil.toBuffer(blockData.miner),
      difficulty:       ethUtil.toBuffer(blockData.difficulty),
      totalDifficulty:  ethUtil.toBuffer(blockData.totalDifficulty),
      size:             ethUtil.toBuffer(blockData.size),
      extraData:        ethUtil.toBuffer(blockData.extraData),
      gasLimit:         ethUtil.toBuffer(blockData.gasLimit),
      gasUsed:          ethUtil.toBuffer(blockData.gasUsed),
      timestamp:        ethUtil.toBuffer(blockData.timestamp),
      transactions:     ethUtil.toBuffer(blockData.transactions),
    }

    cb(null, block)
  })
}

// // util

// function SourceNotFoundError(payload){
//   return new Error('Source for RPC method "'+payload.method+'" not found.')
// }

// function stripHexPrefix(hexString) {
//   return hexString.replace('0x', '');
// }

// function addHexPrefix(str) {
//   if (str.indexOf('0x') < 0) {
//     str = '0x' + str;
//   }
//   return str;
// }

// function hexToBuffer(hexString){
//   hexString = stripHexPrefix(hexString)
//   if (hexString.length%2) hexString = '0'+hexString
//   return new Buffer(hexString, 'hex')
// }

// // TODO: This should be in utils somewhere.
// function bufferToHex(buffer){
//   return addHexPrefix(buffer.toString('hex'))
// }



// block-tracker pending first block

// set initialization blocker
// self._ready = new Stoplight()
// // unblock initialization after first block
// self.once('block', function(){
//   self._ready.go()
// })