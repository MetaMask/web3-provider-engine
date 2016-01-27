const test = require('tape')
const ProviderEngine = require('../index.js')
const StaticProvider = require('../subproviders/static.js')
const CacheProvider = require('../subproviders/cache.js')
const TestBlockProvider = require('./util/block.js')
const createPayload = require('../util/create-payload.js')
const injectMetrics = require('./util/inject-metrics')


test('cache - block cache', function(t){
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

  // first request
  engine.sendAsync(createPayload({ method: 'eth_getBalance' }), function(err, response){
    t.notOk(err, 'did not error')
    t.ok(response, 'has response')

    t.equal(cacheProvider.getWitnessed('eth_getBalance').length, 1, 'cacheProvider did see "eth_getBalance"')
    t.equal(cacheProvider.getHandled('eth_getBalance').length, 0, 'cacheProvider did NOT handle "eth_getBalance"')
    
    t.equal(dataProvider.getWitnessed('eth_getBalance').length, 1, 'dataProvider did see "eth_getBalance"')
    t.equal(dataProvider.getHandled('eth_getBalance').length, 1, 'dataProvider did handle "eth_getBalance"')

    // second request
    engine.sendAsync(createPayload({ method: 'eth_getBalance' }), function(err, response){
      t.notOk(err, 'did not error')
      t.ok(response, 'has response')

      t.equal(cacheProvider.getWitnessed('eth_getBalance').length, 2, 'cacheProvider did see "eth_getBalance"')
      t.equal(cacheProvider.getHandled('eth_getBalance').length, 1, 'cacheProvider did NOT handle "eth_getBalance"')
      
      t.equal(dataProvider.getWitnessed('eth_getBalance').length, 1, 'dataProvider did see "eth_getBalance"')
      t.equal(dataProvider.getHandled('eth_getBalance').length, 1, 'dataProvider did handle "eth_getBalance"')

      engine.stop()
      t.end()
    })
    
  })

})
