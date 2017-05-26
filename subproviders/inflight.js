const inflightRpcMiddleware = require('eth-json-rpc-middleware/inflight-cache')
const RpcAdapter = require('../util/rpc-middleware-adapter')

module.exports = new RpcAdapter(inflightRpcMiddleware())

