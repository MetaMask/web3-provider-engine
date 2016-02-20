const ProviderEngine = require('./index.js')
const NonceTrackerSubprovider = require('./subproviders/nonce-tracker.js')
const CacheSubprovider = require('./subproviders/cache.js')
const RpcSubprovider = require('./subproviders/rpc.js')
const VmSubprovider = require('./subproviders/vm.js')
const FilterSubprovider = require('./subproviders/filters.js')
const DefaultFixture = require('./subproviders/default-fixture.js')
const LightWalletSubprovider = require('./subproviders/lightwallet.js')

module.exports = ZeroClientProvider


function ZeroClientProvider(opts){
  opts = opts || {}

  var engine = new ProviderEngine()

  // nonce tracker
  engine.addProvider(new NonceTrackerSubprovider())

  // cache layer
  var cacheSubprovider = new CacheSubprovider()
  engine.addProvider(cacheSubprovider)

  // static
  var staticSubprovider = new DefaultFixture()
  engine.addProvider(staticSubprovider)

  // filters
  var filterSubprovider = new FilterSubprovider()
  engine.addProvider(filterSubprovider)

  // vm
  var vmSubprovider = new VmSubprovider()
  engine.addProvider(vmSubprovider)

  // id mgmt
  var idmgmtSubprovider = new LightWalletSubprovider()
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
