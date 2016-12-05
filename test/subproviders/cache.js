const test = require('tape')
const ProviderEngine = require('../../index.js')
const createPayload = require('../../util/create-payload.js')
const BlockCacheProvider = require('../../subproviders/cache')
const MockSubprovider = require('../util/mock-subprovider')
const mockBlock = require('../util/mock_block.json')
const extend = require('xtend')
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN

test('Requesting a block twice caches and only actually requests once', function(t) {
  t.plan(1)

  var engine = new ProviderEngine()

  var cacher = new BlockCacheProvider()

  engine.addProvider(cacher)

  let blockNumber = new BN('1a64a4', 16)
  let requestCount = 0
  var mock = new MockSubprovider(function (payload, next, end) {
    requestCount++
    if (payload.method === 'eth_getBlockByHash') {
      if (payload.params[0] === mockBlock.result.hash) {
        return end(null, mockBlock.result)
      } else {
        blockNumber = blockNumber.add(new BN('1', 10))
        mockBlock.result.number = '0x' + blockNumber.toString(16)
        return end(null, mockBlock.result)
      }
    }
  })

  engine.addProvider(mock)

  // Deactivating polling for this test
  engine._startPolling = noop
  engine._setCurrentBlock(mockBlock.result)

  engine.start()

  var payload = {
    method: 'eth_getBlockByHash',
    params: [mockBlock.result.hash, false ],
  }

  engine.sendAsync(payload, function (err, result) {
    engine.sendAsync(payload, function (err, result) {
      engine.sendAsync(payload, function (err, result) {
        t.equal(requestCount, 1, 'only made one request')
      })
    })
  })
})

function noop() {}
