const ProviderEngine = require('./index.js')
const DefaultFixture = require('./subproviders/default-fixture.js')
const NonceTrackerSubprovider = require('./subproviders/nonce-tracker.js')
const CacheSubprovider = require('./subproviders/cache.js')
const FilterSubprovider = require('./subproviders/filters.js')
const HookedWalletSubprovider = require('./subproviders/hooked-wallet.js')
const SanitizingSubprovider = require('./subproviders/sanitizer.js')
const RpcSubprovider = require('./subproviders/rpc.js')


module.exports = ZeroClientProvider


function ZeroClientProvider(opts){
  opts = opts || {}

  var engine = new ProviderEngine()

  // static
  var staticSubprovider = new DefaultFixture(opts.static)
  engine.addProvider(staticSubprovider)

  // nonce tracker
  engine.addProvider(new NonceTrackerSubprovider())

  // sanitization
  var sanitizer = new SanitizingSubprovider()
  engine.addProvider(sanitizer)

  // cache layer
  var cacheSubprovider = new CacheSubprovider()
  engine.addProvider(cacheSubprovider)

  // filters
  var filterSubprovider = new FilterSubprovider()
  engine.addProvider(filterSubprovider)

  // id mgmt
  var idmgmtSubprovider = new HookedWalletSubprovider({
    // accounts
    getAccounts: opts.getAccounts,
    // transactions
    processTransaction: opts.processTransaction,
    approveTransaction: opts.approveTransaction,
    signTransaction: opts.signTransaction,
    publishTransaction: opts.publishTransaction,
    // messages
    processMessage: opts.processMessage,
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
