const createBlockCacheMiddleware = require('eth-json-rpc-middleware/block-cache')
const ProviderSubprovider = require('./json-rpc-engine-middleware')

class BlockCacheSubprovider extends ProviderSubprovider {
  constructor (opts) {
    super(({ blockTracker }) => createBlockCacheMiddleware({blockTracker, ...opts}))
  }
}

module.exports = BlockCacheSubprovider
