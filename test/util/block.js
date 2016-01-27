const inherits = require('util').inherits
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
  self._currentBlock = createDummyBlock()
  FixtureProvider.call(self, {
    eth_getBlockByNumber: function(cb){
      cb(null, self._currentBlock)
    },
  })
}

TestBlockProvider.prototype.nextBlock = function(block){
  const self = this
  var number = incrementHex(self._currentBlock.number)
  self._currentBlock = block || createDummyBlock(number)
  return self._currentBlock
}

function createDummyBlock(number) {
  return {
    number: number || '0x01',
    hash: randomHash(),
    parentHash: '0x1234',
    nonce: '0x1234',
    sha3Uncles: '0x1234',
    logsBloom: '0x1234',
    transactionsRoot: '0x1234',
    stateRoot: '0x1234',
    receiptRoot: '0x1234',
    miner: '0x1234',
    difficulty: '0x1234',
    totalDifficulty: '0x1234',
    size: '0x1234',
    extraData: '0x1234',
    gasLimit: '0x1234',
    gasUsed: '0x1234',
    timestamp: '0x1234',
    transactions: [],
  }
}

function incrementHex(hexString){
  return '0x'+ethUtil.intToHex(Number(hexString)+1)
}

function randomHash(){
  return '0x'+ethUtil.intToHex(Math.floor(Math.random()*Number.MAX_SAFE_INTEGER))
}