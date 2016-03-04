/*
 * Calculate gasPrice based on last blocks.
 * @author github.com/axic
 *
 * The etherscan.io API supports:
 *
 * 1) Natively
 * - eth_blockNumber
 * - eth_getBlockByNumber
 * - eth_sendRawTransaction
 * - eth_call
 * - eth_getTransactionReceipt
 *
 * 2) Via non-native methods
 * - eth_getBalance
 * - eth_getTransactionCount
 */

const xhr = process.browser ? require('xhr') : require('request')
const inherits = require('util').inherits
const Subprovider = require('./subprovider.js')

module.exports = EtherscanProvider

inherits(EtherscanProvider, Subprovider)

function EtherscanProvider(opts) {
  opts = opts || {}
  this.proto = (opts.https || false) ? 'https' : 'http'
}

EtherscanProvider.prototype.handleRequest = function(payload, next, end){
  // console.log("[etherscan] handle request for:", payload.method);

  switch(payload.method) {
    case 'eth_blockNumber':
      etherscanXHR(this.proto, 'proxy', 'eth_blockNumber', {}, end)
      return

    case 'eth_getBlockByNumber':
      etherscanXHR(this.proto, 'proxy', 'eth_getBlockByNumber', {
        tag: payload.params[0],
        boolean: payload.params[1] }, end)
      return

    case 'eth_getBalance':
      etherscanXHR(this.proto, 'account', 'balance', {
        address: payload.params[0],
        tag: payload.params[1] }, end)
      return

    case 'eth_call':
      etherscanXHR(this.proto, 'proxy', 'eth_call', payload.params[0], end)
      return

    case 'eth_sendRawTransaction':
      etherscanXHR(this.proto, 'proxy', 'eth_sendRawTransaction', { hex: payload.params[0] }, end)
      return

    case 'eth_getTransactionReceipt':
      etherscanXHR(this.proto, 'proxy', 'eth_getTransactionReceipt', { txhash: payload.params[0] }, end)
      return

    case 'eth_getTransactionCount':
      etherscanXHR(this.proto, 'account', 'txlist', {
        sort: 'desc',
        page: 0,
        offset: 0,
        address: payload.params[0] }, function(err, res) {
          if (err === 'No transactions found' || res.length === 0)
            return end(null, 0)
          if (err) return end(err)
          // NOTE: a bit of cheating here.
          // Assumes the sorting did the trick and we get the last tx
          end(null, res[0].nonce)
        })
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

function etherscanXHR(proto, module, action, params, end) {
  var uri = proto + '://api.etherscan.io/api?' + toQueryString({ module: module, action: action }) + '&' + toQueryString(params)
  // console.log('[etherscan] request: ', uri)

  xhr({
    uri: uri,
    method: 'GET',
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
