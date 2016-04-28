const async = require('async')

module.exports = Web3ProviderEngine


function Web3ProviderEngine(opts) {
  const self = this
  self._middlewareStack = []
}

// public

Web3ProviderEngine.prototype.use = function(middleware){
  const self = this
  self._middlewareStack.push(middleware)
}

Web3ProviderEngine.prototype.send = function(req){
  throw new Error('Web3ProviderEngine does not support synchronous requests.')
}

Web3ProviderEngine.prototype.sendAsync = function(req, cb){
  const self = this

  if (Array.isArray(req)) {
    // handle batch
    async.map(req, self._handleAsync.bind(self), cb)
  } else {
    // handle single
    self._handleAsync(req, cb)
  }
}

// private

Web3ProviderEngine.prototype._handleAsync = function(req, done) {
  var self = this

  var stack = self._middlewareStack
  var res = {
    id: req.id,
    jsonrpc: req.jsonrpc,
  }

  walkTheStackDown()

  function walkTheStackDown(){
    // list of middleware, call and collect optional returnHandlers
    async.mapSeries(stack, function eachMiddleware(middleware, cb){
      middleware(req, res, cb)
    }, walkTheStackUp)
  }

  function walkTheStackUp(err, returnHandlers){
    if (err) return done(err)
    // list of returnHandlers, call in reverse
    var backStack = returnHandlers.filter(Boolean).reverse()
    async.mapSeries(backStack, function eachMiddlewareReturnHandler(handler, cb){
      handler(req, res, cb)
    }, onComplete)
  }

  function onComplete(err){
    if (err) return done(err)
    if (res.result === undefined && res.error === undefined) {
      res.error = {
        code: -32601,
        message: req.method+' method not implemented',
      }
      return done(new Error(res.error.message), res)
    }
    done(null, res)
  }

}
