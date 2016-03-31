const test = require('tape')
const ProviderEngine = require('../../index.js')
const createPayload = require('../../util/create-payload.js')

const EtherscanSubprovider = require('../../subproviders/etherscan')

test('etherscan eth_getBlockTransactionCountByNumber', function(t) {
  t.plan(3)

  var engine = new ProviderEngine()
  var etherscan = new EtherscanSubprovider()
  engine.addProvider(etherscan)
  engine.start()
  engine.sendAsync(createPayload({
    method: 'eth_getBlockTransactionCountByNumber',
    params: [
      '0x132086'
    ],
  }), function(err, response){
    t.ifError(err, 'throw no error')
    t.ok(response, 'has response')
    t.equal(response.result, '0x8')
    t.end()
  })
})

test('etherscan eth_getTransactionByHash', function(t) {
  t.plan(3)

  var engine = new ProviderEngine()
  var etherscan = new EtherscanSubprovider()
  engine.addProvider(etherscan)
  engine.start()
  engine.sendAsync(createPayload({
    method: 'eth_getTransactionByHash',
    params: [
      '0xe420d77c4f8b5bf95021fa049b634d5e3f051752a14fb7c6a8f1333c37cdf817'
    ],
  }), function(err, response){
    t.ifError(err, 'throw no error')
    t.ok(response, 'has response')
    t.equal(response.result.nonce, '0xd', 'nonce matches known nonce')
    t.end()
  })
})
