const RpcSource = require('./rpc-source.js')
const ProviderEngine = require('./engine.js')
const Web3 = require('web3')


var engine = new ProviderEngine()
var web3 = new Web3(engine)

var rpcSource = new RpcSource({
  rpcUrl: 'https://rpc.metamask.io/',
})
engine.addSource(rpcSource)




// var provider = new Skeleton({
//   syncProviders: [
//     keyManager,
//   ],
//   asyncProviders: [
//     keyManager,
//     blockappsProvider,
//   ],
// })

setInterval(function(){

  web3.eth.getBalance('ba0bab3b85c6d190af0f9dbf21a1d8cdbed23830', function(err, result){
    if (!err)
      console.log('looked up baobab bal:', web3.fromWei(result, 'ether').toString())
    else
      console.error(err);
  })

  web3.eth.getBlock('latest', function(err, result){
      if (!err)
        console.log('looked up block num:', result.number)
      else
        console.error(err);
  })

}, 1000)

rpcSource.on('block', function(block){
  console.log('block changed:', block.number.toString(), block.hash.toString('hex'))
})