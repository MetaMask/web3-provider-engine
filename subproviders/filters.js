
module.exports = FilterSubprovider


function FilterSubprovider() {
  const self = this
  self.filterIndex = 0
  self.filters = {}
  self.filterDestroyHandlers = {}
  self.methods = [
    'eth_newBlockFilter',
    'eth_newFilter',
    'eth_getFilterChanges',
    'eth_uninstallFilter',
  ]
}

FilterSubprovider.prototype.send = function(payload){
  throw new Error('FilterSubprovider - Synchronous send not supported!')
}

FilterSubprovider.prototype.sendAsync = function(payload, cb){
  const self = this
  switch(payload.method){
    case 'eth_newBlockFilter':
      self.newBlockFilter(cb)
      return
    case 'eth_newFilter':
      self.newFilter(cb)
      return
    case 'eth_getFilterChanges':
      self.getFilterChanges(cb)
      return
    case 'eth_uninstallFilter':
      self.uninstallFilter(cb)
      return
  }
}

FilterSubprovider.prototype.newBlockFilter = function(cb) {
  const self = this
  console.log('FilterSubprovider - newBlockFilter')
  self._getBlockNumber(function(err, blockNumber){
    if (err) return cb(err)
    var filter = new BlockFilter({
      blockNumber: blockNumber,
    })

    var newBlockHandler = filter.update.bind(filter)
    self.rootProvider.on('block', newBlockHandler)
    var destroyHandler = function(){
      self.rootProvider.removeListener('block', newBlockHandler)
    }
    
    self.filterIndex++
    var hexFilterIndex = intToHex(self.filterIndex)
    self.filters[hexFilterIndex] = filter
    self.filterDestroyHandlers[hexFilterIndex] = destroyHandler

    cb(null, hexFilterIndex)
  })
}

// blockapps does not index LOGs at this time
FilterSubprovider.prototype.newFilter = function(args, cb) {
  const self = this
  console.log('FilterSubprovider - newFilter')
  throw new Error('kablammo!')
}

FilterSubprovider.prototype.getFilterChanges = function(filterId, cb) {
  const self = this
  console.log('FilterSubprovider - getFilterChanges')
  filterId = hexToInt(filterId)
  var filter = self.filters[filterId]
  if (!filter) return cb(null, [])
  var results = filter.getChanges()
  filter.clearChanges()
  cb(null, results)
}

FilterSubprovider.prototype.uninstallFilter = function(filterId, cb) {
  const self = this
  console.log('FilterSubprovider - uninstallFilter')
  
  var filter = self.filters[filterId]
  if (filter == null) {
    cb(null, false)
    return
  }

  var destroyHandler = self.filterDestroyHandlers[filterId]
  delete self.filters[filterId]
  delete self.filterDestroyHandlers[filterId]
  destroyHandler()
  
  cb(null, true)
}

// private

FilterSubprovider.prototype._getBlockNumber = function(cb) {
  const self = this
  var blockNumber = bufferToHex(self.rootProvider.currentBlock.number)
  cb(null, blockNumber)
}

//
// BlockFilter
//

function BlockFilter(opts) {
  const self = this
  self.rootProvider = opts.rootProvider
  self.blockNumber = opts.blockNumber
  self.updates = []
}

BlockFilter.prototype.update = function(block){
  const self = this
  var blockHash = bufferToHex(block.hash)
  self.updates.push(blockHash)
}

BlockFilter.prototype.getChanges = function(){
  const self = this
  var results = self.updates
  return results
}

BlockFilter.prototype.clearChanges = function(){
  const self = this
  self.updates = []
}

// util

function intToHex(value) {
  var number = toBigNumber(value)
  var hexString = number.toString(16)
  var isNegative = value < 0
  if (isNegative) hexString = hexString.slice(1)
  if (hexString.length%2 !== 0) hexString = '0'+hexString
  hexString = '0x' + hexString
  if (isNegative) hexString = '-'+hexString
  return hexString
}

function hexToInt(hexString) {
  if (hexString.slice(0,2) === '0x') hexString = hexString.slice(2)
  else if (hexString.slice(0,3) === '-0x') hexString = '-'+hexString.slice(3)
  return parseInt(hexString, 16)
}


function bufferToHex(buffer) {
  return '0x'+buffer.toString('hex')
}