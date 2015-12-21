const ProviderEngine = require('./index.js')
const RpcSubprovider = require('./subproviders/rpc.js')
const VmSubprovider = require('./subproviders/vm.js')
const FilterSubprovider = require('./subproviders/filters.js')
const DefaultStatic = require('./subproviders/default-static.js')
const LightWalletSubprovider = require('./subproviders/lightwallet.js')

module.exports = zeroClientProvider


function zeroClientProvider(opts){
  opts = opts || {}

  var engine = new ProviderEngine()

  // static
  var staticSubprovider = new DefaultStatic()
  engine.addSource(staticSubprovider)

  // filters
  var filterSubprovider = new FilterSubprovider({
    rootProvider: engine,
  })
  engine.addSource(filterSubprovider)

  // vm
  var vmSubprovider = new VmSubprovider({
    rootProvider: engine,
  })
  engine.addSource(vmSubprovider)

  // id mgmt
  var idmgmtSubprovider = new LightWalletSubprovider({
    rootProvider: engine,
  })
  engine.addSource(idmgmtSubprovider)

  // data source
  var rpcSubprovider = new RpcSubprovider({
    rpcUrl: opts.rpcUrl || 'https://testrpc.metamask.io/',
  })
  engine.addSource(rpcSubprovider)

  // done adding subproviders
  engine.start()

  engine.on('block', function(block){
    // lazy hack - move caching and current block to engine
    engine.currentBlock = block
    console.log('================================')
    console.log('BLOCK CHANGED:', '#'+block.number.toString('hex'), '0x'+block.hash.toString('hex'))
    console.log('================================')
  })

  return engine

}