const test = require('tape')
const ProviderEngine = require('../index.js')
const StaticProvider = require('../subproviders/static.js')
const CacheProvider = require('../subproviders/cache.js')
const TestBlockProvider = require('./util/block.js')
const createPayload = require('../util/create-payload.js')
const injectMetrics = require('./util/inject-metrics')

cacheTest('getBalance + undefined blockTag', {
  method: 'eth_getBalance',
  params: ['0x1234'],
})

cacheTest('getBalance + latest blockTag', {
  method: 'eth_getBalance',
  params: ['0x1234', 'latest'],
})

cacheTest('getBalance + pending blockTag', {
  method: 'eth_getBalance',
  params: ['0x1234', 'pending'],
})


function cacheTest(label, payload){

  test('cache - '+label, function(t){
    t.plan(12)

    // cache layer
    var cacheProvider = injectMetrics(new CacheProvider())
    // handle balance
    var dataProvider = injectMetrics(new StaticProvider({
      eth_getBalance: '0xdeadbeef',
    }))
    // handle dummy block
    var blockProvider = injectMetrics(new TestBlockProvider())

    var engine = new ProviderEngine()
    engine.addProvider(cacheProvider)
    engine.addProvider(dataProvider)
    engine.addProvider(blockProvider)

    engine.start()

    cacheCheck(t, engine, cacheProvider, dataProvider, {
      method: 'eth_getBalance',
      params: ['0x1234', 'latest'],
    }, function(err, response){
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

        t.equal(cacheProvider.getWitnessed(method).length, 2, 'cacheProvider did see "'+method+'"')
        t.equal(cacheProvider.getHandled(method).length, 1, 'cacheProvider did handle "'+method+'"')
        
        t.equal(dataProvider.getWitnessed(method).length, 1, 'dataProvider did NOT see "'+method+'"')
        t.equal(dataProvider.getHandled(method).length, 1, 'dataProvider did NOT handle "'+method+'"')

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

