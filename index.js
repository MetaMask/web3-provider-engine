const RpcSubprovider = require('./subproviders/rpc-source.js')
const VmSubprovider = require('./subproviders/vm.js')
const ProviderEngine = require('./engine.js')
const Web3 = require('web3')


var engine = new ProviderEngine()
var web3 = new Web3(engine)

var rpcSubprovider = new RpcSubprovider({
  rpcUrl: 'https://rpc.metamask.io/',
})
engine.addSource(rpcSubprovider)

var vmSubprovider = new VmSubprovider({
  rootProvider: engine,
})
engine.addSource(vmSubprovider)




// var provider = new Skeleton({
//   syncProviders: [
//     keyManager,
//   ],
//   asyncProviders: [
//     keyManager,
//     blockappsProvider,
//   ],
// })

// http://etherscan.io/address/0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae
vmSubprovider._createAccountStorageTrie('0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae', function(err, storage){

  setInterval(function(){

    storage.get('0x0000000000000000000000000000000000000000000000000000000000000000', function(err, result){
      console.log('storage result:', result.toString('hex'))
    })

  }, 1000)

})

setInterval(function(){

  // vmSubprovider._fetchAccount('ba0bab3b85c6d190af0f9dbf21a1d8cdbed23830', function(err, account){
  //   console.log('fetched:', account)
  // })

  // web3.eth.getBalance('ba0bab3b85c6d190af0f9dbf21a1d8cdbed23830', function(err, result){
  //   if (!err)
  //     console.log('looked up baobab bal:', web3.fromWei(result, 'ether').toString())
  //   else
  //     console.error(err);
  // })

  // web3.eth.getBlock('latest', function(err, result){
  //     if (!err)
  //       console.log('looked up block num:', result.number)
  //     else
  //       console.error(err);
  // })

}, 1000)

rpcSubprovider.on('block', function(block){
  console.log('================================')
  console.log('BLOCK CHANGED:', '#'+block.number.toString(), '0x'+block.hash.toString('hex'))
  console.log('================================')
})