const test = require('tape')
const BlockTracker = require('../block-tracker.js')
const ProviderEngine = require('../index.js')
const Passthrough = require('./util/passthrough.js')
const Fixture = require('../subproviders/fixture.js')
const TestBlockProvider = require('./util/block.js')
const createPayload = require('../util/create-payload.js')
const injectMetrics = require('./util/inject-metrics')


test('fallthrough test', function(t){
  t.plan(6)

  // handle nothing
  var providerA = injectMetrics(new Passthrough())
  // handle "test_rpc"
  var providerB = injectMetrics(new Fixture({ test_rpc: true }))

  var engine = new ProviderEngine()
  engine.use(providerA)
  engine.use(providerB)

  engine.sendAsync(createPayload({ method: 'test_rpc' }), function(err, response){
    t.ifError(err, 'did not error')
    t.ok(response, 'has response')

    t.equal(providerA.getWitnessed('test_rpc').length, 1, 'providerA did see "test_rpc"')
    t.equal(providerA.getHandled('test_rpc').length, 0, 'providerA did NOT handle "test_rpc"')

    t.equal(providerB.getWitnessed('test_rpc').length, 1, 'providerB did see "test_rpc"')
    t.equal(providerB.getHandled('test_rpc').length, 1, 'providerB did handle "test_rpc"')

    t.end()
  })

})
