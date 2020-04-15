const { inherits } = require('util')
const extend = require('xtend')
const { version } = require('../../package.json')
const FixtureProvider = require('./fixture.js')

module.exports = DefaultFixtures

inherits(DefaultFixtures, FixtureProvider)

function DefaultFixtures (opts) {
  const self = this
  opts = opts || {}
  const responses = extend({
    web3_clientVersion: `ProviderEngine/v${version}/javascript`,
    net_listening: true,
    eth_hashrate: '0x00',
    eth_mining: false,
  }, opts)
  FixtureProvider.call(self, responses)
}
