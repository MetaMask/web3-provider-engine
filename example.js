const Ethjs = require('ethjs')
const ZeroClientProvider = require('./zero.js')
const ProviderEngine = require('.')

// create engine
const providerEngine = ZeroClientProvider({
  // supports http and websockets
  // but defaults to infura's mainnet rest api
  // rpcUrl: 'https://mainnet.infura.io',
  // rpcUrl: 'http://localhost:8545',
  // rpcUrl: 'wss://mainnet.infura.io/ws',
  // rpcUrl: 'ws://localhost:8545/ws',
})

// use the provider to instantiate Ethjs, Web3, etc
const eth = new Ethjs(providerEngine)

// log new blocks
providerEngine.on('block', function (block) {
  const blockNumber = Number.parseInt(block.number.toString('hex'), 16)
  const blockHash = `0x${block.hash.toString('hex')}`
  console.log(`block: #${blockNumber} ${blockHash}`)
})
