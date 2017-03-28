const fetch = global.fetch || require('fetch-ponyfill')().fetch
const inherits = require('util').inherits
const createPayload = require('../util/create-payload.js')
const Subprovider = require('./subprovider.js')
const JsonRpcError = require('json-rpc-error')
const promiseToCallback = require('promise-to-callback')


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
  let newPayload = createPayload(payload)
  let res, err

  promiseToCallback(

    fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newPayload),
    }).then((_res) => {
      res = _res
      return res.json()
    }).then((body) => {
      // check for error code
      switch (res.status) {
        case 405:
          throw new JsonRpcError.MethodNotFound()
        default:
          if (res.status != 200) {
            throw new JsonRpcError.InternalError(body)
          }
      }
      if (body.error) throw new JsonRpcError.InternalError(body.error)
      return body.result
    })

  )(end)
}
