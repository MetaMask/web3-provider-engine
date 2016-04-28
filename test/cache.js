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
