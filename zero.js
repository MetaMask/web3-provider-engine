import ProviderEngine from './provider-engine.js'
import DefaultFixture from './subproviders/default-fixture.js'
import NonceTrackerSubprovider from './subproviders/nonce-tracker.js'
import CacheSubprovider from './subproviders/cache.js'
import FilterSubprovider from './subproviders/filters.js'
import InflightCacheSubprovider from './subproviders/inflight-cache'
import HookedWalletSubprovider from './subproviders/hooked-wallet.js'
import SanitizingSubprovider from './subproviders/sanitizer.js'
import RpcSubprovider from './subproviders/rpc.js'
import FetchSubprovider from './subproviders/fetch.js'

function ZeroClientProvider(opts){
  opts = opts || {}

  const engine = new ProviderEngine(opts.engineParams)

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

  // inflight cache
  const inflightCache = new InflightCacheSubprovider()
  engine.addProvider(inflightCache)

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
    processTypedMessage: opts.processTypedMessage,
    approvePersonalMessage: opts.approvePersonalMessage,
    approveTypedMessage: opts.approveTypedMessage,
    signPersonalMessage: opts.signPersonalMessage,
    signTypedMessage: opts.signTypedMessage,
    personalRecoverSigner: opts.personalRecoverSigner,
  })
  engine.addProvider(idmgmtSubprovider)

  // data source
  const fetchSubprovider = new FetchSubprovider({
    rpcUrl: opts.rpcUrl || 'https://mainnet.infura.io/',
    originHttpHeaderKey: opts.originHttpHeaderKey,
  })
  engine.addProvider(fetchSubprovider)

  // start polling
  engine.start()

  return engine
}
export default ZeroClientProvider;
