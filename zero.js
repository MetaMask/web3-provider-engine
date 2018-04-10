const ProviderEngine = require('./index.js')
const DefaultFixture = require('./subproviders/default-fixture.js')
const NonceTrackerSubprovider = require('./subproviders/nonce-tracker.js')
const CacheSubprovider = require('./subproviders/cache.js')
const FilterSubprovider = require('./subproviders/filters.js')
const InflightCacheSubprovider = require('./subproviders/inflight-cache')
const HookedWalletSubprovider = require('./subproviders/hooked-wallet.js')
const SanitizingSubprovider = require('./subproviders/sanitizer.js')
const InfuraSubprovider = require('./subproviders/infura.js')
const FetchSubprovider = require('./subproviders/fetch.js')
const WebSocketSubprovider = require('./subproviders/websocket.js')


module.exports = ZeroClientProvider


function ZeroClientProvider(opts = {}){
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
  const dataSubprovider = opts.dataSubprovider || createDataSubprovider(opts)
  engine.addProvider(dataSubprovider)

  // start polling
  engine.start()

  return engine

}

function createDataSubprovider(opts) {
  const { rpcUrl, debug } = opts

  const connectionType = getConnectionType({ rpcUrl })
  // default to infura
  if (!connectionType) {
    return new InfuraSubprovider()
  }
  if (connectionType === 'http') {
    return new FetchSubprovider({ rpcUrl, debug })
  }
  if (connectionType === 'ws') {
    return new WebSocketSubprovider({ rpcUrl, debug })
  }

  throw new Error(`ProviderEngine - unrecognized connectionType "${connectionType}"`)
}

function getConnectionType({ rpcUrl }) {
  if (!rpcUrl) return undefined

  const protocol = rpcUrl.split(':')[0]
  switch (protocol) {
    case 'http':
    case 'https':
      return 'http'
    case 'ws':
    case 'wss':
      return 'ws'
    default:
      throw new Error(`ProviderEngine - unrecognized protocol in "${rpcUrl}"`)
  }
}
