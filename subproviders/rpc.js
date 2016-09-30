const xhr = process.browser ? require('xhr') : require('request')
const createPayload = require('../util/create-payload.js')

module.exports = RpcSource


function RpcSource(opts) {
  const self = this
  self.rpcUrl = opts.rpcUrl
}


RpcSource.prototype.handleRequest = function(payload, next, end){
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

  xhr({
    uri: targetUrl,
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(newPayload),
    rejectUnauthorized: false,
  }, function(err, res, body) {
    if (err) return end(err)

    // parse response into raw account
    var data
    try {
      data = JSON.parse(body)
      if (data.error) return end(data.error)
    } catch (err) {
      console.error(err.stack)
      return end(err)
    }

    // console.log('network:', payload.method, payload.params, '->', data.result)

    end(null, data.result)
  })

}
