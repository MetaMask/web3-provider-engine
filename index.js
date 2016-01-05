const async = require('async')
const EventEmitter = require('events').EventEmitter
const inherits = require('util').inherits
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const Stoplight = require('./util/stoplight.js')
const cacheUtils = require('./util/rpc-cache-utils.js')
const POLLING_INTERVAL = 4000

module.exports = Web3ProviderEngine


inherits(Web3ProviderEngine, EventEmitter)

function Web3ProviderEngine(opts) {
  const self = this
  EventEmitter.call(self)
  // set initialization blocker
  self._ready = new Stoplight()
  self.once('block', function(){ self._ready.go() })
  // local state
  self.currentBlock = null
  self._sources = []
  self._blocks = {}
}

// public

Web3ProviderEngine.prototype.start = function(){
  const self = this
  // start block polling
  self._startPolling()
}

Web3ProviderEngine.prototype.addSource = function(source){
  const self = this
  self._sources.push(source)
  source._engine = this;
}

Web3ProviderEngine.prototype.send = function(payload){
  throw new Error("Web3ProviderEngine does not support synchronous requests.");
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
  var self = this;
  var currentProvider = -1;
  var result = null;
  var error = null;

  var stack = [];

  function next(after) {
    currentProvider += 1;
    stack.unshift(after);

    // Bubbled down as far as we could go, and the request wasn't
    // handled. Return an error.
    if (currentProvider >= self._sources.length) {
      end(new Error("Request for method '" + payload.method + "' not handled by any subprovider. Please check your subprovider configuration to ensure this method is handled."));
    } else {
      try {
        var provider = self._sources[currentProvider];
        provider.handleRequest(payload, next, end);
      } catch (e) {
        end(e);
      }
    }
  };

  function end(e, r) {
    error = e;
    result = r;

    async.eachSeries(stack, function(fn, callback) {
      if (fn != null) {
        fn(error, result, callback);
      } else {
        callback();
      }
    }, function() {
      console.log(payload);

      var resultObj = {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: result
      };

      if (error != null) {
        resultObj.error = error.stack || error.message || error;
      };

      finished(null, resultObj);
    });
  };

  next();
}

//
// from remote-data
//

Web3ProviderEngine.prototype._startPolling = function(){
  const self = this
  pollForBlock()

  function pollForBlock(){
    fetchLatestBlock(function onBlockFetchResponse(err, block){
      if (block) checkIfUpdated(block)
      setTimeout(pollForBlock, POLLING_INTERVAL)
    })
  }

  function fetchLatestBlock(cb){
    self._fetchBlock('latest', cb)
  }

  function checkIfUpdated(block){
    if (!self._blocks.latest || 0 !== self._blocks.latest.hash.compare(block.hash)) {
      self._setCurrentBlock(block)
    }
  }
}

Web3ProviderEngine.prototype._setCurrentBlock = function(block){
  const self = this
  // self.resetBlockCache()
  var blockNumber = bufferToHex(block.number)
  self._blocks[blockNumber] = block
  self._blocks.latest = block
  // console.log('saving block cache with number:', blockNumber)
  // broadcast new block
  self.currentBlock = block
  self.emit('block', block)
}

Web3ProviderEngine.prototype._fetchBlock = function(number, cb){
  const self = this

  // skip: cache, readiness, block number rewrite
  self._handleAsync({
    jsonrpc: "2.0",
    id: new Date().getTime() + parseInt(Math.random()*1000000),
    method: 'eth_getBlockByNumber',
    params: [number, false],
  }, function(err, resultObj){
    if (err) return cb(err)
      var data = resultObj.result

    // json -> buffers
    var block = {
      number: hexToBuffer(data.number),
      hash: hexToBuffer(data.hash),
      parentHash: hexToBuffer(data.parentHash),
      nonce: hexToBuffer(data.nonce),
      sha3Uncles: hexToBuffer(data.sha3Uncles),
      logsBloom: hexToBuffer(data.logsBloom),
      transactionsRoot: hexToBuffer(data.transactionsRoot),
      stateRoot: hexToBuffer(data.stateRoot),
      receiptRoot: hexToBuffer(data.receiptRoot),
      miner: hexToBuffer(data.miner),
      difficulty: hexToBuffer(data.difficulty),
      totalDifficulty: hexToBuffer(data.totalDifficulty),
      size: hexToBuffer(data.size),
      extraData: hexToBuffer(data.extraData),
      gasLimit: hexToBuffer(data.gasLimit),
      gasUsed: hexToBuffer(data.gasUsed),
      timestamp: hexToBuffer(data.timestamp),
      transactions: data.transactions,
    }

    cb(null, block)
  })
}


// util

function SourceNotFoundError(payload){
  return new Error('Source for RPC method "'+payload.method+'" not found.')
}

function hexToBuffer(hexString){
  hexString = ethUtil.stripHexPrefix(hexString)
  if (hexString.length%2) hexString = '0'+hexString
  return new Buffer(hexString, 'hex')
}

// TODO: This should be in utils somewhere.
function bufferToHex(buffer){
  return ethUtil.addHexPrefix(buffer.toString('hex'))
}

// function materializeTransaction(data){
//   var tx = new Transaction({
//     nonce: data.nonce,
//     gasPrice: data.gasPrice,
//     gasLimit: data.gas,
//     to: data.to,
//     value: data.value,
//     data: data.input,
//   })
//   tx.from = new Buffer(ethUtil.stripHexPrefix(data.from), 'hex')
//   return tx
// }
