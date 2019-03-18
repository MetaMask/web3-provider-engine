const crypto = require('crypto')
const extend = require('xtend')
const ethUtil = require('ethereumjs-util')
const FixtureProvider = require('../../subproviders/fixture.js')

//
// handles only `eth_getBlockByNumber` requests
// returns a dummy block
//

class TestBlockProvider extends FixtureProvider {

  constructor (methods) {
    super({
      eth_blockNumber: (payload,  next, end) => {
        const blockNumber = this._currentBlock.number
        // return result asynchronously
        setTimeout(() => end(null, blockNumber))
      },
      eth_getBlockByNumber: (payload,  next, end) => {
        const blockRef = payload.params[0]
        const result = this.getBlockByRef(blockRef)
        // return result asynchronously
        setTimeout(() => end(null, result))
      },
      eth_getLogs: (payload,  next, end) => {
        const transactions = this._currentBlock.transactions
        const logs = transactions.map((tx) => {
          return {
            address: tx._logAddress,
            blockNumber: tx.blockNumber,
            blockHash: tx.blockHash,
            data: tx._logData,
            logIndex: tx.transactionIndex,
            topics: tx._logTopics,
            transactionIndex: tx.transactionIndex,
            transactionHash: tx.hash,
          }
        })
        // return result asynchronously
        setTimeout(() => end(null, logs))
      },
    })
    this._blockChain = {}
    this._pendingTxs = []
    this.nextBlock()
  }

  getBlockByRef (blockRef) {
    const self = this
    if (blockRef === 'latest') {
      return self._currentBlock
    } else {
      const blockNumber = parseInt(blockRef, 16)
      // if present, return block at reference
      let block = self._blockChain[blockNumber]
      if (block) return block
      // check if we should create the new block
      if (blockNumber > Number(self._currentBlock.number)) return
      // create, store, and return the new block
      block = createBlock({ number: blockRef })
      self._blockChain[blockNumber] = block
      return block
    }
  }

  nextBlock (blockParams) {
    const self = this
    const newBlock = createBlock(blockParams, self._currentBlock, self._pendingTxs)
    const blockNumber = parseInt(newBlock.number, 16)
    self._pendingTxs = []
    self._currentBlock = newBlock
    self._blockChain[blockNumber] = newBlock
    return newBlock
  }

  addTx (txParams) {
    const self = this
    var newTx = extend({
      hash: randomHash(),
      data: randomHash(),
      transactionHash: randomHash(),
      // set later
      blockNumber: null,
      blockHash: null,
      transactionIndex: null,
      // hack for setting log data
      _logAddress: randomAddress(),
      _logData: randomHash(),
      _logTopics: [
        randomHash(),
        randomHash(),
        randomHash()
      ],
      // provided
    }, txParams)
    self._pendingTxs.push(newTx)
    return newTx
  }

}

// class _currentBlocks
TestBlockProvider.createBlock = createBlock
TestBlockProvider.incrementHex = incrementHex

function createBlock(blockParams, prevBlock, txs) {
  blockParams = blockParams || {}
  txs = txs || []
  var defaultNumber = prevBlock ? incrementHex(prevBlock.number) : '0x1'
  var defaultGasLimit = ethUtil.intToHex(4712388)
  const result = extend({
    // defaults
    number:            defaultNumber,
    hash:              randomHash(),
    parentHash:        prevBlock ? prevBlock.hash : randomHash(),
    nonce:             randomHash(),
    mixHash:           randomHash(),
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
  txs.forEach((tx, index) => {
    tx.blockHash = result.hash
    tx.blockNumber = result.number
    tx.transactionIndex = ethUtil.intToHex(index)
  })
  return result
}

function incrementHex(hexString){
  return stripLeadingZeroes(ethUtil.intToHex(Number(hexString)+1))
}

function randomHash(){
  return ethUtil.bufferToHex(crypto.randomBytes(32))
}

function randomAddress(){
  return ethUtil.bufferToHex(crypto.randomBytes(20))
}

function stripLeadingZeroes (hexString) {
  let strippedHex = ethUtil.stripHexPrefix(hexString)
  while (strippedHex[0] === '0') {
    strippedHex = strippedHex.substr(1)
  }
  return ethUtil.addHexPrefix(strippedHex)
}

module.exports = TestBlockProvider