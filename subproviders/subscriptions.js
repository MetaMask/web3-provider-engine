const EventEmitter = require('events').EventEmitter
const FilterSubprovider = require('./filters.js')
const from = require('../util/rpc-hex-encoding.js')
const inherits = require('util').inherits
const utils = require('ethereumjs-util')

function SubscriptionSubprovider(opts) {
  const self = this

  opts = opts || {}

  EventEmitter.apply(this, Array.prototype.slice.call(arguments))
  FilterSubprovider.apply(this, [opts])

  this.subscriptions = {}
}

inherits(SubscriptionSubprovider, FilterSubprovider)

// a cheap crack at multiple inheritance
// I don't really care if `instanceof EventEmitter` passes...
Object.assign(SubscriptionSubprovider.prototype, EventEmitter.prototype)

// preserve our constructor, though
SubscriptionSubprovider.prototype.constructor = SubscriptionSubprovider

SubscriptionSubprovider.prototype.eth_subscribe = function(payload, cb) {
  const self = this
  let createSubscriptionFilter = () => {}
  let subscriptionType = payload.params[0]

  switch (subscriptionType) {
    case 'logs':
      let options = payload.params[1]

      createSubscriptionFilter = self.newLogFilter.bind(self, options)
      break
    case 'newPendingTransactions':
      createSubscriptionFilter = self.newPendingTransactionFilter.bind(self)
      break
    case 'newHeads':
      createSubscriptionFilter = self.newBlockFilter.bind(self)
      break
    case 'syncing':
    default:
      cb(new Error('unsupported subscription type'))
      return
  }

  createSubscriptionFilter(function(err, id) {
    if (err) return cb(err)
    self.subscriptions[id] = subscriptionType

    self.filters[id].on('data', function(results) {
      if (!Array.isArray(results)) {
        results = [results]
      }

      var notificationHandler = self._notificationHandler.bind(self, id, subscriptionType)
      results.forEach(notificationHandler)
      self.filters[id].clearChanges()
    })
    if (subscriptionType === 'newPendingTransactions') {
      self.checkForPendingBlocks()
    }
    cb(null, id)
  })
}

SubscriptionSubprovider.prototype._notificationHandler = function (id, subscriptionType, result) {
  const self = this
  if (subscriptionType === 'newHeads') {
    result = self._notificationResultFromBlock(result)
  }

  // it seems that web3 doesn't expect there to be a separate error event
  // so we must emit null along with the result object
  self.emit('data', null, {
    jsonrpc: "2.0",
    method: "eth_subscription",
    params: {
      subscription: id,
      result: result,
    },
  })
}

SubscriptionSubprovider.prototype._notificationResultFromBlock = function(block) {
  return {
    hash: utils.bufferToHex(block.hash),
    parentHash: utils.bufferToHex(block.parentHash),
    sha3Uncles: utils.bufferToHex(block.sha3Uncles),
    miner: utils.bufferToHex(block.miner),
    stateRoot: utils.bufferToHex(block.stateRoot),
    transactionsRoot: utils.bufferToHex(block.transactionsRoot),
    receiptsRoot: utils.bufferToHex(block.receiptsRoot),
    logsBloom: utils.bufferToHex(block.logsBloom),
    difficulty: from.intToQuantityHex(utils.bufferToInt(block.difficulty)),
    number: from.intToQuantityHex(utils.bufferToInt(block.number)),
    gasLimit: from.intToQuantityHex(utils.bufferToInt(block.gasLimit)),
    gasUsed: from.intToQuantityHex(utils.bufferToInt(block.gasUsed)),
    nonce: block.nonce ? utils.bufferToHex(block.nonce): null,
    timestamp: from.intToQuantityHex(utils.bufferToInt(block.timestamp)),
    extraData: utils.bufferToHex(block.extraData)
  }
}

SubscriptionSubprovider.prototype.eth_unsubscribe = function(payload, cb) {
  const self = this
  let subscriptionId = payload.params[0]
  if (!self.subscriptions[subscriptionId]) {
    cb(new Error(`Subscription ID ${subscriptionId} not found.`))
  } else {
    let subscriptionType = self.subscriptions[subscriptionId]
    self.uninstallFilter(subscriptionId, function (err, result) {
      delete self.subscriptions[subscriptionId]
      cb(err, result)
    })
  }
}

SubscriptionSubprovider.prototype.handleRequest = function(payload, next, end) {
  switch(payload.method){
    case 'eth_subscribe':
      this.eth_subscribe(payload, end)
      break
    case 'eth_unsubscribe':
      this.eth_unsubscribe(payload, end)
      break
    default:
      FilterSubprovider.prototype.handleRequest.apply(this, Array.prototype.slice.call(arguments))
  }
}

module.exports = SubscriptionSubprovider
