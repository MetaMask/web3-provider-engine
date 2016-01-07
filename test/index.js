const test = require('tape')
const ProviderEngine = require('../index.js')
const TestingProvider = require('./util.js').TestingProvider
const BlockTestingProvider = require('./util.js').BlockTestingProvider
const createPayload = require('../util/create-payload.js')


test('fall-through test', function(t){
  t.plan(8)

  // handle nothing
  var providerA = new TestingProvider([])
  // handle "test_rpc"
  var providerB = new TestingProvider(['test_rpc'])
  // handle all
  var providerC = new BlockTestingProvider()

  var engine = new ProviderEngine()
  engine.addProvider(providerA)
  engine.addProvider(providerB)
  engine.addProvider(providerC)

  engine.start()
  engine.sendAsync(createPayload({ method: 'test_rpc' }), function(err, response){
    t.notOk(err, 'did not error')
    t.ok(response, 'has response')

    t.equal(providerA.getWitnessed('test_rpc').length, 1, 'providerA did see "test_rpc"')
    t.equal(providerA.getHandled('test_rpc').length, 0, 'providerA did NOT handle "test_rpc"')
    
    t.equal(providerB.getWitnessed('test_rpc').length, 1, 'providerB did see "test_rpc"')
    t.equal(providerB.getHandled('test_rpc').length, 1, 'providerB did handle "test_rpc"')
    
    t.equal(providerC.getWitnessed('test_rpc').length, 0, 'providerC did NOT see "test_rpc"')
    t.equal(providerC.getHandled('test_rpc').length, 0, 'providerC did NOT handle "test_rpc"')

    engine.stop()
    t.end()
  })

})


