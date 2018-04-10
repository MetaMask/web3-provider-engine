const createInfuraProvider = require('eth-json-rpc-infura/src/createProvider')
const ProviderSubprovider = require('./web3.js')

module.exports = InfuraSubprovider

class InfuraSubprovider extends ProviderSubprovider {
  constructor(opts) {
    const provider = createInfuraProvider(opts)
    super(provider)
  }
}
