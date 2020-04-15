const { provider } = require('ganache-core')
const ProviderSubprovider = require('../../src/subproviders/provider')


class GanacheProvider extends ProviderSubprovider {

  constructor () {
    super(provider())
  }

}

module.exports = GanacheProvider
