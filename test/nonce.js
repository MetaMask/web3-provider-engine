import test from 'tape'
import Transaction from 'ethereumjs-tx'
import ethUtil from 'ethereumjs-util'
import ProviderEngine from '../provider-engine.js'
import FixtureProvider from '../subproviders/fixture.js'
import NonceTracker from '../subproviders/nonce-tracker.js'
import HookedWalletProvider from '../subproviders/hooked-wallet.js'
import TestBlockProvider from './util/block.js'
import createPayload from '../util/create-payload.js'
import injectMetrics from './util/inject-metrics'


test('basic nonce tracking', function(t){
  t.plan(11)

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
      gas: '0x1234567890',
    }]
  }

  engine.start()
  engine.sendAsync(createPayload(txPayload), function(err, response){
    t.ifError(err, 'did not error')
    t.ok(response, 'has response')

    // tx nonce
    t.equal(providerB.getWitnessed('eth_getTransactionCount').length, 1, 'providerB did see "eth_getTransactionCount"')
    t.equal(providerB.getHandled('eth_getTransactionCount').length, 0, 'providerB did NOT handle "eth_getTransactionCount"')
    t.equal(providerC.getWitnessed('eth_getTransactionCount').length, 1, 'providerC did see "eth_getTransactionCount"')
    t.equal(providerC.getHandled('eth_getTransactionCount').length, 1, 'providerC did handle "eth_getTransactionCount"')
    // send raw tx
    t.equal(providerC.getWitnessed('eth_sendRawTransaction').length, 1, 'providerC did see "eth_sendRawTransaction"')
    t.equal(providerC.getHandled('eth_sendRawTransaction').length, 1, 'providerC did handle "eth_sendRawTransaction"')

    engine.sendAsync(createPayload({
      method: 'eth_getTransactionCount',
      params: [addressHex, 'pending'],
    }), function(err, response){
      t.ifError(err, 'did not error')
      t.ok(response, 'has response')

      // tx nonce did increment
      t.equal(response.result, '0x01', 'the provider gives the correct pending nonce')

      engine.stop()
      t.end()

    })

  })

})


test('nonce tracking - on error', function(t){
  t.plan(11)

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
      done(new Error('Always fail.'))
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
      gas: '0x1234567890',
    }]
  }

  engine.start()
  engine.sendAsync(createPayload(txPayload), function(err, response){
    t.ok(err, 'did not error')
    t.ok(response.error, 'has response')

    // tx nonce
    t.equal(providerB.getWitnessed('eth_getTransactionCount').length, 1, 'providerB did see "eth_getTransactionCount"')
    t.equal(providerB.getHandled('eth_getTransactionCount').length, 0, 'providerB did NOT handle "eth_getTransactionCount"')
    t.equal(providerC.getWitnessed('eth_getTransactionCount').length, 1, 'providerC did see "eth_getTransactionCount"')
    t.equal(providerC.getHandled('eth_getTransactionCount').length, 1, 'providerC did handle "eth_getTransactionCount"')

    // send raw tx
    t.equal(providerC.getWitnessed('eth_sendRawTransaction').length, 1, 'providerC did see "eth_sendRawTransaction"')
    t.equal(providerC.getHandled('eth_sendRawTransaction').length, 1, 'providerC did handle "eth_sendRawTransaction"')

    engine.sendAsync(createPayload({
      method: 'eth_getTransactionCount',
      params: [addressHex, 'pending'],
    }), function(err, response){
      t.ifError(err, 'did not error')
      t.ok(response, 'has response')

      // tx nonce did NOT increment
      t.equal(response.result, '0x00', 'the provider gives the correct pending nonce')

      engine.stop()
      t.end()

    })

  })

})
