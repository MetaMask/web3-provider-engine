const ProviderSubprovider = require('./json-rpc-engine-middleware')
const { createFetchMiddleware } = require('@metamask/eth-json-rpc-middleware')

class FetchSubprovider extends ProviderSubprovider {
  constructor(opts) {
    super(({ blockTracker, provider, engine }) => {
      return createFetchMiddleware(opts)
    })
  }
}

module.exports = FetchSubprovider
