const async = require('async')
const inherits = require('util').inherits
const Stoplight = require('../util/stoplight.js')
const createVm = require('ethereumjs-vm/lib/hooked').fromWeb3Provider
const Block = require('ethereumjs-block')
const FakeTransaction = require('ethereumjs-tx/fake.js')
const ethUtil = require('ethereumjs-util')
const createPayload = require('../util/create-payload.js')
const Subprovider = require('./subprovider.js')

module.exports = VmSubprovider

// handles the following RPC methods:
//   eth_call
//   eth_estimateGas


inherits(VmSubprovider, Subprovider)

function VmSubprovider(opts){
  const self = this
  self.opts = opts || {};
  self.methods = ['eth_call', 'eth_estimateGas']
  // set initialization blocker
  self._ready = new Stoplight()
}

// setup a block listener on 'setEngine'
VmSubprovider.prototype.setEngine = function(engine) {
  const self = this
  Subprovider.prototype.setEngine.call(self, engine)
  // unblock initialization after first block
  engine.once('block', function(block) {
    self._ready.go()
  })
}

VmSubprovider.prototype.handleRequest = function(payload, next, end) {
  if (this.methods.indexOf(payload.method) < 0) {
    return next()
  }

  const self = this
  // console.log('VmSubprovider - runVm init', arguments)
  self.runVm(payload, function(err, results){
    // console.log('VmSubprovider - runVm return', arguments)
    if (err) return end(err)

    switch (payload.method) {

      case 'eth_call':
        var result = '0x'
        if (!results.error && results.vm.return) {
          // console.log(results.vm.return.toString('hex'))
          result = ethUtil.addHexPrefix(results.vm.return.toString('hex'))
        }
        return end(null, result)

      case 'eth_estimateGas':
        // since eth_estimateGas is just eth_call with
        // a different part of the results,
        // I considered transforming request to eth_call
        // to reduce the cache area, but we'd need to store
        // the full vm result somewhere, instead of just
        // the return value. so instead we just run it again.

        var result = ethUtil.addHexPrefix(results.gasUsed.toString('hex'))
        return end(null, result)

    }
  })
}

VmSubprovider.prototype.runVm = function(payload, cb){
  const self = this

  var blockData = self.currentBlock
  var block = blockFromBlockData(blockData)
  var blockNumber = ethUtil.addHexPrefix(blockData.number.toString('hex'))

  // create vm with state lookup intercepted
  var vm = self.vm = createVm(self.engine, blockNumber, {
    enableHomestead: true
  })

  if (self.opts.debug) {
    vm.on('step', function (data) {
      console.log(data.opcode.name)
    })
  }

  // create tx
  var txParams = payload.params[0]
  // console.log('params:', payload.params)

  var tx = new FakeTransaction({
    to: txParams.to ? ethUtil.addHexPrefix(txParams.to) : undefined,
    from: txParams.from ? ethUtil.addHexPrefix(txParams.from) : undefined,
    value: txParams.value ? ethUtil.addHexPrefix(txParams.value) : undefined,
    data: txParams.data ? ethUtil.addHexPrefix(txParams.data) : undefined,
    gasLimit: txParams.gas ? ethUtil.addHexPrefix(txParams.gas) : block.header.gasLimit,
    gasPrice: txParams.gasPrice ? ethUtil.addHexPrefix(txParams.gasPrice) : undefined,
    nonce: txParams.nonce ? ethUtil.addHexPrefix(txParams.nonce) : undefined,
  })

  vm.runTx({
    tx: tx,
    block: block,
    skipNonce: true,
    skipBalance: true
  }, function(err, results) {
    if (err) return cb(err)
    if (results.error != null) {
      return cb(new Error("VM error: " + results.error))
    }
    if (results.vm && results.vm.exception !== 1) {
      return cb(new Error("VM Exception while executing " + payload.method + ": " + results.vm.exceptionError))
    }

    cb(null, results)
  })

}

function blockFromBlockData(blockData){
  var block = new Block()
  // block.header.hash = ethUtil.addHexPrefix(blockData.hash.toString('hex'))

  block.header.parentHash = blockData.parentHash
  block.header.uncleHash = blockData.sha3Uncles
  block.header.coinbase = blockData.miner
  block.header.stateRoot = blockData.stateRoot
  block.header.transactionTrie = blockData.transactionsRoot
  block.header.receiptTrie = blockData.receiptRoot || blockData.receiptsRoot
  block.header.bloom = blockData.logsBloom
  block.header.difficulty = blockData.difficulty
  block.header.number = blockData.number
  block.header.gasLimit = blockData.gasLimit
  block.header.gasUsed = blockData.gasUsed
  block.header.timestamp = blockData.timestamp
  block.header.extraData = blockData.extraData
  return block
}
