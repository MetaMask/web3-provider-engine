const async = require('async')
const inherits = require('util').inherits
const ethUtil = require('ethereumjs-util')
const Subprovider = require('./subprovider.js')
const Stoplight = require('../util/stoplight.js')

module.exports = FilterSubprovider

// handles the following RPC methods:
//   eth_newBlockFilter
//   eth_newFilter
//   eth_getFilterChanges
//   eth_uninstallFilter
//   eth_getFilterLogs

inherits(FilterSubprovider, Subprovider)

function FilterSubprovider(opts) {
  const self = this
  self.filterIndex = 0
  self.filters = {}
  self.filterDestroyHandlers = {}
  self.logFilterHandlers = {}
  self._ready = new Stoplight()
  self._ready.go()

  // we dont have engine immeditately
  setTimeout(function(){
    // logFilterHandlers require locking provider until updates are completed
    self.engine.on('block', function(block){
      // pause processing
      self._ready.stop()
      // update filters
      var updaters = valuesFor(self.logFilterHandlers)
      .map(function(fn){ return fn.bind(null, block) })
      async.parallel(updaters, function(err){
        if (err) console.error(err)
        // unpause processing
        self._ready.go()
      })
    })
  })
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
      self._ready.await(function(){
        self.getFilterChanges(payload.params[0], end)
      })
      return

    case 'eth_getFilterLogs':
      self._ready.await(function(){
        self.getFilterLogs(payload.params[0], end)
      })
      return

    case 'eth_uninstallFilter':
      self._ready.await(function(){
        self.uninstallFilter(payload.params[0], end)
      })
      return

    default:
      next()
      return
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
    self.engine.on('block', newBlockHandler)
    var destroyHandler = function(){
      self.engine.removeListener('block', newBlockHandler)
    }

    self.filterIndex++
    var hexFilterIndex = intToHex(self.filterIndex)
    self.filters[hexFilterIndex] = filter
    self.filterDestroyHandlers[hexFilterIndex] = destroyHandler

    cb(null, hexFilterIndex)
  })
}

FilterSubprovider.prototype.newFilter = function(opts, cb) {
  const self = this

  self._getBlockNumber(function(err, blockNumber){
    if (err) return cb(err)

    var filter = new LogFilter(opts)
    var newLogHandler = filter.update.bind(filter)
    var logHandlerWrapper = function(block, cb){
      self._logsForBlock(block, function(err, logs){
        if (err) return cb(err)
        logs.forEach(newLogHandler)
        cb()
      })
    }
    var destroyHandler = function(){
      self.engine.removeListener('block', logHandlerWrapper)
    }

    self.filterIndex++
    self.logFilterHandlers[self.filterIndex] = logHandlerWrapper
    var hexFilterIndex = intToHex(self.filterIndex)
    self.filters[hexFilterIndex] = filter
    self.filterDestroyHandlers[hexFilterIndex] = destroyHandler

    // Fill up the results if this filter has a fromBlock in the past
    if (opts.fromBlock && hexToInt(opts.fromBlock) <= hexToInt(blockNumber)) {
      self.emitPayload({
        method: 'eth_getLogs',
        params: [{
          topics: opts.topics,
          address: opts.address,
          fromBlock: opts.fromBlock,
          toBlock: blockNumber
        }],
      }, function(err, response){
        if (err) return cb(err)
        if (response.error) return cb(response.error)

        filter.allResults = filter.allResults.concat(response.result);
        filter.updates = filter.updates.concat(response.result);

        cb(null, hexFilterIndex)
      })

    } else {
      cb(null, hexFilterIndex)
    }
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
  if (!filter) {
    cb(null, false)
    return
  }

  var destroyHandler = self.filterDestroyHandlers[filterId]
  delete self.filters[filterId]
  delete self.logFilterHandlers[filterId]
  delete self.filterDestroyHandlers[filterId]
  destroyHandler()

  cb(null, true)
}

// private

FilterSubprovider.prototype._getBlockNumber = function(cb) {
  const self = this
  var blockNumber = bufferToHex(self.engine.currentBlock.number)
  cb(null, blockNumber)
}

FilterSubprovider.prototype._logsForBlock = function(block, cb) {
  const self = this
  var blockNumber = bufferToHex(block.number)
  self.emitPayload({
    method: 'eth_getLogs',
    params: [{
      fromBlock: blockNumber,
      toBlock: blockNumber,
    }],
  }, function(err, response){
    if (err) return cb(err)
    if (response.error) return cb(response.error)
    cb(null, response.result)
  })

}

//
// BlockFilter
//

function BlockFilter(opts) {
  // console.log('BlockFilter - new')
  const self = this
  self.engine = opts.engine
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
  self.address = opts.address ? normalizeHex(opts.address) : opts.address
  self.topics = opts.topics || []
  self.updates = []
  self.allResults = []
}

LogFilter.prototype.validateLog = function(log){
  // console.log('LogFilter - validateLog:', log)
  const self = this

  // check if block number in bounds:
  // console.log('LogFilter - validateLog - blockNumber', self.fromBlock, self.toBlock)
  if (blockTagIsNumber(self.fromBlock) && hexToInt(self.fromBlock) >= hexToInt(log.blockNumber)) return false
  if (blockTagIsNumber(self.toBlock) && hexToInt(self.toBlock) <= hexToInt(log.blockNumber)) return false

  // address is correct:
  // console.log('LogFilter - validateLog - address', self.address)
  if (self.address && self.address !== log.address) return false

  // topics match:
  // topics are position-dependant
  // topics can be nested to represent `or` [[a || b], c]
  // topics can be null, representing a wild card for that position
  // console.log('LogFilter - validateLog - topics', log.topics)
  // console.log('LogFilter - validateLog - against topics', self.topics)
  var topicsMatch = self.topics.reduce(function(previousMatched, topicPattern, index){
    // abort in progress
    if (!previousMatched) return false
    // wild card
    if (!topicPattern) return true
    // pattern is longer than actual topics
    var logTopic = log.topics[index]
    if (!logTopic) return false
    // check each possible matching topic
    var subtopicsToMatch = Array.isArray(topicPattern) ? topicPattern : [topicPattern]
    var topicDoesMatch = subtopicsToMatch.filter(function(subTopic){
      return logTopic === subTopic
    }).length > 0
    return topicDoesMatch
  }, true)

  // console.log('LogFilter - validateLog - '+(topicsMatch ? 'approved!' : 'denied!')+' ==============')
  return topicsMatch
}

LogFilter.prototype.update = function(log){
  // console.log('LogFilter - update')
  const self = this
  // validate filter match
  var validated = self.validateLog(log)
  if (!validated) return
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

function normalizeHex(hexString) {
  return hexString.slice(0, 2) === '0x' ? hexString : '0x'+hexString
}

function intToHex(value) {
  return ethUtil.intToHex(value)
}

function hexToInt(hexString) {
  return Number(hexString)
}

function bufferToHex(buffer) {
  return '0x'+buffer.toString('hex')
}

function blockTagIsNumber(blockTag){
  return blockTag && ['earliest', 'latest', 'pending'].indexOf(blockTag) === -1
}

function valuesFor(obj){
  return Object.keys(obj).map(function(key){ return obj[key] })
}
