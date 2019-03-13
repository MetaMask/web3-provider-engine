const Subprovider = require('./subprovider.js')

// wraps a json-rpc-engine middleware in a subprovider interface

class JsonRpcEngineMiddlewareSubprovider extends Subprovider {

  // take a constructorFn to call once we have a reference to the engine
  constructor (constructorFn) {
    super()
    if (!constructorFn) throw new Error('JsonRpcEngineMiddlewareSubprovider - no constructorFn specified')
    this._constructorFn = constructorFn
  }

  // this is called once the subprovider has been added to the provider engine
  setEngine (engine) {
    if (this.middleware) throw new Error('JsonRpcEngineMiddlewareSubprovider - subprovider added to engine twice')
    const blockTracker = engine._blockTracker
    const middleware = this._constructorFn({ engine, blockTracker })
    if (!middleware) throw new Error('JsonRpcEngineMiddlewareSubprovider - no middleware specified')
    if (typeof middleware !== 'function') throw new Error('JsonRpcEngineMiddlewareSubprovider - specified middleware is not a function')
    this.middleware = middleware
  }

  handleRequest (req, provEngNext, provEngEnd) {
    const res = { id: req.id }
    console.log('middleware:', req)
    this.middleware(req, res, middlewareNext, middlewareEnd)

    function middlewareNext (handler) {
      console.log('middleware called next', res)
      provEngNext((err, result, cb) => {
        // update response object with result or error
        if (err) {
          delete res.result
          res.error = { message: err.message || err }
        } else {
          res.result = result
        }
        // call middleware's next handler (even if error)
        handler(cb)
      })
    }

    function middlewareEnd (err) {
      if (err) return provEngEnd(err)
      console.log('middleware called end', res)
      provEngEnd(null, res.result)
    }
  }

}

module.exports = JsonRpcEngineMiddlewareSubprovider
