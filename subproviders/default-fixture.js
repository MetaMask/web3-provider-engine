const inherits = require('util').inherits
const FixtureProvider = require('./fixture.js')

module.exports = DefaultFixtures

inherits(DefaultFixtures, FixtureProvider)

function DefaultFixtures() {
  const self = this
  var responses = {
    web3_clientVersion: 'MetaMask-ZeroClient/v0.0.0/javascript',
    net_version: '1',
    net_listening: true,
    net_peerCount: '0xc',
    eth_protocolVersion: '63',
    eth_hashrate: '0x00',
    eth_mining: false,
    eth_syncing: true,
  }
  FixtureProvider.call(self, responses)
}
