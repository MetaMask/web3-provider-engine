import EventEmitter from 'events';
import {inherits} from 'util';
import ethUtil from 'ethereumjs-util';
import EthBlockTracker from 'eth-block-tracker';
import {eachSeries, map} from 'async';
import Stoplight from './util/stoplight.js';

class Web3ProviderEngine extends EventEmitter {

  constructor (opts) {
    super();
    const self = this;
    EventEmitter.call(self);
    self.setMaxListeners(30);
    //parse options
    opts = opts || {};
    //block polling
    const skipInitLockProvider = { sendAsync: self._handleAsync.bind(self) };
    const blockTrackerProvider = opts.blockTrackerProvider || skipInitLockProvider;
    self._blockTracker = new EthBlockTracker({
      provider: blockTrackerProvider,
      pollingInterval: opts.pollingInterval || 4000,
    });
    //handle new block
    self._blockTracker.on('block', (jsonBlock) => {
      const bufferBlock = this.toBufferBlock(jsonBlock);
      self._setCurrentBlock(bufferBlock);
    });

    //emit block events from the block tracker
    self._blockTracker.on('block', self.emit.bind(self, 'rawBlock'));
    self._blockTracker.on('sync', self.emit.bind(self, 'sync'));
    self._blockTracker.on('latest', self.emit.bind(self, 'latest'));

    //set initialization blocker
    self._ready = new Stoplight();
    //unblock initialization after first block
    self._blockTracker.once('block', () => {
      self._ready.go();
    });
    //local state
    self.currentBlock = null;
    self._providers = [];
  }

  //public
  start () {
    const self = this;
    //start block polling
    self._blockTracker.start();
  }

  stop () {
    const self = this;
    //stop block polling
    self._blockTracker.stop();
  }

  addProvider (source) {
    const self = this;
    self._providers.push(source);
    source.setEngine(this);
  }

  send (payload) {
    throw new Error('Web3ProviderEngine does not support synchronous requests.');
  }

  sendAsync (payload, cb) {
    const self = this;
    self._ready.await(function () {

      if(Array.isArray(payload)) {
        //handle batch
        map(payload, self._handleAsync.bind(self), cb);
      }else {
        //handle single
        self._handleAsync(payload, cb);
      }

    });
  }

  //private
  _handleAsync (payload, finished) {
    var self = this;
    var currentProvider = -1;
    var result = null;
    var error = null;

    var stack = [];

    next();

    function next (after) {
      currentProvider += 1;
      stack.unshift(after);

      //Bubbled down as far as we could go, and the request wasn't
      //handled. Return an error.
      if(currentProvider >= self._providers.length) {
        end(new Error('Request for method "' + payload.method + '" not handled by any subprovider. Please check your subprovider configuration to ensure this method is handled.'));
      }else {
        try {
          var provider = self._providers[currentProvider];
          provider.handleRequest(payload, next, end);
        }catch (e) {
          end(e);
        }
      }
    }

    function end (_error, _result) {
      error = _error;
      result = _result;

      eachSeries(stack, function (fn, callback) {

        if(fn) {
          fn(error, result, callback);
        }else {
          callback();
        }
      }, function () {
        //console.log('COMPLETED:', payload)
        //console.log('RESULT: ', result)

        var resultObj = {
          id: payload.id,
          jsonrpc: payload.jsonrpc,
          result: result,
        };

        if(error != null) {
          resultObj.error = {
            message: error.stack || error.message || error,
            code: -32000,
          };
          //respond with both error formats
          finished(error, resultObj);
        }else {
          finished(null, resultObj);
        }
      });
    }
  }

  //
  //from remote-data
  //
  _setCurrentBlock (block) {
    const self = this;
    self.currentBlock = block;
    self.emit('block', block);
  }

  //util
  toBufferBlock (jsonBlock) {
    return {
      number: ethUtil.toBuffer(jsonBlock.number),
      hash: ethUtil.toBuffer(jsonBlock.hash),
      parentHash: ethUtil.toBuffer(jsonBlock.parentHash),
      nonce: ethUtil.toBuffer(jsonBlock.nonce),
      sha3Uncles: ethUtil.toBuffer(jsonBlock.sha3Uncles),
      logsBloom: ethUtil.toBuffer(jsonBlock.logsBloom),
      transactionsRoot: ethUtil.toBuffer(jsonBlock.transactionsRoot),
      stateRoot: ethUtil.toBuffer(jsonBlock.stateRoot),
      receiptsRoot: ethUtil.toBuffer(jsonBlock.receiptRoot || jsonBlock.receiptsRoot),
      miner: ethUtil.toBuffer(jsonBlock.miner),
      difficulty: ethUtil.toBuffer(jsonBlock.difficulty),
      totalDifficulty: ethUtil.toBuffer(jsonBlock.totalDifficulty),
      size: ethUtil.toBuffer(jsonBlock.size),
      extraData: ethUtil.toBuffer(jsonBlock.extraData),
      gasLimit: ethUtil.toBuffer(jsonBlock.gasLimit),
      gasUsed: ethUtil.toBuffer(jsonBlock.gasUsed),
      timestamp: ethUtil.toBuffer(jsonBlock.timestamp),
      transactions: jsonBlock.transactions,
    };
  }
}

export default Web3ProviderEngine;
