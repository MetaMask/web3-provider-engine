const { provider } = require('ganache-cli')
const ProviderSubprovider = require('../../subproviders/provider')


class GanacheProvider extends ProviderSubprovider {

  constructor () {
    super(provider())
  }

}

module.exports = GanacheProvider
