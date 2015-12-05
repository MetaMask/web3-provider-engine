const inherits = require('util').inherits
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const xhr = require('xhr')
const RemoteDataProvider = require('./remote-data.js')

module.exports = BlockAppsProvider


inherits(BlockAppsProvider, RemoteDataProvider)

function BlockAppsProvider(){
  var self = this
  RemoteDataProvider.call(self)
  self.apiBase = 'https://api.blockapps.net/eth/v1.0/'
  self.startPolling()
}

BlockAppsProvider.prototype.startPolling = function(){
  var self = this
  pollForBlock()

  function pollForBlock(){
    fetchBlock(function onBlockFetchResponse(err, block){
      if (block) checkIfUpdated(block)
      setTimeout(pollForBlock, 2000)
    })
  }

  function fetchBlock(cb){
    self._fetchBlock('doesnt matter', cb)
  }

  function checkIfUpdated(block){
    if (!self.currentBlock) {
      self.currentBlock = block 
    } else if (0 !== self.currentBlock.hash.compare(block.hash)) {
      console.log('block chaged:', block.hash.toString('hex'))
      self.currentBlock = block
      self.resetBlockCache() 
    }
  }
}

BlockAppsProvider.prototype._fetchBlock = function(number, cb){
  var self = this
  self.requestFromBlockapps('block/last/1', function(err, data){
    if (err) return cb(err)

    var blockData = data.blockData

    var block = {
      hash: new Buffer(blockData.mixHash),
      number: new BN(blockData.number),
    }

    cb(null, block)
  })
}

BlockAppsProvider.prototype._fetchAccount = function(address, cb){
  // var account = {
  //   balance: new BN(0),
  //   nonce: ethUtil.toBuffer(data.nonce),
  //   code: code = new Buffer(data.code),
  // }

  // cb(null, account)
}

BlockAppsProvider.prototype.requestFromBlockapps = function(endpoint, cb){
  var self = this
  // var targetUrl = self.apiBase+'account?address='+addressHex.toString('hex')
  var targetUrl = self.apiBase+endpoint
  console.log(targetUrl)
  xhr({ uri: targetUrl, withCredentials: false }, function(err, res, body) {
    if (err) return cb(err)
    // parse response into raw account
    var data
    try {
      data = JSON.parse(body)[0]
    } catch (err) {
      console.log(body)
      console.error(err.stack)
      return cb(err)
    }

    cb(null, data)
  })
}