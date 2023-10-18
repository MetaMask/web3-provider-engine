const ProviderSubprovider = require('./json-rpc-engine-middleware')
const { createInflightCacheMiddleware } = require('@metamask/eth-json-rpc-middleware')

class InflightCacheSubprovider extends ProviderSubprovider {
  constructor(opts) {
    super(() => createInflightCacheMiddleware(opts))
  }
}

module.exports = InflightCacheSubprovider
