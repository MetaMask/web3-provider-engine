const inherits = require('util').inherits
const createPayload = require('../util/create-payload.js')
const Subprovider = require('./subprovider.js')

module.exports = RpcSource

inherits(RpcSource, Subprovider)

function RpcSource(opts) {
  const self = this
  self.rpcUrl = opts.rpcUrl
}


RpcSource.prototype.handleRequest = function (payload, next, end) {
  const self = this
  var targetUrl = self.rpcUrl
  var method = payload.method
  var params = payload.params

  // new payload with random large id,
  // so as not to conflict with other concurrent users
  var newPayload = createPayload(payload)

  // console.log('------------------ network attempt -----------------')
  // console.log(payload)
  // console.log('---------------------------------------------')

  fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(newPayload),
    rejectUnauthorized: false,
  })
  .then((res) => {
    if (res.status != 200) {
      return new Error("HTTP Error: " + res.statusCode + " on " + method);
    }
    return res.json()
  })
  .then((data) => end(null, data.result))
  .catch((error) => {
    return end(error)
  })
}