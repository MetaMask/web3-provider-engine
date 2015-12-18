const ProviderEngine = require('./engine.js')
const RpcSubprovider = require('./subproviders/rpc-source.js')
const VmSubprovider = require('./subproviders/vm.js')
const FilterSubprovider = require('./subproviders/filters.js')
const DefaultStatic = require('./subproviders/default-static.js')
const LightWalletSubprovider = require('./subproviders/lightwallet.js')
const Web3 = require('web3')

module.exports = web3Generator

function web3Generator(){

  var engine = new ProviderEngine()
  var web3 = new Web3(engine)

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
    rpcUrl: 'https://rpc.metamask.io/',
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

  return web3

}