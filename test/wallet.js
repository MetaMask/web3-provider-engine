const test = require('tape')
const Transaction = require('ethereumjs-tx')
const ethUtil = require('ethereumjs-util')
const ProviderEngine = require('../index.js')
const FixtureProvider = require('../subproviders/fixture.js')
const NonceTracker = require('../subproviders/nonce-tracker.js')
const HookedWalletProvider = require('../subproviders/hooked-wallet.js')
const HookedWalletTxProvider = require('../subproviders/hooked-wallet-ethtx.js')
const TestBlockProvider = require('./util/block.js')
const createPayload = require('../util/create-payload.js')
const injectMetrics = require('./util/inject-metrics')


test('tx sig', function(t){
  t.plan(12)

  var privateKey = new Buffer('cccd8f4d88de61f92f3747e4a9604a0395e6ad5138add4bec4a2ddf231ee24f9', 'hex')
  var address = new Buffer('1234362ef32bcd26d3dd18ca749378213625ba0b', 'hex')
  var addressHex = '0x'+address.toString('hex')
  
  // sign all tx's
  var providerA = injectMetrics(new HookedWalletProvider({
    getAccounts: function(cb){
      cb(null, [addressHex])
    },
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

    // send raw tx
    t.equal(providerC.getWitnessed('eth_sendRawTransaction').length, 1, 'providerC did see "eth_sendRawTransaction"')
    t.equal(providerC.getHandled('eth_sendRawTransaction').length, 1, 'providerC did handle "eth_sendRawTransaction"')

    engine.stop()
    t.end()
  })

})

test('no such account', function(t){
  t.plan(1)

  var addressHex = '0x1234362ef32bcd26d3dd18ca749378213625ba0b'
  var otherAddressHex = '0x4321362ef32bcd26d3dd18ca749378213625ba0c'
  
  // sign all tx's
  var providerA = injectMetrics(new HookedWalletProvider({
    getAccounts: function(cb){
      cb(null, [addressHex])
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
      from: otherAddressHex,
      to: addressHex,
      value: '0x01',
      gas: '0x1234567890',
    }]
  }

  engine.start()
  engine.sendAsync(createPayload(txPayload), function(err, response){
    t.ok(err, 'did error')

    engine.stop()
    t.end()
  })

})


test('sign message', function(t){
  t.plan(3)

  var privateKey = new Buffer('cccd8f4d88de61f92f3747e4a9604a0395e6ad5138add4bec4a2ddf231ee24f9', 'hex')
  var addressHex = '0x1234362ef32bcd26d3dd18ca749378213625ba0b'
  
  var message = 'haay wuurl'
  var signature = '0x2c865e6843caf741a694522f86281c9ee86294ade3c8cd1889c9f2c9a24e20802b2b6eb79ba49412661bdbf40245d9b01abb393a843734e5be79b38e7dd408ef1c'

  // sign all messages
  var providerA = injectMetrics(new HookedWalletTxProvider({
    getAccounts: function(cb){
      cb(null, [addressHex])
    },
    getPrivateKey: function(address, cb){
      cb(null, privateKey)
    },
  }))

  // handle block requests
  var providerB = injectMetrics(new TestBlockProvider())

  var engine = new ProviderEngine()
  engine.addProvider(providerA)
  engine.addProvider(providerB)

  var payload = {
    method: 'eth_sign',
    params: [
      addressHex,
      message,
    ],
  }

  engine.start()
  engine.sendAsync(createPayload(payload), function(err, response){
    t.ifError(err, 'did not error')
    t.ok(response, 'has response')

    t.equal(response.result, signature, 'signed response is correct')

    engine.stop()
    t.end()
  })

})

// created this test from parity's test. it fails here.
// from https://github.com/ethcore/parity/blob/810ec3558a2dd8a69a157fbcc70fc072333a1ba2/rpc/src/v1/tests/mocked/signing.rs#L186-L206
// signatureTest({
//   testLabel: 'parity',
//   method: 'personal_sign',
//   message: '0x05',
//   signature: '0x1bdb53b32e56cf3e9735377b7664d6de5a03e125b1bf8ec55715d253668b4238503b4ac931fe6af90add73e72a585e952665376b2b9afc5b6b239b7df74c734e12',
//   addressHex: '0xbe93f9bacbcffc8ee6663f2647917ed7a20a57bb',
//   privateKey: new Buffer('6969696969696969696969696969696969696969696969696969696969696969', 'hex'),
// })

// created this test from parity's test. it fails here.
// from https://github.com/ethcore/parity/blob/5369a129ae276d38f3490abb18c5093b338246e0/rpc/src/v1/tests/mocked/eth.rs#L301-L317
// signatureTest({
//   testLabel: 'parity again',
//   method: 'personal_sign',
//   message: '0x0cc175b9c0f1b6a831c399e26977266192eb5ffee6ae2fec3ad71c777531578f',
//   signature: '0x1ba2870db1d0c26ef93c7b72d2a0830fa6b841e0593f7186bc6c7cc317af8cf3a42fda03bd589a49949aa05db83300cdb553116274518dbe9d90c65d0213f4af49',
//   addressHex: '0xbe93f9bacbcffc8ee6663f2647917ed7a20a57bb',
//   privateKey: new Buffer('6969696969696969696969696969696969696969696969696969696969696969', 'hex'),
// })

// these were from 3 different versions of geth as tested from cdetrio. they fail here.

// signatureTest({
//   testLabel: 'geth type A',
//   method: 'personal_sign',
//   message: '0xdeadbeef',
//   signature: '0x39896217015e135a9636ac49281f0751be6b80cc9432f63fec97337300e83cb02a33159fd207e6675d70667dcd48ba1f7bf2862224824fc680a25d644358c1401c',
//   addressHex: '0x4898dd2725b0835bf972d9d6c8b65c59de7b3daf',
//   privateKey: new Buffer('cccd8f4d88de61f92f3747e4a9604a0395e6ad5138add4bec4a2ddf231ee24f9', 'hex'),
// })

// signatureTest({
//   testLabel: 'geth type B',
//   method: 'personal_sign',
//   message: '0xdeadbeef',
//   signature: '0x06922a82f77aae5cba3ac3e24ad84c8e02381f939530c1ecceefe4d59f99f00010ec66f2e7962a51efb3bde07d20af2e0067b1be70d352fbe6c756ee6a4a07ab1c',
//   addressHex: '0x4898dd2725b0835bf972d9d6c8b65c59de7b3daf',
//   privateKey: new Buffer('cccd8f4d88de61f92f3747e4a9604a0395e6ad5138add4bec4a2ddf231ee24f9', 'hex'),
// })

// I got this data from here. it also fails.
// https://github.com/cdetrio/interfaces/blob/f7b1da63b2ee059f4782ffaf4ccd48a16a8b0d3f/rpc-specs-tests/tests/eth_sign.json#L12-L32

// signatureTest({
//   testLabel: 'geth type C',
//   method: 'personal_sign',
//   message: '0xdeadbeef',
//   signature: '0xec39733b153542268d8f057ebd853b6a0f2f2ebd5a22b7e34a0d6a4bac1d04ad7346e51c8b03b83973f4a492d04487cebfaaa20065b5ad2a4a826fa9bd72b56e1c',
//   addressHex: '0x4898dd2725b0835bf972d9d6c8b65c59de7b3daf',
//   privateKey: new Buffer('cccd8f4d88de61f92f3747e4a9604a0395e6ad5138add4bec4a2ddf231ee24f9', 'hex'),
// })


// I made a script out of geth's internals to create this test data
// https://gist.github.com/kumavis/461d2c0e9a04ea0818e423bb77e3d260

signatureTest({
  testLabel: 'geth kumavis manual I',
  method: 'personal_sign',
  // "hello world"
  message: '0x68656c6c6f20776f726c64',
  signature: '0xce909e8ea6851bc36c007a0072d0524b07a3ff8d4e623aca4c71ca8e57250c4d0a3fc38fa8fbaaa81ead4b9f6bd03356b6f8bf18bccad167d78891636e1d69561b',
  addressHex: '0xbe93f9bacbcffc8ee6663f2647917ed7a20a57bb',
  privateKey: new Buffer('6969696969696969696969696969696969696969696969696969696969696969', 'hex'),
})

signatureTest({
  testLabel: 'geth kumavis manual II',
  method: 'personal_sign',
  // message from parity's test - note result is different than what they are testing against
  // https://github.com/ethcore/parity/blob/5369a129ae276d38f3490abb18c5093b338246e0/rpc/src/v1/tests/mocked/eth.rs#L301-L317
  message: '0x0cc175b9c0f1b6a831c399e26977266192eb5ffee6ae2fec3ad71c777531578f',
  signature: '0x9ff8350cc7354b80740a3580d0e0fd4f1f02062040bc06b893d70906f8728bb5163837fd376bf77ce03b55e9bd092b32af60e86abce48f7b8d3539988ee5a9be1c',
  addressHex: '0xbe93f9bacbcffc8ee6663f2647917ed7a20a57bb',
  privateKey: new Buffer('6969696969696969696969696969696969696969696969696969696969696969', 'hex'),
})

recoverTest({
  testLabel: 'geth kumavis manual I recover',
  method: 'personal_ecRecover',
  // "hello world"
  message: '0x68656c6c6f20776f726c64',
  signature: '0xce909e8ea6851bc36c007a0072d0524b07a3ff8d4e623aca4c71ca8e57250c4d0a3fc38fa8fbaaa81ead4b9f6bd03356b6f8bf18bccad167d78891636e1d69561b',
  addressHex: '0xbe93f9bacbcffc8ee6663f2647917ed7a20a57bb',
})

recoverTest({
  testLabel: 'geth kumavis manual II recover',
  method: 'personal_ecRecover',
  // message from parity's test - note result is different than what they are testing against
  // https://github.com/ethcore/parity/blob/5369a129ae276d38f3490abb18c5093b338246e0/rpc/src/v1/tests/mocked/eth.rs#L301-L317
  message: '0x0cc175b9c0f1b6a831c399e26977266192eb5ffee6ae2fec3ad71c777531578f',
  signature: '0x9ff8350cc7354b80740a3580d0e0fd4f1f02062040bc06b893d70906f8728bb5163837fd376bf77ce03b55e9bd092b32af60e86abce48f7b8d3539988ee5a9be1c',
  addressHex: '0xbe93f9bacbcffc8ee6663f2647917ed7a20a57bb',
})




function signatureTest({ testLabel, method, privateKey, addressHex, message, signature }) {
  // sign all messages
  var providerA = injectMetrics(new HookedWalletTxProvider({
    getAccounts: function(cb){
      cb(null, [addressHex])
    },
    getPrivateKey: function(address, cb){
      cb(null, privateKey)
    },
  }))

  // handle block requests
  var providerB = injectMetrics(new TestBlockProvider())

  var engine = new ProviderEngine()
  engine.addProvider(providerA)
  engine.addProvider(providerB)

  var payload = {
    method: method,
    params: [addressHex, message],
  }

  singleRpcTest({
    testLabel: `sign message ${method} - ${testLabel}`,
    payload,
    engine,
    expectedResult: signature,
  })
}

function recoverTest({ testLabel, method, addressHex, message, signature }) {

  // sign all messages
  var providerA = injectMetrics(new HookedWalletTxProvider({
    getAccounts: function(cb){
      cb(null, [addressHex])
    },
    getPrivateKey: function(address, cb){
      cb(null, privateKey)
    },
  }))

  // handle block requests
  var blockProvider = injectMetrics(new TestBlockProvider())

  var engine = new ProviderEngine()
  engine.addProvider(providerA)
  engine.addProvider(blockProvider)

  var payload = {
    method: method,
    params: [message, signature],
  }

  singleRpcTest({
    testLabel: `recover message ${method} - ${testLabel}`,
    payload,
    engine,
    expectedResult: addressHex,
  })

}

function singleRpcTest({ testLabel, payload, expectedResult, engine }) {
  test(testLabel, function(t){
    t.plan(3)

    engine.start()
    engine.sendAsync(createPayload(payload), function(err, response){
      if (err) {
        console.log('bad payload:', payload)
        console.error(err)
      }
      t.ifError(err)
      t.ok(response, 'has response')

      t.equal(response.result, expectedResult, 'rpc result is as expected')

      engine.stop()
      t.end()
    })

  })
}


test('sender validation, with mixed-case', function(t){
  t.plan(1)

  var senderAddress = '0xE4660fdAb2D6Bd8b50C029ec79E244d132c3bc2B'

  var providerA = injectMetrics(new HookedWalletTxProvider({
    getAccounts: function(cb){
      cb(null, [senderAddress])
    },
    getPrivateKey: function(address, cb){
      t.pass('correctly validated sender')
      engine.stop()
      t.end()
    },
  }))
  var providerB = injectMetrics(new TestBlockProvider())
  // handle all bottom requests
  var providerC = injectMetrics(new FixtureProvider({
    eth_gasPrice: '0x1234',
    eth_estimateGas: '0x1234',
    eth_getTransactionCount: '0x00',
  }))

  var engine = new ProviderEngine()
  engine.addProvider(providerA)
  engine.addProvider(providerB)
  engine.addProvider(providerC)

  engine.start()
  engine.sendAsync({
    method: 'eth_sendTransaction',
    params: [{
      from: senderAddress.toLowerCase(),
    }]
  }, function(err){
    t.notOk(err, 'error was present')
    engine.stop()
    t.end()
  })

})