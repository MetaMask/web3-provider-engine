const createPayload = require('../util/create-payload.js')

module.exports = FilterSubprovider

function FilterSubprovider(opts) {
  const self = this
  self.rootProvider = opts.rootProvider
  self.filterIndex = 0
  self.filters = {}
  self.filterDestroyHandlers = {}
  self.methods = [
    'eth_newBlockFilter',
    'eth_newFilter',
    'eth_getFilterChanges',
    'eth_uninstallFilter',
    'eth_getFilterLogs',
  ]
}

FilterSubprovider.prototype.handleRequest = function(payload, next, end){
  const self = this
  switch(payload.method){

    case 'eth_newBlockFilter':
      self.newBlockFilter(end)
      return

    case 'eth_newFilter':
      self.newFilter(payload.params[0], end)
      return

    case 'eth_getFilterChanges':
      self.getFilterChanges(payload.params[0], end)
      return

    case 'eth_getFilterLogs':
      self.getFilterLogs(payload.params[0], end)
      return

    case 'eth_uninstallFilter':
      self.uninstallFilter(payload.params[0], end)
      return
    default:
      next();
      return;
  }
}

FilterSubprovider.prototype.newBlockFilter = function(cb) {
  const self = this

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
FilterSubprovider.prototype.newFilter = function(opts, cb) {
  const self = this

  self._getBlockNumber(function(err, blockNumber){
    if (err) return cb(err)

    var filter = new LogFilter(opts)
    var newLogHandler = filter.update.bind(filter)
    var destroyHandler = function(){
      self.rootProvider.removeListener('block', newLogHandler)
    }

    self.rootProvider.on('block', function(block){
      self._logsForBlock(block, function(err, logs){
        if (err) throw err
        logs.forEach(newLogHandler)
      })
    })

    self.filterIndex++
    var hexFilterIndex = intToHex(self.filterIndex)
    if (!filter) console.warn('FilterSubprovider - new filter with id:', hexFilterIndex)
    self.filters[hexFilterIndex] = filter
    self.filterDestroyHandlers[hexFilterIndex] = destroyHandler

    cb(null, hexFilterIndex)
  })
}

FilterSubprovider.prototype.getFilterChanges = function(filterId, cb) {
  const self = this

  // filterId = hexToInt(filterId)
  var filter = self.filters[filterId]
  if (!filter) console.warn('FilterSubprovider - no filter with that id:', filterId)
  if (!filter) return cb(null, [])
  var results = filter.getChanges()
  filter.clearChanges()
  cb(null, results)
}

FilterSubprovider.prototype.getFilterLogs = function(filterId, cb) {
  const self = this

  // filterId = hexToInt(filterId)
  var filter = self.filters[filterId]
  if (!filter) console.warn('FilterSubprovider - no filter with that id:', filterId)
  if (!filter) return cb(null, [])
  var results = filter.getAllResults()
  cb(null, results)
}

FilterSubprovider.prototype.uninstallFilter = function(filterId, cb) {
  const self = this

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

FilterSubprovider.prototype._logsForBlock = function(block, cb) {
  const self = this
  var blockNumber = bufferToHex(block.number)
  self.rootProvider.sendAsync(createPayload({
    method: 'eth_getLogs',
    params: [{
      fromBlock: blockNumber,
      toBlock: blockNumber,
    }],
  }), function(err, results){
    if (err) return cb(err)
    cb(null, results.result)
  })

}

//
// BlockFilter
//

function BlockFilter(opts) {
  // console.log('BlockFilter - new')
  const self = this
  self.rootProvider = opts.rootProvider
  self.blockNumber = opts.blockNumber
  self.updates = []
}

BlockFilter.prototype.update = function(block){
  // console.log('BlockFilter - update')
  const self = this
  var blockHash = bufferToHex(block.hash)
  self.updates.push(blockHash)
}

BlockFilter.prototype.getChanges = function(){
  const self = this
  var results = self.updates
  // console.log('BlockFilter - getChanges:', results.length)
  return results
}

BlockFilter.prototype.clearChanges = function(){
  // console.log('BlockFilter - clearChanges')
  const self = this
  self.updates = []
}

//
// LogFilter
//

function LogFilter(opts) {
  // console.log('LogFilter - new')
  const self = this
  self.fromBlock = opts.fromBlock || 'latest'
  self.toBlock = opts.toBlock || 'latest'
  self.address = opts.address
  self.topics = opts.topics || []
  self.updates = []
  self.allResults = []
}

LogFilter.prototype.validateLog = function(log){
  // console.log('LogFilter - validateLog:', log)
  const self = this
  // block number
  // console.log('LogFilter - validateLog - blockNumber', self.fromBlock, self.toBlock)
  if (blockTagIsNumber(self.fromBlock) && hexToInt(self.fromBlock) <= hexToInt(log.blockNumber)) return false
  if (blockTagIsNumber(self.toBlock) && hexToInt(self.toBlock) >= hexToInt(log.blockNumber)) return false
  // address
  // console.log('LogFilter - validateLog - address', self.address)
  if (self.address && self.address !== log.address) return false
  // topics
  // topics can be nested to represent `and` then `or` [[a || b] && c]
  // console.log('LogFilter - validateLog - topics', self.topics)
  var topicsMatch = self.topics.reduce(function(previousMatched, topic){
    if (!previousMatched) return false
    var subtopics = Array.isArray(topic) ? topic : [topic]
    var topicMatches = subtopics.filter(function(topic){
      return log.topics.indexOf(topic) !== -1
    }).length > 0
    return topicMatches
  }, true)
  // console.log('LogFilter - validateLog - approved!')
  return topicsMatch
}

LogFilter.prototype.update = function(log){
  // console.log('LogFilter - update')
  const self = this
  // validate filter match
  if (!self.validateLog(log)) return
  // add to results
  self.updates.push(log)
  self.allResults.push(log)
}

LogFilter.prototype.getChanges = function(){
  // console.log('LogFilter - getChanges')
  const self = this
  var results = self.updates
  return results
}

LogFilter.prototype.getAllResults = function(){
  // console.log('LogFilter - getAllResults')
  const self = this
  var results = self.allResults
  return results
}

LogFilter.prototype.clearChanges = function(){
  // console.log('LogFilter - clearChanges')
  const self = this
  self.updates = []
}


// util

function intToHex(value) {
  var hexString = value.toString(16)
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

function blockTagIsNumber(blockTag){
  return blockTag && ['earliest', 'latest', 'pending'].indexOf(blockTag) === -1
}
