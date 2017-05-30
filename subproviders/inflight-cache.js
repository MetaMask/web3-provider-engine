const cacheIdentifierForPayload = require('../util/rpc-cache-utils.js').cacheIdentifierForPayload
const Subprovider = require('./subprovider.js')


class InflightCacheSubprovider extends Subprovider {

  constructor (opts) {
    super()
    this.inflightRequests = {}
  }

  addEngine (engine) {
    this.engine = engine
  }

  handleRequest (req, next, end) {
    const cacheId = cacheIdentifierForPayload(req)

    // if not cacheable, skip
    if (!cacheId) return next()

    // check for matching requests
    let activeRequestHandlers = this.inflightRequests[cacheId]

    if (!activeRequestHandlers) {
      activeRequestHandlers = []
      this.inflightRequests[cacheId] = activeRequestHandlers

      next((err, result, cb) => {
        delete this.inflightRequests[cacheId]
        activeRequestHandlers.forEach((handler) => handler(err, result))
        cb(err, result)
      })

    } else {
      // setup the response lister
      activeRequestHandlers.push(end)
    }

  }
}

module.exports = InflightCacheSubprovider

