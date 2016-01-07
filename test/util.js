const inherits = require('util').inherits
const BaseSubprovider = require('../subproviders/subprovider.js')

module.exports = {
  TestingProvider: TestingProvider,
  BlockTestingProvider: BlockTestingProvider,
}


inherits(TestingProvider, BaseSubprovider)
function TestingProvider(methods){
  const self = this
  BaseSubprovider.call(self)
  self.payloadsWitnessed = {}
  self.payloadsHandled = {}
  self.methods = methods
}

TestingProvider.prototype.handleRequest = function(payload, next, end){
  const self = this
  // witness payload
  var witnessed = self.getWitnessed(payload.method)
  witnessed.push(payload)
  // potentially handle payload
  if (!self.methods || self.methods.indexOf(payload.method) !== -1) {
    var handled = self.getHandled(payload.method)
    handled.push(payload)
    self.sendResult(payload, end)
  } else {
    next()
  }
}

TestingProvider.prototype.sendResult = function(payload, cb){
  const self = this
  var result = {
    id: payload.id,
    jsonrpc: payload.jsonrpc,
    result: {},
  }
  cb(null, result)
}

TestingProvider.prototype.getWitnessed = function(method){
  const self = this
  var witnessed = self.payloadsWitnessed[method] = self.payloadsWitnessed[method] || []
  return witnessed
}

TestingProvider.prototype.getHandled = function(method){
  const self = this
  var witnessed = self.payloadsHandled[method] = self.payloadsHandled[method] || []
  return witnessed
}


inherits(BlockTestingProvider, TestingProvider)
function BlockTestingProvider(methods){
  const self = this
  TestingProvider.call(self)
  self.currentBlockNumber = 0
}

BlockTestingProvider.prototype.sendResult = function(payload, cb){
  const self = this
  if (payload.method !== 'eth_getBlockByNumber') {
    return TestingProvider.prototype.sendResult.call(self, payload, cb)
  }

  var result = {
    number: '0x1234',
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
  cb(null, result)
}