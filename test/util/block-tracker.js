const inherits = require('util').inherits
const EventEmitter = require('events').EventEmitter
const extend = require('xtend')
const ethUtil = require('ethereumjs-util')

module.exports = FakeBlockTracker


inherits(FakeBlockTracker, EventEmitter)
function FakeBlockTracker(){
  const self = this
  EventEmitter.call(self)
  self.currentBlock = createBlock()
  self.pendingTxs = []
}

FakeBlockTracker.prototype.nextBlock = function(blockParams){
  const self = this
  var newBlock = createBlock(blockParams, self.currentBlock, self.pendingTxs)
  self.currentBlock = newBlock
  self.pendingTxs = []
  self.emit('block', newBlock)
  return newBlock
}

FakeBlockTracker.prototype.addTx = function(txParams){
  const self = this
  var newTx = extend({
    // defaults
    address: randomHash(),
    topics: [
      randomHash(),
      randomHash(),
      randomHash()
    ],
    data: randomHash(),
    blockNumber: '0xdeadbeef',
    logIndex: '0xdeadbeef',
    blockHash: '0x7c337eac9e3ec7bc99a1d911d326389558c9086afca7480a19698a16e40b2e0a',
    transactionHash: '0xd81da851bd3f4094d52cb86929e2ea3732a60ba7c184b853795fc5710a68b5fa',
    transactionIndex: '0x0'
    // provided
  }, txParams)
  self.pendingTxs.push(newTx)
  return newTx
}

// util

function createBlock(blockParams, prevBlock, txs) {
  blockParams = blockParams || {}
  txs = txs || []
  var defaultNumber = prevBlock ? incrementHex(prevBlock.number) : '0x01'
  return extend({
    // defaults
    number:            defaultNumber,
    hash:              randomHash(),
    parentHash:        prevBlock ? prevBlock.hash : randomHash(),
    nonce:             randomHash(),
    sha3Uncles:        randomHash(),
    logsBloom:         randomHash(),
    transactionsRoot:  randomHash(),
    stateRoot:         randomHash(),
    receiptRoot:       randomHash(),
    miner:             randomHash(),
    difficulty:        randomHash(),
    totalDifficulty:   randomHash(),
    size:              randomHash(),
    extraData:         randomHash(),
    gasLimit:          randomHash(),
    gasUsed:           randomHash(),
    timestamp:         randomHash(),
    transactions:      txs,
    // provided
  }, blockParams)
}

function incrementHex(hexString){
  return ethUtil.intToHex(Number(hexString)+1)
}

function randomHash(){
  return ethUtil.intToHex(Math.floor(Math.random()*Number.MAX_SAFE_INTEGER))
}
