const test = require('tape')
const cacheUtils = require('../util/rpc-cache-utils')

test('cacheIdentifierForPayload for latest block', function (t) {
  const input = {id: 5081515342821137, jsonrpc: '2.0', params: ['latest', false], method: 'eth_getBlockByNumber'}
  const input2 = {id: 5081515342821137, jsonrpc: '2.0', params: ['0', false], method: 'eth_getBlockByNumber'}
  const cacheId = cacheUtils.cacheIdentifierForPayload(input)
  const cacheId2 = cacheUtils.cacheIdentifierForPayload(input2)

  t.notEqual(cacheId, cacheId2, 'latest is not the same as block 0')
  console.dir({ cacheId, cacheId2 })
  t.end()
})
