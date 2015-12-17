module.exports = StaticProvider


function StaticProvider(staticResponses){
  const self = this
  staticResponses = staticResponses || {}
  self.staticResponses = staticResponses
  self.methods = Object.keys(staticResponses)
}

StaticProvider.prototype.send = function(payload){
  const self = this
  var result = staticResponses[payload.method]
  var resultObj = {
    id: payload.id,
    jsonrpc: '2.0',
    result: result,
  }
  return resultObj
}

StaticProvider.prototype.sendAsync = function(payload, cb){
  const self = this
  var result = self.send(payload)
  cb(null, result)
}