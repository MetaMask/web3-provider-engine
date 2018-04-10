const Ethjs = require('ethjs')
const ProviderEngine = require('./index.js')
const ZeroClientProvider = require('./zero.js')

// create engine
const providerEngine = ZeroClientProvider({
  getAccounts: function(){},
  // supports http and websockets
  // but defaults to infura's mainnet rest api
  // rpcUrl: 'https://mainnet.infura.io',
  // rpcUrl: 'wss://mainnet.infura.io/_ws',
})

// use the provider to instantiate Ethjs, Web3, etc
const eth = new Ethjs(providerEngine)

// log new blocks
providerEngine.on('block', function(block) {
  const blockNumber = Number.parseInt(block.number.toString('hex'), 16)
  const blockHash = `0x${block.hash.toString('hex')}`
  console.log(`block: #${blockNumber} ${blockHash}`)
})
