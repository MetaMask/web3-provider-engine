const ProviderSubprovider = require('./json-rpc-engine-middleware')
const { createInflightCacheMiddleware } = require('eth-json-rpc-middleware/dist/inflight-cache')

class InflightCacheSubprovider extends ProviderSubprovider {
  constructor(opts) {
    super(() => createInflightCacheMiddleware(opts))
  }
}

module.exports = InflightCacheSubprovider
