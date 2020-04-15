const createInflightCacheMiddleware = require('eth-json-rpc-middleware/inflight-cache')
const ProviderSubprovider = require('./json-rpc-engine-middleware')

class InflightCacheSubprovider extends ProviderSubprovider {
  constructor (opts) {
    super(() => createInflightCacheMiddleware(opts))
  }
}

module.exports = InflightCacheSubprovider
