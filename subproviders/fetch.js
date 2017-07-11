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
  self.originHttpHeaderKey = opts.originHttpHeaderKey
}

RpcSource.prototype.handleRequest = function(payload, next, end){
  const self = this
  const targetUrl = self.rpcUrl
  const originDomain = payload.origin

  // overwrite id to not conflict with other concurrent users
  const newPayload = createPayload(payload)
  // remove extra parameter from request
  delete newPayload.origin

  const reqParams = {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(newPayload),
  }

  if (self.originHttpHeaderKey && originDomain) {
    reqParams.headers[self.originHttpHeaderKey] = originDomain
  }

  promiseToCallback(fetch(targetUrl, reqParams))((err, res) => {
    if (err) return end(err)

    // check for errors
    switch (res.status) {

      case 405:
        throw new JsonRpcError.MethodNotFound()

      case 418:
        let msg = `Request is being rate limited.`
        err = new Error(msg)
        throw new JsonRpcError.InternalError(err)

      case 503:
      case 504:
        let msg = `Gateway timeout. The request took too long to process. `
        msg += `This can happen when querying logs over too wide a block range.`
        err = new Error(msg)
        throw new JsonRpcError.InternalError(err)

    }

    // continue parsing result
    promiseToCallback(res.json())((err, body) => {
      if (err) return end(err)

      // check for error code
      if (res.status != 200) {
        throw new JsonRpcError.InternalError(body)
      }
      // check for rpc error
      if (body.error) throw new JsonRpcError.InternalError(body.error)
      // return successful result
      end(body.result)
    })
  })

}
