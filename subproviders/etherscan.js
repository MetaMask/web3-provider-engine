/*
 * Etherscan.io API connector
 * @author github.com/axic
 *
 * The etherscan.io API supports:
 *
 * 1) Natively via proxy methods
 * - eth_blockNumber *
 * - eth_getBlockByNumber *
 * - eth_getBlockTransactionCountByNumber
 * - getTransactionByHash
 * - getTransactionByBlockNumberAndIndex
 * - eth_getTransactionCount *
 * - eth_sendRawTransaction *
 * - eth_call *
 * - eth_getTransactionReceipt *
 * - eth_getCode *
 * - eth_getStorageAt *
 *
 * 2) Via non-native methods
 * - eth_getBalance
 */

const xhr = process.browser ? require('xhr') : require('request')
const inherits = require('util').inherits
const Subprovider = require('./subprovider.js')

module.exports = EtherscanProvider

inherits(EtherscanProvider, Subprovider)

function EtherscanProvider(opts) {
  opts = opts || {}
  this.network = (opts.network !== 'api' && opts.network !== 'testnet') ? 'api' : opts.network
  this.proto = (opts.https || false) ? 'https' : 'http'
}

EtherscanProvider.prototype.handleRequest = function(payload, next, end){
  // console.log("[etherscan] handle request for:", payload.method);

  switch(payload.method) {
    case 'eth_blockNumber':
      etherscanXHR(this.proto, this.network, 'proxy', 'eth_blockNumber', {}, end)
      return

    case 'eth_getBlockByNumber':
      etherscanXHR(this.proto, this.network, 'proxy', 'eth_getBlockByNumber', {
        tag: payload.params[0],
        boolean: payload.params[1] }, end)
      return

    case 'eth_getBlockTransactionCountByNumber':
      etherscanXHR(this.proto, this.network, 'proxy', 'eth_getBlockTransactionCountByNumber', {
        tag: payload.params[0]
      }, end)
      return

    case 'eth_getTransactionByHash':
      etherscanXHR(this.proto, this.network, 'proxy', 'eth_getTransactionByHash', {
        txhash: payload.params[0]
      }, end)
      return

    case 'eth_getBalance':
      etherscanXHR(this.proto, this.network, 'account', 'balance', {
        address: payload.params[0],
        tag: payload.params[1] }, end)
      return

    case 'eth_call':
      etherscanXHR(this.proto, this.network, 'proxy', 'eth_call', payload.params[0], end)
      return

    case 'eth_sendRawTransaction':
      etherscanXHR(this.proto, this.network, 'proxy', 'eth_sendRawTransaction', { hex: payload.params[0] }, end)
      return

    case 'eth_getTransactionReceipt':
      etherscanXHR(this.proto, this.network, 'proxy', 'eth_getTransactionReceipt', { txhash: payload.params[0] }, end)
      return

    // note !! this does not support topic filtering yet, it will return all block logs
    case 'eth_getLogs':
      var payloadObject = payload.params[0],
          proto = this.proto,
          network = this.network,
          txProcessed = 0,
          logs = [];

      etherscanXHR(proto, network, 'proxy', 'eth_getBlockByNumber', {
        tag: payloadObject.toBlock,
        boolean: payload.params[1] }, function(err, blockResult) {
          if(err) return end(err);

          for(var transaction in blockResult.transactions){
            etherscanXHR(proto, network, 'proxy', 'eth_getTransactionReceipt', { txhash: transaction.hash }, function(err, receiptResult) {
              if(!err) logs.concat(receiptResult.logs);
              txProcessed += 1;
              if(txProcessed === blockResult.transactions.length) end(null, logs)
            })
          }
        })
      return

    case 'eth_getTransactionCount':
      etherscanXHR(this.proto, this.network, 'proxy', 'eth_getTransactionCount', {
        address: payload.params[0],
        tag: payload.params[1]
      }, end)
      return

    case 'eth_getCode':
      etherscanXHR(this.proto, this.network, 'proxy', 'eth_getCode', {
        address: payload.params[0],
        tag: payload.params[1]
      }, end)
      return

    case 'eth_getStorageAt':
      etherscanXHR(this.proto, this.network, 'proxy', 'eth_getStorageAt', {
        address: payload.params[0],
        position: payload.params[1],
        tag: payload.params[2]
      }, end)
      return

    default:
      next();
      return
  }
}

function toQueryString(params) {
  return Object.keys(params).map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k])
  }).join('&')
}

function etherscanXHR(proto, network, module, action, params, end) {
  var uri = proto + '://' + network + '.etherscan.io/api?' + toQueryString({ module: module, action: action }) + '&' + toQueryString(params)
  // console.log('[etherscan] request: ', uri)

  xhr({
    uri: uri,
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      // 'Content-Type': 'application/json',
    },
    rejectUnauthorized: false,
  }, function(err, res, body) {
    // console.log('[etherscan] response: ', err)

    if (err) return end(err)

    var data
    try {
      data = JSON.parse(body)
    } catch (err) {
      console.error(err.stack)
      return end(err)
    }

    // console.log('[etherscan] response decoded: ', data)

    // NOTE: or use id === -1? (id=1 is 'success')
    if ((module === 'proxy') && data.error) {
      // Maybe send back the code too?
      return end(data.error.message)
    }

    // NOTE: or data.status !== 1?
    if ((module === 'account') && (data.message !== 'OK')) {
      return end(data.message)
    }

    end(null, data.result)
  })
}
