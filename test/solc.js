const test = require('tape')
const ProviderEngine = require('../index.js')
const PassthroughProvider = require('./util/passthrough.js')
const FixtureProvider = require('../subproviders/fixture.js')
const SolcProvider = require('../subproviders/solc.js')
const TestBlockProvider = require('./util/block.js')
const createPayload = require('../util/create-payload.js')
const injectMetrics = require('./util/inject-metrics')
const solc = require('solc')

test('solc test', function(t){
  t.plan(10)

  // handle solc
  var providerA = injectMetrics(new SolcProvider())
  // handle block requests
  var providerB = injectMetrics(new TestBlockProvider())

  var engine = new ProviderEngine()
  engine.addProvider(providerA)
  engine.addProvider(providerB)

  var contractSource = 'contract test { function multiply(uint a) returns(uint d) {   return a * 7;   } }'

  engine.start()
  engine.sendAsync(createPayload({ method: 'eth_compileSolidity', params: [ contractSource ] }), function(err, response){
    t.ifError(err, 'did not error')
    t.ok(response, 'has response')

    t.ok(response.result.code, 'has bytecode')
    t.equal(response.result.info.source, contractSource)
    t.equal(response.result.info.compilerVersion, solc.version())
    t.ok(response.result.info.abiDefinition, 'has abiDefinition')

    t.equal(providerA.getWitnessed('eth_compileSolidity').length, 1, 'providerA did see "eth_compileSolidity"')
    t.equal(providerA.getHandled('eth_compileSolidity').length, 1, 'providerA did handle "eth_compileSolidity"')

    t.equal(providerB.getWitnessed('eth_compileSolidity').length, 0, 'providerB did NOT see "eth_compileSolidity"')
    t.equal(providerB.getHandled('eth_compileSolidity').length, 0, 'providerB did NOT handle "eth_compileSolidity"')

    engine.stop()
    t.end()
  })

})
