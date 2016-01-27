const inherits = require('util').inherits
const StaticProvider = require('../../subproviders/static.js')

module.exports = TestBlockProvider

//
// handles only `eth_getBlockByNumber` requests
// returns a dummy block
//

inherits(TestBlockProvider, StaticProvider)
function TestBlockProvider(methods){
  const self = this
  StaticProvider.call(self, {
    eth_getBlockByNumber: createDummyBlock(),
  })
}

function createDummyBlock(number) {
  return {
    number: number || '0x0001',
    hash: '0x1234',
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