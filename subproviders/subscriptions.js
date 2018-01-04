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

SubscriptionSubprovider.prototype.subscribe = function(payload, cb) {
  const self = this
  let createSubscriptionFilter = () => {}

  switch (payload.params[ 0 ]) {
    case 'logs':
      let options = payload.params[ 1 ]

      createSubscriptionFilter = self.newLogFilter.bind(self, options)
      break
    case 'newPendingTransactions':
      createSubscriptionFilter = self.newPendingTransactionFilter.bind(self)
      break
    case 'newHeads':
      createSubscriptionFilter = self.newBlockFilter.bind(self)
      return
    case 'syncing':
    default:
      cb(new Error('unsupported subscription type'))
      return
  }

  createSubscriptionFilter(function(err, id) {
    if (err) return cb(err)
    self.subscriptions[id] = payload.params[0]
    self.filters[id].on('data', function(results) {
      if (!Array.isArray(results)) {
        result = [results]
      }

      var notificationHandler = self._notificationHandler.bind(self, id, payload.params[0])
      results.forEach(notificationHandler)
      self.filters[id].clearChanges()
    })
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
    hash: utils.bufferToHex(result.hash),
    parentHash: utils.bufferToHex(result.parentHash),
    sha3Uncles: utils.bufferToHex(result.sha3Uncles),
    miner: utils.bufferToHex(result.miner),
    stateRoot: utils.bufferToHex(result.stateRoot),
    transactionsRoot: utils.bufferToHex(result.transactionsRoot),
    receiptsRoot: utils.bufferToHex(result.receiptsRoot),
    logsBloom: utils.bufferToHex(result.logsBloom),
    difficulty: from.intToQuantityHex(utils.bufferToInt(result.difficulty)),
    number: from.intToQuantityHex(utils.bufferToInt(result.number)),
    gasLimit: from.intToQuantityHex(utils.bufferToInt(result.gasLimit)),
    gasUsed: from.intToQuantityHex(utils.bufferToInt(result.gasUsed)),
    nonce: result.nonce ? utils.bufferToHex(result.nonce): null,
    timestamp: from.intToQuantityHex(utils.bufferToInt(result.timestamp)),
    extraData: utils.bufferToHex(result.extraData)
  }
}

SubscriptionSubprovider.prototype.unsubscribe = function(connection, payload, cb) {
  let subscriptionId = payload.params[0]
  if (!this.subscriptions[subscriptionId]) {
    cb(new Error(`Subscription ID ${subscriptionId} not found.`))
  } else {
    let subscriptionType = this.subscriptions[subscriptionId]
    if (subscriptionType === 'newHeads') {
      delete this.subscriptions[subscriptionId]
      cb(err, result)
    } else {
      this.uninstallFilter(subscriptionId, function(err, result) {
        delete this.subscriptions[subscriptionId]
        cb(err, result)
      })
    }
  }
}

SubscriptionSubprovider.prototype.handleRequest = function(payload, next, end) {
  switch(payload.method){
    case 'eth_subscribe':
      this.subscribe(payload, end)
      break
    case 'eth_unsubscribe':
      this.unsubscribe(payload, end)
      break
    default:
      FilterSubprovider.prototype.handleRequest.apply(this, Array.prototype.slice.call(arguments))
  }
}

module.exports = SubscriptionSubprovider
