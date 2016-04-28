const test = require('tape')
const ProviderEngine = require('../index.js')
const Scaffold = require('../lib/scaffold.js')
const CacheMiddleware = require('../lib/cache.js')
const createPayload = require('../util/create-payload.js')
const FakeBlockTracker = require('./util/block-tracker.js')
const ManipulationDetector = require('./util/manipulation.js')

// skip cache

cacheTest('skipCache parameter - true',
  { eth_getBalance: '0x1234' },
  { method: 'eth_getBalance', params: ['0x1234'], skipCache: true },
  { method: 'eth_getBalance', params: ['0x1234'], skipCache: true },
  false
)

cacheTest('skipCache parameter - false',
  { eth_getBalance: '0x1234' },
  { method: 'eth_getBalance', params: ['0x1234'], skipCache: false },
  { method: 'eth_getBalance', params: ['0x1234'], skipCache: false },
  true
)

cacheTest('skipCache parameter - undefined',
  { eth_getBalance: '0x1234' },
  { method: 'eth_getBalance', params: ['0x1234'] },
  { method: 'eth_getBalance', params: ['0x1234'] },
  true
)

// block tags

cacheTest('getBalance + undefined blockTag',
  { eth_getBalance: '0x1234' },
  { method: 'eth_getBalance', params: ['0x1234'] },
  { method: 'eth_getBalance', params: ['0x1234'] },
  true
)

cacheTest('getBalance + latest blockTag',
  { eth_getBalance: '0x1234' },
  { method: 'eth_getBalance', params: ['0x1234', 'latest'] },
  { method: 'eth_getBalance', params: ['0x1234', 'latest'] },
  true
)

cacheTest('getBalance + pending blockTag',
  { eth_getBalance: '0x1234' },
  { method: 'eth_getBalance', params: ['0x1234', 'pending'] },
  { method: 'eth_getBalance', params: ['0x1234', 'pending'] },
  false
)

// tx by hash

cacheTest('getTransactionByHash for transaction that doesn\'t exist',
  { eth_getTransactionByHash: null },
  { method: 'eth_getTransactionByHash', params: ['0x0000000000000000000000000000000000000000000000000000deadbeefcafe'] },
  { method: 'eth_getTransactionByHash', params: ['0x0000000000000000000000000000000000000000000000000000deadbeefcafe'] },
  false
)

cacheTest('getTransactionByHash for transaction that\'s pending',
  { eth_getTransactionByHash: { blockNumber: null, blockHash: null } },
  { method: 'eth_getTransactionByHash', params: ['0x0000000000000000000000000000000000000000000000000000deadbeefcafe'] },
  { method: 'eth_getTransactionByHash', params: ['0x0000000000000000000000000000000000000000000000000000deadbeefcafe'] },
  false
)

cacheTest('getTransactionByHash for mined transaction',
  { eth_getTransactionByHash: { blockNumber: '0x1234', blockHash: '0x1234' } },
  { method: 'eth_getTransactionByHash', params: ['0x0000000000000000000000000000000000000000000000000000deadbeefcafe'] },
  { method: 'eth_getTransactionByHash', params: ['0x0000000000000000000000000000000000000000000000000000deadbeefcafe'] },
  true
)

// code

cacheTest('getCode for latest block, then for earliest block, should not return cached response on second request',
  { eth_getCode: '0x1234' },
  { method: 'eth_getCode', params: ['0x1234', 'latest'] },
  { method: 'eth_getCode', params: ['0x1234', 'earliest'] },
  false
)

cacheTest('getCode for a specific block, then for the one before it, should not return cached response on second request',
  { eth_getCode: '0x1234' },
  { method: 'eth_getCode', params: ['0x1234', '0x3'] },
  { method: 'eth_getCode', params: ['0x1234', '0x2'] },
  false
)

cacheTest('getCode for a specific block, then the one after it, should return cached response on second request',
  { eth_getCode: '0x1234' },
  { method: 'eth_getCode', params: ['0x1234', '0x2'] },
  { method: 'eth_getCode', params: ['0x1234', '0x3'] },
  true
)

cacheTest('getCode for an unspecified block, then for the latest, should return cached response on second request',
  { eth_getCode: '0x1234' },
  { method: 'eth_getCode', params: ['0x1234'] },
  { method: 'eth_getCode', params: ['0x1234', 'latest'] },
  true
)

function cacheTest(label, staticData, req1, req2, cacheShouldHit){

  test('cache - '+label, function(t){
    t.plan(6)

    // setup stack
    var engine = new ProviderEngine()
    var blockTracker = new FakeBlockTracker()
    var manipulationDetector = ManipulationDetector()
    engine.use(manipulationDetector)
    engine.use(CacheMiddleware(blockTracker))
    engine.use(manipulationDetector)
    engine.use(Scaffold(staticData))

    // unblock cache middleware
    blockTracker.nextBlock()

    // first request
    engine.sendAsync(createPayload(req1), function(err, res){
      t.ifError(err || res.error && res.error.message, 'did not error')
      t.ok(res && res.result !== undefined, 'has response and result')
      t.equal(manipulationDetector.detected, false, 'cache was not hit')
      manipulationDetector.reset()
      // second request
      engine.sendAsync(createPayload(req2), function(err, res){
        t.ifError(err || res.error && res.error.message, 'did not error')
        t.ok(res && res.result !== undefined, 'has response and result')
        t.equal(manipulationDetector.detected, cacheShouldHit, 'cache performed as expected')
        
        if (manipulationDetector.detected !== cacheShouldHit) {
          console.log('previous:',manipulationDetector.previous)
          console.log('current:',manipulationDetector.current)
          console.log('res:',res) 
        }

        blockTracker.removeAllListeners()
        t.end()
      })
    })

  })

}

