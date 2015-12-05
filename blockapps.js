require('object.entries').shim()
const Transaction = require('ethereumjs-tx')
const HookedWeb3Provider = require('hooked-web3-provider')
const BlockAppsVm = require('blockapps-vm')
const XMLHttpRequest = require('xhr2')
const BigNumber = require('bignumber.js')

function Web3ProviderSkeleton(options) {
  if (options == null) {
    options = {}
  }

  HookedWeb3Provider.call(this, {host: options.host, transaction_signer: options.transaction_signer})

  this.coinbase = options.coinbase

  if (this.coinbase.indexOf('0x') < 0) {
    this.coinbase = '0x' + this.coinbase
  }

  // accounts is an object returned from ethereumjs-accounts
  // i.e., accounts = accounts.get(). Key is the address, value is the account info.
  this.accounts = options.accounts || []

  for (var [index, account] of Object.entries(this.accounts)) {
    if (account.indexOf('0x') < 0) {
      this.accounts[index] = '0x' + account
    }
  }

  this.host = options.host || 'http://hacknet.blockapps.net'
  this.version = options.version || 'v1.0'
  this.blockchain = options.blockchain || 'eth'
  this.verbosity = options.verbosity || 0
  this.gasPrice = options.gasPrice || 1000000000000
  this.transaction_signer = options.transaction_signer || function() {
    throw new Error('No key provider given to BlockApps + Web3. Can\'t send transaction.')
  }
  this.filter_index = 0
  this.filters = {}
}

Web3ProviderSkeleton.prototype.send = function(payload) {
  switch (payload.method) {
    case 'eth_accounts':
      var response = {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: this.accounts
      }
      return response
  }
  throw new Error('Web3ProviderSkeleton does not support synchronous methods. Please provide a callback.')
}

// sendAsync acts as the director with which we call blockapps functions based
// on RPC functions, and then wrap up the result to look like a JSON rpc response.
// This is our hook into web3 -- all the other functions support this one.
Web3ProviderSkeleton.prototype.sendAsync = function(payload, callback) {
  var self = this
  var finishedWithRewrite = function(err) {
    if (err != null) {
      return callback(err)
    }

    if (payload instanceof Array) {
      self.processBatchRequest(payload, callback)
    } else {
      self.processSingleRequest(payload, callback)
    }
  }

  var requests = payload

  if (!(payload instanceof Array)) {
    requests = [payload]
  }

  this.rewritePayloads(0, requests, {}, finishedWithRewrite)
}

Web3ProviderSkeleton.prototype.processSingleRequest = function(payload, callback) {
  var method = payload.method

  if (this[method] == null) {
    callback(new Error('Web3ProviderSkeleton does not yet support the Web3 method '' + method + ''.'))
    return
  }

  var params = payload.params || []
  var args = params.slice()

  // Push a callback function to wrap up the response into
  // what web3 expects.
  args.push(function(err, result) {
    var wrapped = {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
    }

    if (err != null) {
      wrapped.error = err.stack
    } else {
      wrapped.result = result
    }

    callback(null, wrapped)
  })

  var fn = this[method]
  if (fn.length !== args.length) {
    callback(new Error('Invalid number of parameters passed to ' + method))
    return
  }

  fn.apply(this, args)
}

// Process batch requests in series.
Web3ProviderSkeleton.prototype.processBatchRequest = function(batch, callback) {
  if (this.verbosity >= 1) console.log('   Web3ProviderSkeleton.processBatchRequest')

  var clone = batch.slice()

  if (this.verbosity >= 1) {
    var output = 'batch start: '+batch.join(' ')
    console.log(output)
  }

  this.makeBatchRequests(0, clone, [], callback)
}

Web3ProviderSkeleton.prototype.makeBatchRequests = function(current_index, batch, results, finished) {
  if (current_index >= batch.length) {
    return finished(null, results)
  }

  this.processSingleRequest(batch[current_index], function(err, r){
    results.push(r)
    this.makeBatchRequests(current_index + 1, batch, results, finished)
  })
}