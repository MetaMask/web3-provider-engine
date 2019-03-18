const { provider } = require('ganache-core')
const ProviderSubprovider = require('../../subproviders/provider')


class GanacheProvider extends ProviderSubprovider {

  constructor () {
    super(provider())
  }

}

module.exports = GanacheProvider