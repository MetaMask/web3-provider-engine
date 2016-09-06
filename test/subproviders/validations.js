const sha3 = require('ethereumjs-util').sha3;
const test = require('tape')
const ProviderEngine = require('../../index.js')
const createPayload = require('../../util/create-payload.js')
const ValidationsSubprovider = require('../../subproviders/validations')

test('throws an error for negative values', function(t) {
  t.plan(3)

  var engine = new ProviderEngine()
  var validations = new ValidationsSubprovider()

  engine.addProvider(validations)
  engine.start()

  engine.sendAsync(createPayload({
    method: 'eth_sendTransaction',
    value: '-0x1',
    params: [],
  }), function(err, response){
    t.ok(err, 'throws an error')
    t.notOk(response, 'has no response')
    t.equal(typeof response.result[0], 'string')
    t.end()
  })
})

test('resumes for non-negative values', function(t) {
  t.plan(3)

  var engine = new ProviderEngine()
  var validations = new ValidationsSubprovider()

  engine.addProvider(validations)
  engine.start()

  engine.sendAsync(createPayload({
    method: 'eth_sendTransaction',
    value: '0x1',
    params: [],
  }), function(err, response){
    t.ifError(err, 'throw no error')
    t.ok(response, 'has response')
    t.equal(typeof response.result[0], 'string')
    t.end()
  })
})