// test helper for caching
// 1. Sets up caching and data provider
// 2. Performs first request
// 3. Performs second request
// 4. checks if cache hit or missed 

// function cacheTest(label, payloads, shouldHitCacheOnSecondRequest){

//   test('cache - '+label, function(t){
//     // t.plan(12)

//     // cache layer
//     var cacheProvider = CacheMiddleware()
//     // handle balance
//     var dataProvider = Scaffold({
//       eth_getBalance: '0xdeadbeef',
//       eth_getCode: '6060604052600560005560408060156000396000f3606060405260e060020a60003504633fa4f245811460245780635524107714602c575b005b603660005481565b6004356000556022565b6060908152602090f3',
//       eth_getTransactionByHash: function(payload, next, end) {
//         // represents a pending tx
//         if (payload.params[0] === '0x00000000000000000000000000000000000000000000000000deadbeefcafe00') {
//           end(null, null)
//         } else if (payload.params[0] === '0x00000000000000000000000000000000000000000000000000deadbeefcafe01') {
//           end(null, {
//             hash: '0x00000000000000000000000000000000000000000000000000deadbeefcafe01',
//             nonce: '0xd',
//             blockHash: null,
//             blockNumber: null,
//             transactionIndex: null,
//             from: '0xb1cc05ab12928297911695b55ee78c1188f8ef91',
//             to: '0xfbb1b73c4f0bda4f67dca266ce6ef42f520fbb98',
//             value: '0xddb66b2addf4800',
//             gas: '0x5622',
//             gasPrice: '0xba43b7400',
//             input: '0x',
//           })
//         } else {
//           end(null, {
//             hash: payload.params[0],
//             nonce: '0xd',
//             blockHash: '0x1',
//             blockNumber: '0x1',
//             transactionIndex: '0x0',
//             from: '0xb1cc05ab12928297911695b55ee78c1188f8ef91',
//             to: '0xfbb1b73c4f0bda4f67dca266ce6ef42f520fbb98',
//             value: '0xddb66b2addf4800',
//             gas: '0x5622',
//             gasPrice: '0xba43b7400',
//             input: '0x',
//           })
//         }
//       }
//     })
//     // handle dummy block
//     var blockProvider = new TestBlockProvider()

//     var engine = ProviderEngine()
//     engine.use(cacheProvider)
//     engine.use(dataProvider)
//     engine.use(blockProvider)

//     engine.start()

//     cacheCheck(t, engine, cacheProvider, dataProvider, payloads, function(err, response) {
//       engine.stop()
//       t.end()
//     })

//     function cacheCheck(t, engine, cacheProvider, dataProvider, payloads, cb) {
//       if (!Array.isArray(payloads)) {
//         payloads = [payloads, payloads]
//       }

//       var method = payloads[0].method
//       requestTwice(payloads, function(err, response){
//         // first request
//         t.ifError(err || response.error && response.error.message, 'did not error')
//         t.ok(response, 'has response')

//         // t.equal(cacheProvider.getWitnessed(method).length, 1, 'cacheProvider did see "'+method+'"')
//         // t.equal(cacheProvider.getHandled(method).length, 0, 'cacheProvider did NOT handle "'+method+'"')

//         // t.equal(dataProvider.getWitnessed(method).length, 1, 'dataProvider did see "'+method+'"')
//         // t.equal(dataProvider.getHandled(method).length, 1, 'dataProvider did handle "'+method+'"')

//       }, function(err, response){
//         // second request
//         t.ifError(err || response.error && response.error.message, 'did not error')
//         t.ok(response, 'has response')

//         // if (shouldHitCacheOnSecondRequest) {
//         //   t.equal(cacheProvider.getWitnessed(method).length, 2, 'cacheProvider did see "'+method+'"')
//         //   t.equal(cacheProvider.getHandled(method).length, 1, 'cacheProvider did handle "'+method+'"')

//         //   t.equal(dataProvider.getWitnessed(method).length, 1, 'dataProvider did NOT see "'+method+'"')
//         //   t.equal(dataProvider.getHandled(method).length, 1, 'dataProvider did NOT handle "'+method+'"')
//         // } else {
//         //   t.equal(cacheProvider.getWitnessed(method).length, 2, 'cacheProvider did see "'+method+'"')
//         //   t.equal(cacheProvider.getHandled(method).length, 0, 'cacheProvider did handle "'+method+'"')

//         //   t.equal(dataProvider.getWitnessed(method).length, 2, 'dataProvider did NOT see "'+method+'"')
//         //   t.equal(dataProvider.getHandled(method).length, 2, 'dataProvider did NOT handle "'+method+'"')
//         // }

//         cb()
//       })
//     }

//     function requestTwice(payloads, afterFirst, afterSecond){
//       engine.sendAsync(createPayload(payloads[0]), function(err, result){
//         afterFirst(err, result)
//         engine.sendAsync(createPayload(payloads[1]), afterSecond)
//       })
//     }

//   })

// }
