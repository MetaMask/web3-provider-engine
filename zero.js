const ProviderEngine = require('./index.js')
const DefaultFixture = require('./subproviders/default-fixture.js')
const NonceTrackerSubprovider = require('./subproviders/nonce-tracker.js')
const CacheSubprovider = require('./subproviders/cache.js')
const FilterSubprovider = require('./subproviders/filters.js')
const HookedWalletSubprovider = require('./subproviders/hooked-wallet.js')
const RpcSubprovider = require('./subproviders/rpc.js')


module.exports = ZeroClientProvider


function ZeroClientProvider(opts){
  opts = opts || {}

  var engine = new ProviderEngine()

  // static
  var staticSubprovider = new DefaultFixture()
  engine.addProvider(staticSubprovider)

  // nonce tracker
  engine.addProvider(new NonceTrackerSubprovider())

  // cache layer
  var cacheSubprovider = new CacheSubprovider()
  engine.addProvider(cacheSubprovider)

  // filters
  var filterSubprovider = new FilterSubprovider()
  engine.addProvider(filterSubprovider)

  // id mgmt
  var idmgmtSubprovider = new HookedWalletSubprovider({
    getAccounts: opts.getAccounts,
    approveTransaction: opts.approveTransaction,
    signTransaction: opts.signTransaction,
    approveMessage: opts.approveMessage,
    signMessage: opts.signMessage,
  })
  engine.addProvider(idmgmtSubprovider)

  // data source
  var rpcSubprovider = new RpcSubprovider({
    rpcUrl: opts.rpcUrl || 'https://testrpc.metamask.io/',
  })
  engine.addProvider(rpcSubprovider)

  // // log new blocks
  // engine.on('block', function(block){
  //   console.log('================================')
  //   console.log('BLOCK CHANGED:', '#'+block.number.toString('hex'), '0x'+block.hash.toString('hex'))
  //   console.log('================================')
  // })

  // start polling
  engine.start()

  return engine

}
