const async = require('async')

module.exports = Web3ProviderEngine


function Web3ProviderEngine(opts) {
  const self = this

  self._sources = []
}

// public

Web3ProviderEngine.prototype.addSource = function(source){
  const self = this
  self._sources.push(source)
}

Web3ProviderEngine.prototype.send = function(payload){
  const self = this
  return self._handleSync(payload)
}

Web3ProviderEngine.prototype.sendAsync = function(payload, cb){
  const self = this
  if (Array.isArray(payload)) {
    // handle batch
    async.each(payload, self._handleAsync.bind(self), cb)
  } else {
    // handle single
    self._handleAsync(payload, cb)
  }
}

// private

Web3ProviderEngine.prototype._sourceForMethod = function(method){
  const self = this
  return self._sources.find(function(source){
    return source.methods.indexOf(method) !== -1
  })
}

Web3ProviderEngine.prototype._handleSync = function(payload){
  var source = self._sourceForMethod(payload.method)
  if (!source) throw SourceNotFoundError(payload)
  var result = source.handleSync(payload)
  return { 
    id: payload.id,
    jsonrpc: payload.jsonrpc,
    result: result,
  }
}

Web3ProviderEngine.prototype._handleAsync = function(payload, cb){
  const self = this
  var source = self._sourceForMethod(payload.method)
  if (!source) return cb(SourceNotFoundError(payload))
  source.handleAsync(payload, function(err, result){
    if (err) return cb(err)
    cb(null, { 
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      result: result,
    })
  })
}

// util

function SourceNotFoundError(payload){
  return new Error('Source for RPC method "'+payload.method+'" not found.')
}

// function asyncify(fn){
//   return function asyncWrapper(){
//     var args = [].slice.call(arguments)
//     var callback = args.pop()
//     try {
//       var result = fn.apply(null, args)
//       callback(null, result)
//     } catch (err) {
//       callback(err)
//     }
//   }
// }

