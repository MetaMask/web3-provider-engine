const ProviderEngine = require('./index.js')
const DefaultFixture = require('./subproviders/default-fixture.js')
const NonceTrackerSubprovider = require('./subproviders/nonce-tracker.js')
const CacheSubprovider = require('./subproviders/cache.js')
const FilterSubprovider = require('./subproviders/filters.js')
const HookedWalletSubprovider = require('./subproviders/hooked-wallet.js')
const SanitizingSubprovider = require('./subproviders/sanitizer.js')
const RpcSubprovider = require('./subproviders/rpc.js')
const FetchSubprovider = require('./subproviders/fetch.js')


module.exports = ZeroClientProvider


function ZeroClientProvider(opts){
  opts = opts || {}

  const engine = new ProviderEngine()

  // static
  const staticSubprovider = new DefaultFixture(opts.static)
  engine.addProvider(staticSubprovider)

  // nonce tracker
  engine.addProvider(new NonceTrackerSubprovider())

  // sanitization
  const sanitizer = new SanitizingSubprovider()
  engine.addProvider(sanitizer)

  // cache layer
  const cacheSubprovider = new CacheSubprovider()
  engine.addProvider(cacheSubprovider)

  // filters
  const filterSubprovider = new FilterSubprovider()
  engine.addProvider(filterSubprovider)

  // id mgmt
  const idmgmtSubprovider = new HookedWalletSubprovider({
    // accounts
    getAccounts: opts.getAccounts,
    // transactions
    processTransaction: opts.processTransaction,
    approveTransaction: opts.approveTransaction,
    signTransaction: opts.signTransaction,
    publishTransaction: opts.publishTransaction,
    // messages
    // old eth_sign
    processMessage: opts.processMessage,
    approveMessage: opts.approveMessage,
    signMessage: opts.signMessage,
    // new personal_sign
    processPersonalMessage: opts.processPersonalMessage,
    approvePersonalMessage: opts.approvePersonalMessage,
    signPersonalMessage: opts.signPersonalMessage,
    personalRecoverSigner: opts.personalRecoverSigner,
  })
  engine.addProvider(idmgmtSubprovider)

  // data source
  const fetchSubprovider = new FetchSubprovider({
    rpcUrl: opts.rpcUrl || 'https://mainnet.infura.io/',
  })
  engine.addProvider(fetchSubprovider)

  // start polling
  engine.start()

  return engine

}
