const test = require('tape')
const ProviderEngine = require('../index.js')
const FixtureProvider = require('../subproviders/fixture.js')
const CacheProvider = require('../subproviders/cache.js')
const TestBlockProvider = require('./util/block.js')
const createPayload = require('../util/create-payload.js')
const injectMetrics = require('./util/inject-metrics')

cacheTest('getBalance + undefined blockTag', {
  method: 'eth_getBalance',
  params: ['0x1234'],
}, true)

cacheTest('getBalance + latest blockTag', {
  method: 'eth_getBalance',
  params: ['0x1234', 'latest'],
}, true)

cacheTest('getBalance + pending blockTag', {
  method: 'eth_getBalance',
  params: ['0x1234', 'pending'],
}, false)

cacheTest("getTransactionByHash for transaction that doesn't exist", {
  method: 'eth_getTransactionByHash',
  params: ['0x00000000000000000000000000000000000000000000000000deadbeefcafe00'],
}, false)

cacheTest("getTransactionByHash for transaction that's pending", {
  method: 'eth_getTransactionByHash',
  params: ['0x00000000000000000000000000000000000000000000000000deadbeefcafe01'],
}, false)

cacheTest('getTransactionByHash for mined transaction', {
  method: 'eth_getTransactionByHash',
  params: ['0x00000000000000000000000000000000000000000000000000deadbeefcafe02'],
}, true)


function cacheTest(label, payload, shouldCache){

  test('cache - '+label, function(t){
    t.plan(12)

    // cache layer
    var cacheProvider = injectMetrics(new CacheProvider())
    // handle balance
    var dataProvider = injectMetrics(new FixtureProvider({
      eth_getBalance: '0xdeadbeef',
      eth_getTransactionByHash: function(payload, next, end) {
        // Test; meant to represent a pending trasnaction
        if (payload.params[0] == "0x00000000000000000000000000000000000000000000000000deadbeefcafe00") {
          end(null, null)
        } else if (payload.params[0] == "0x00000000000000000000000000000000000000000000000000deadbeefcafe01") {
          end(null, {
            "hash": "0x00000000000000000000000000000000000000000000000000deadbeefcafe01",
            "nonce": "0xd",
            "blockHash": null,
            "blockNumber": null,
            "transactionIndex": null,
            "from": "0xb1cc05ab12928297911695b55ee78c1188f8ef91",
            "to": "0xfbb1b73c4f0bda4f67dca266ce6ef42f520fbb98",
            "value": "0xddb66b2addf4800",
            "gas": "0x5622",
            "gasPrice": "0xba43b7400",
            "input": "0x"
          });
        } else {
          end(null, {
            "hash": payload.params[0],
            "nonce": "0xd",
            "blockHash": "0x1",
            "blockNumber": "0x1",
            "transactionIndex": "0x0",
            "from": "0xb1cc05ab12928297911695b55ee78c1188f8ef91",
            "to": "0xfbb1b73c4f0bda4f67dca266ce6ef42f520fbb98",
            "value": "0xddb66b2addf4800",
            "gas": "0x5622",
            "gasPrice": "0xba43b7400",
            "input": "0x"
          })
        }
      }
    }))
    // handle dummy block
    var blockProvider = injectMetrics(new TestBlockProvider())

    var engine = new ProviderEngine()
    engine.addProvider(cacheProvider)
    engine.addProvider(dataProvider)
    engine.addProvider(blockProvider)

    engine.start()

    cacheCheck(t, engine, cacheProvider, dataProvider, payload, function(err, response){
      engine.stop()
      t.end()
    })

    function cacheCheck(t, engine, cacheProvider, dataProvider, payload, cb){
      var method = payload.method
      requestTwice(payload, function(err, response){
        // first request
        t.ifError(err || response.error, 'did not error')
        t.ok(response, 'has response')

        t.equal(cacheProvider.getWitnessed(method).length, 1, 'cacheProvider did see "'+method+'"')
        t.equal(cacheProvider.getHandled(method).length, 0, 'cacheProvider did NOT handle "'+method+'"')

        t.equal(dataProvider.getWitnessed(method).length, 1, 'dataProvider did see "'+method+'"')
        t.equal(dataProvider.getHandled(method).length, 1, 'dataProvider did handle "'+method+'"')

      }, function(err, response){
        // second request
        t.notOk(err || response.error, 'did not error')
        t.ok(response, 'has response')

        if (shouldCache == true) {
          t.equal(cacheProvider.getWitnessed(method).length, 2, 'cacheProvider did see "'+method+'"')
          t.equal(cacheProvider.getHandled(method).length, 1, 'cacheProvider did handle "'+method+'"')

          t.equal(dataProvider.getWitnessed(method).length, 1, 'dataProvider did NOT see "'+method+'"')
          t.equal(dataProvider.getHandled(method).length, 1, 'dataProvider did NOT handle "'+method+'"')
        } else {
          t.equal(cacheProvider.getWitnessed(method).length, 2, 'cacheProvider did see "'+method+'"')
          t.equal(cacheProvider.getHandled(method).length, 0, 'cacheProvider did handle "'+method+'"')

          t.equal(dataProvider.getWitnessed(method).length, 2, 'dataProvider did NOT see "'+method+'"')
          t.equal(dataProvider.getHandled(method).length, 2, 'dataProvider did NOT handle "'+method+'"')
        }

        cb()
      })
    }

    function requestTwice(payload, afterFirst, afterSecond){
      engine.sendAsync(createPayload(payload), function(err, result){
        afterFirst(err, result)
        engine.sendAsync(createPayload(payload), afterSecond)
      })
    }

  })

}
