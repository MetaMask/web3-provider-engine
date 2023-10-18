const fetch = require('../util/fetch.js')
const inherits = require('util').inherits
const createPayload = require('../util/create-payload.js')
const Subprovider = require('./subprovider.js')
const { rpcErrors, serializeError } = require('@metamask/rpc-errors')


module.exports = RpcSource

inherits(RpcSource, Subprovider)

function RpcSource(opts) {
  const self = this
  self.rpcUrl = opts.rpcUrl
}

RpcSource.prototype.handleRequest = function(payload, next, end){
  const self = this
  const targetUrl = self.rpcUrl

  // overwrite id to conflict with other concurrent users
  const sanitizedPayload = sanitizePayload(payload)
  const newPayload = createPayload(sanitizedPayload)

  fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(newPayload),
  }).catch((err) => {
    end(serializeError(err))
  }).then(res => {
    // check for error code
    switch (res.status) {
      case 405:
        return end(rpcErrors.methodNotFound())
      case 504: // Gateway timeout
        return (function(){
          let msg = `Gateway timeout. The request took too long to process. `
          msg += `This can happen when querying logs over too wide a block range.`
          const err = new Error(msg)
          return end(serializeError(err))
        })()
      case 429: // Too many requests (rate limiting)
        return (function(){
          const err = new Error(`Too Many Requests`)
          return end(serializeError(err))
        })()
      default:
        if (res.statusCode != 200) {
          const msg = 'Unknown Error: ' + res.body
          const err = new Error(msg)
          return end(serializeError(err))
        }
    }
    return res.body()
  }).catch(err => {
    console.error(err.stack)
    end(serializeError(err))
  }).then(data => {
    if (!data) return
    if (data.error) return end(data.error)

    end(null, data.result)
  })
}

// drops any non-standard params
function sanitizePayload (payload) {
  return {
    id: payload.id,
    jsonrpc: payload.jsonrpc,
    method: payload.method,
    params: payload.params,
  }
}
