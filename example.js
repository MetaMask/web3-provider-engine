const ProviderEngine = require('./index.js')
const ZeroClientProvider = require('./zero.js')
const FetchProvider = require('./subproviders/fetch')

const fetchEngine = ZeroClientProvider({
  getAccounts: function(){},
  dataSubprovider: new FetchProvider({
    rpcUrl: 'https://mainnet.infura.io',
  })
})

// create engine
const websocketEngine = ZeroClientProvider({
  getAccounts: function(){},
  rpcUrl: 'wss://mainnet.infura.io/_ws',
  //debug: true,
})

// log new blocks
websocketEngine.on('block', function(block) {
  console.log('WS:', '#'+block.number.toString('hex'), '0x'+block.hash.toString('hex'))
})

// log new blocks
fetchEngine.on('block', function(block) {
  console.log('Fetch:', '#'+block.number.toString('hex'), '0x'+block.hash.toString('hex'))
})
