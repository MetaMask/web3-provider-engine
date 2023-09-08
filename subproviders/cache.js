const ProviderSubprovider = require('./json-rpc-engine-middleware')
const { createBlockCacheMiddleware } = require('@metamask/eth-json-rpc-middleware')

class BlockCacheSubprovider extends ProviderSubprovider {
  constructor(opts) {
    super(({ blockTracker }) => createBlockCacheMiddleware(Object.assign({ blockTracker }, opts)))
  }
}

module.exports = BlockCacheSubprovider
