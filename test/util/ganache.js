const { provider } = require('ganache')
const ProviderSubprovider = require('../../subproviders/provider')


class GanacheProvider extends ProviderSubprovider {

  constructor () {
    super(provider())
  }

}

module.exports = GanacheProvider