import {inherits} from 'util';
import extend from 'xtend';
import FixtureProvider from './fixture.js';
import {version} from '../package.json';

inherits(DefaultFixtures, FixtureProvider)

function DefaultFixtures(opts) {
  const self = this
  opts = opts || {}
  var responses = extend({
    web3_clientVersion: 'ProviderEngine/v'+version+'/javascript',
    net_listening: true,
    eth_hashrate: '0x00',
    eth_mining: false,
  }, opts)
  FixtureProvider.call(self, responses)
}

export default DefaultFixtures;
