const async = require('async')

module.exports = Web3ProviderEngine


function Web3ProviderEngine() {
  const self = this
  // local state
  self._providers = []
}

// public

Web3ProviderEngine.prototype.addProvider = function(source){
  const self = this
  self._providers.push(source)
}

Web3ProviderEngine.prototype.send = function(payload){
  throw new Error('Web3ProviderEngine does not support synchronous requests.')
}

Web3ProviderEngine.prototype.sendAsync = function(payload, cb){
  const self = this
  if (Array.isArray(payload)) {
    // handle batch
    async.map(payload, self._handleAsync.bind(self), cb)
  } else {
    // handle single
    self._handleAsync(payload, cb)
  }
}

// private

Web3ProviderEngine.prototype._handleAsync = function(payload, finished) {
  var self = this
  var currentProvider = -1
  var result = null
  var error = null

  var stack = []

  next()

  function next(after) {
    currentProvider += 1
    stack.unshift(after)

    // Bubbled down as far as we could go, and the request wasn't
    // handled. Return an error.
    if (currentProvider >= self._providers.length) {
      end(new Error('Request for method "' + payload.method + '" not handled by any subprovider. Please check your subprovider configuration to ensure this method is handled.'))
    } else {
      try {
        var provider = self._providers[currentProvider]
        provider.handleRequest(payload, next, end)
      } catch (e) {
        end(e)
      }
    }
  }

  function end(_error, _result) {
    error = _error
    result = _result

    async.eachSeries(stack, function(fn, callback) {

      if (fn) {
        fn(error, result, callback)
      } else {
        callback()
      }
    }, function() {
      // console.log('COMPLETED:', payload)
      // console.log('RESULT: ', result)

      var resultObj = {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: result
      }

      if (error != null) {
        resultObj.error = {
          message: error.stack || error.message || error,
          code: -32000
        }
        // respond with both error formats
        finished(error, resultObj)
      } else {
        self._inspectResponseForNewBlock(payload, resultObj, finished)
      }
    })
  }
}

// util

function SourceNotFoundError(payload){
  return new Error('Source for RPC method "'+payload.method+'" not found.')
}

