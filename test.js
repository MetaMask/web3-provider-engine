var Web3 = new require('web3')
var BN = new require('bn.js')
var RpcProvider = require('./subproviders/rpc-source.js')
var Tx = require('ethereumjs-tx')
var ethUtils = require('ethereumjs-util')
// var rpc = 'https://testrpc.metamask.io'

var provider = new RpcProvider({ rpcUrl: 'https://testrpc.metamask.io/' })
var web3 = new Web3(provider)

var sendAmount = 1//amount to send 
var pk = new Buffer('b14c67ce616e48f94d53f49ec7359e8e4a400d37a9a75e6c45570a9e0776e61e', 'hex')
// web3.setProvider(new web3.providers.HttpProvider(rpc))
// web3.setProvider(new web3.providers.HttpProvider(rpc))

// var bal = web3.eth.getBalance('0x25c8077ee66a3d3f6ac45d8822519ed84319b999')
var hexBal = '0' + sendAmount.toString(16)

var tx = new Tx()
tx.to = '0xffa19aeec96ef7b4a41448ba8fec37168edcab63'
tx.gasPrice = '0xba43b7400'// + web3.eth.gasPrice.toString(16)
tx.gasLimit = 21000
tx.nonce = '0x100001'
console.log('hexBal: ' + hexBal)
console.log('cost: ' + tx.getUpfrontCost().toString(16))
tx.value = new BN(new Buffer(hexBal, 'hex')).add(tx.getUpfrontCost())
tx.sign(pk)
var rawTx = '0x' + tx.serialize().toString('hex')
console.log('rawTx:', rawTx)

web3.eth.sendRawTransaction(rawTx, function (err, r) {
  console.log(err)
  console.log(r)
})