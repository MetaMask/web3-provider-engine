const test = require('tape')
const asyncParallel = require('async/parallel')
const asyncSeries = require('async/series')
const createGanacheProvider = require('ganache-core').provider
const ProviderEngine = require('../index.js')
const FixtureProvider = require('../subproviders/fixture.js')
const InflightCacheProvider = require('../subproviders/inflight-cache.js')
const ProviderSubprovider = require('../subproviders/provider.js')
const createPayload = require('../util/create-payload.js')
const injectMetrics = require('./util/inject-metrics')

inflightTest('getBalance for latest', {
  method: 'eth_getBalance',
  params: ['0xabcd', 'latest'],
}, true)

inflightTest('getBlock for latest', {
  method: 'eth_getBlockByNumber',
  params: ['latest', false],
}, true)

inflightTest('getBlock for latest (1) then 0', [{
  method: 'eth_getBlockByNumber',
  params: ['latest', false],
}, {
  method: 'eth_getBlockByNumber',
  params: ['0x0', false],
}], false)

// inflight-cache does not resolve tags like "latest", so we dont know that latest === 0x1 in this case
inflightTest('getBlock for latest (1) then 1', [{
  method: 'eth_getBlockByNumber',
  params: ['latest', false],
}, {
  method: 'eth_getBlockByNumber',
  params: ['0x1', false],
}], false)

function inflightTest(label, payloads, shouldHitCacheOnSecondRequest){
  if (!Array.isArray(payloads)) {
    payloads = [payloads, payloads]
  }

  test('inflight cache - '+label, function(t){
    t.plan(6)

    // cache layer
    var cacheProvider = injectMetrics(new InflightCacheProvider())
    // handle balance
    var dataProvider = injectMetrics(new FixtureProvider({
      eth_getBalance: '0xdeadbeef',
    }))
    // handle dummy block
    const ganacheProvider = createGanacheProvider()
    var blockProvider = injectMetrics(new ProviderSubprovider(ganacheProvider))

    var engine = new ProviderEngine()
    engine.addProvider(cacheProvider)
    engine.addProvider(dataProvider)
    engine.addProvider(blockProvider)

    asyncSeries([
      // increment one block from #0 to #1
      (next) => ganacheProvider.sendAsync({ id: 1, method: 'evm_mine', params: [] }, next),
      // run polling until first block
      (next) => {
        engine.start()
        engine.once('block', () => next())
      },
      // perform test
      (next) => {
        // stop polling
        engine.stop()
        // clear subprovider metrics
        cacheProvider.clearMetrics()
        dataProvider.clearMetrics()
        blockProvider.clearMetrics()

        // determine which provider will handle the request
        const isBlockTest = (payloads[0].method === 'eth_getBlockByNumber')
        const handlingProvider = isBlockTest ? blockProvider : dataProvider

        // begin cache test
        cacheCheck(t, engine, cacheProvider, handlingProvider, payloads, next)
      },
    ], (err) => {
      t.ifErr(err)
      t.end()
    })

    function cacheCheck(t, engine, cacheProvider, handlingProvider, payloads, cb) {
      var method = payloads[0].method
      requestSimultaneous(payloads, noop, noop, function(err, responses){
        // first request
        t.ifError(err, 'did not error')
        t.ok(responses && responses.filter(Boolean).length, 'has responses')

        if (shouldHitCacheOnSecondRequest) {

          t.equal(cacheProvider.getWitnessed(method).length, 2, 'cacheProvider did see "'+method+'"')
          t.equal(cacheProvider.getHandled(method).length, 1, 'cacheProvider did NOT handle "'+method+'"')

          t.equal(handlingProvider.getWitnessed(method).length, 1, 'handlingProvider did see "'+method+'"')
          t.equal(handlingProvider.getHandled(method).length, 1, 'handlingProvider did handle "'+method+'"')
        
        } else {

          t.equal(cacheProvider.getWitnessed(method).length, 2, 'cacheProvider did see "'+method+'"')
          t.equal(cacheProvider.getHandled(method).length, 0, 'cacheProvider did NOT handle "'+method+'"')

          t.equal(handlingProvider.getWitnessed(method).length, 2, 'handlingProvider did see "'+method+'"')
          t.equal(handlingProvider.getHandled(method).length, 2, 'handlingProvider did handle "'+method+'"')

        }

      })
    }

    function requestSimultaneous(payloads, afterFirst, afterSecond, cb){
      asyncParallel([
        (cb) => {
          engine.sendAsync(createPayload(payloads[0]), (err, result) => {
            afterFirst(err, result)
            cb(err, result)
          })
        },
        (cb) => {
          engine.sendAsync(createPayload(payloads[1]), (err, result) => {
            afterSecond(err, result)
            cb(err, result)
          })
        },
      ], cb)
    }
  })

}

function noop(){}