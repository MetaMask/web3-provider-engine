const inherits = require('util').inherits
const StaticProvider = require('./static.js')

module.exports = DefaultStatic


inherits(DefaultStatic, StaticProvider)

function DefaultStatic() {
  const self = this
  var responses = {
    web3_clientVersion: 'MetaMask-ZeroClient/v0.0.0/javascript',
    net_version: '1',
    net_listening: true,
    net_peerCount: '0xc',
    eth_protocolVersion: '63',
    eth_hashrate: '0x0',
    eth_mining: false,
    eth_syncing: true,
  }
  StaticProvider.call(self, responses)
}
