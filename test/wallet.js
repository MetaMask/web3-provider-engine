const test = require('tape')
const Transaction = require('ethereumjs-tx')
const ethUtil = require('ethereumjs-util')
const ProviderEngine = require('../index.js')
const FixtureProvider = require('../subproviders/fixture.js')
const NonceTracker = require('../subproviders/nonce-tracker.js')
const HookedWalletProvider = require('../subproviders/hooked-wallet.js')
const TestBlockProvider = require('./util/block.js')
const createPayload = require('../util/create-payload.js')
const injectMetrics = require('./util/inject-metrics')


test('tx sig', function(t){
  t.plan(10)

  var privateKey = new Buffer('cccd8f4d88de61f92f3747e4a9604a0395e6ad5138add4bec4a2ddf231ee24f9', 'hex')
  var address = new Buffer('1234362ef32bcd26d3dd18ca749378213625ba0b', 'hex')
  var addressHex = '0x'+address.toString('hex')
  
  // sign all tx's
  var providerA = injectMetrics(new HookedWalletProvider({
    signTransaction: function(txParams, cb){
      var tx = new Transaction(txParams)
      tx.sign(privateKey)
      var rawTx = '0x'+tx.serialize().toString('hex')
      cb(null, rawTx)
    },
  }))

  // handle nonce requests
  var providerB = injectMetrics(new NonceTracker())
  // handle all bottom requests
  var providerC = injectMetrics(new FixtureProvider({
    eth_gasPrice: '0x1234',
    eth_getTransactionCount: '0x00',
    eth_sendRawTransaction: function(payload, next, done){
      var rawTx = ethUtil.toBuffer(payload.params[0])
      var tx = new Transaction(rawTx)
      var hash = '0x'+tx.hash().toString('hex')
      done(null, hash)
    },
  }))
  // handle block requests
  var providerD = injectMetrics(new TestBlockProvider())

  var engine = new ProviderEngine()
  engine.addProvider(providerA)
  engine.addProvider(providerB)
  engine.addProvider(providerC)
  engine.addProvider(providerD)

  var txPayload = {
    method: 'eth_sendTransaction',
    params: [{
      from: addressHex,
      to: addressHex,
      value: '0x01',
    }]
  }

  engine.start()
  engine.sendAsync(createPayload(txPayload), function(err, response){
    t.ifError(err, 'did not error')
    t.ok(response, 'has response')

    // intial tx request
    t.equal(providerA.getWitnessed('eth_sendTransaction').length, 1, 'providerA did see "signTransaction"')
    t.equal(providerA.getHandled('eth_sendTransaction').length, 1, 'providerA did handle "signTransaction"')

    // tx nonce
    t.equal(providerB.getWitnessed('eth_getTransactionCount').length, 1, 'providerB did see "eth_getTransactionCount"')
    t.equal(providerB.getHandled('eth_getTransactionCount').length, 0, 'providerB did NOT handle "eth_getTransactionCount"')
    t.equal(providerC.getWitnessed('eth_getTransactionCount').length, 1, 'providerC did see "eth_getTransactionCount"')
    t.equal(providerC.getHandled('eth_getTransactionCount').length, 1, 'providerC did handle "eth_getTransactionCount"')

    // gas price
    t.equal(providerC.getWitnessed('eth_gasPrice').length, 1, 'providerB did see "eth_gasPrice"')
    t.equal(providerC.getHandled('eth_gasPrice').length, 1, 'providerB did handle "eth_gasPrice"')  

    engine.stop()
    t.end()
  })

})
