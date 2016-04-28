const test = require('tape')
const ProviderEngine = require('../index.js')
const Passthrough = require('./util/passthrough.js')
const Scaffold = require('../subproviders/scaffold.js')
const createPayload = require('../util/create-payload.js')


test('basic value lookup', function(t){
  t.plan(3)

  var engine = new ProviderEngine()
  // handle nothing
  engine.use(Passthrough())
  // handle "test_rpc"
  engine.use(Scaffold({ test_rpc: 123 }))

  engine.sendAsync(createPayload({ method: 'test_rpc' }), function(err, res){
    t.ifError(err, 'did not error')
    t.ok(res, 'has response')
    
    t.equal(res.result, 123, 'got correct result')

    t.end()
  })

})

test('fallthrough implicit failure', function(t){
  t.plan(5)

  var engine = new ProviderEngine()
  // handle nothing
  engine.use(Passthrough())

  engine.sendAsync(createPayload({ method: 'fail_test' }), function(err, res){
    t.ok(err, 'did error')
    t.ok(res, 'has response')
    
    t.ok(res.error, 'response has error')
    t.equal(res.error && res.error.code, -32601, 'has correct error code' )
    t.equal(res.error && res.error.message, 'fail_test method not implemented', 'has correct error message')

    t.end()
  })

})
