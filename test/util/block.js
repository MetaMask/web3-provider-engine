const inherits = require('util').inherits
const extend = require('xtend')
const ethUtil = require('ethereumjs-util')
const FixtureProvider = require('../../subproviders/fixture.js')

module.exports = TestBlockProvider

//
// handles only `eth_getBlockByNumber` requests
// returns a dummy block
//

inherits(TestBlockProvider, FixtureProvider)
function TestBlockProvider(methods){
  const self = this
  self._blockChain = {}
  self._pendingTxs = []
  self.nextBlock()
  FixtureProvider.call(self, {
    eth_getBlockByNumber: function(payload, next, end){
      const blockRef = payload.params[0]
      let result
      if (blockRef === 'latest') {
        result = self._currentBlock
      } else {
        result = self._blockChain[blockRef]
      }
      
      end(null, result)
    },
    eth_getLogs: function(payload, next, end){
      end(null, self._currentBlock.transactions)
    },
  })
}

// class methods
TestBlockProvider.createBlock = createBlock
TestBlockProvider.incrementHex = incrementHex

TestBlockProvider.prototype.nextBlock = function(blockParams){
  const self = this
  const newBlock = createBlock(blockParams, self._currentBlock, self._pendingTxs)
  self._pendingTxs = []
  self._currentBlock = newBlock
  self._blockChain[newBlock.number] = newBlock
  return self._currentBlock
}

TestBlockProvider.prototype.addTx = function(txParams){
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
  self._pendingTxs.push(newTx)
  return newTx
}

function createBlock(blockParams, prevBlock, txs) {
  blockParams = blockParams || {}
  txs = txs || []
  var defaultNumber = prevBlock ? incrementHex(prevBlock.number) : '0x01'
  var defaultGasLimit = ethUtil.intToHex(4712388)
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
    receiptsRoot:      randomHash(),
    miner:             randomHash(),
    difficulty:        randomHash(),
    totalDifficulty:   randomHash(),
    size:              randomHash(),
    extraData:         randomHash(),
    gasLimit:          defaultGasLimit,
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
