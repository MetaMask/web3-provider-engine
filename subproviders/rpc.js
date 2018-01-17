import xhr from 'request';
import {inherits} from 'util';
import createPayload from '../util/create-payload.js';
import Subprovider from './subprovider.js';
import JsonRpcError from 'json-rpc-error';

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
    if (err) return end(new JsonRpcError.InternalError(err))

    // check for error code
    switch (res.statusCode) {
      case 405:
        return end(new JsonRpcError.MethodNotFound())
      case 504: // Gateway timeout
        let msg = `Gateway timeout. The request took too long to process. `
        msg += `This can happen when querying logs over too wide a block range.`
        const err = new Error(msg)
        return end(new JsonRpcError.InternalError(err))
      default:
        if (res.statusCode != 200) {
          return end(new JsonRpcError.InternalError(res.body))
        }
    }

    // parse response
    let data
    try {
      data = JSON.parse(body)
    } catch (err) {
      console.error(err.stack)
      return end(new JsonRpcError.InternalError(err))
    }
    if (data.error) return end(data.error)

    end(null, data.result)
  })
}

export default RpcSource;
