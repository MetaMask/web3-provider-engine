const { createProvider: createInfuraProvider } = require('@metamask/eth-json-rpc-infura')
const ProviderSubprovider = require('./provider.js')

class InfuraSubprovider extends ProviderSubprovider {
  constructor(opts = {}) {
    const provider = createInfuraProvider(opts)
    super(provider)
  }
}

module.exports = InfuraSubprovider
