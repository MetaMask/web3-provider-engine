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

  let res, err

  promiseToCallback(

    fetch(targetUrl, reqParams).then((_res) => {
      res = _res

      switch (res.status) {

        case 504:
          let msg = `Gateway timeout. The request took too long to process. `
          msg += `This can happen when querying logs over too wide a block range.`
          err = new Error(msg)
          throw new JsonRpcError.InternalError(err)

        default:
          return res.json()
      }

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
