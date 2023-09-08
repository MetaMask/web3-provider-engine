const { createProvider } = require('@metamask/eth-json-rpc-infura')
const ProviderSubprovider = require('./provider.js')

class InfuraSubprovider extends ProviderSubprovider {
  constructor(opts = {}) {
    const provider = createProvider(opts)
    super(provider)
  }
}

module.exports = InfuraSubprovider
