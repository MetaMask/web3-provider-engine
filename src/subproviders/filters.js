const createFilterMiddleware = require('eth-json-rpc-filters')
const ProviderSubprovider = require('./json-rpc-engine-middleware')

class SubscriptionsSubprovider extends ProviderSubprovider {
  constructor () {
    super(({ blockTracker, provider, engine }) => {
      return createFilterMiddleware({ blockTracker, provider })
    })
  }
}

module.exports = SubscriptionsSubprovider
