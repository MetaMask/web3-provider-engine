const ProviderSubprovider = require('./json-rpc-engine-middleware')
const createFilterMiddleware = require('@metamask/eth-json-rpc-filters')

class FiltersSubprovider extends ProviderSubprovider {
  constructor() {
    super(({ blockTracker, provider }) => {
      return createFilterMiddleware({ blockTracker, provider })
    })
  }
}

module.exports = FiltersSubprovider
