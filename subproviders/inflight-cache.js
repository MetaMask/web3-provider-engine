const cacheIdentifierForPayload = require('../util/rpc-cache-utils.js').cacheIdentifierForPayload
const Subprovider = require('./subprovider.js')


class InflightCacheSubprovider extends Subprovider {

  constructor (opts) {
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

      // setup response handler array for subsequent requests
      activeRequestHandlers = []
      this.inflightRequests[cacheId] = activeRequestHandlers

      // allow request to be handled normally
      next((err, result, cb) => {
        // clear inflight requests
        delete this.inflightRequests[cacheId]
        // once request has been handled, call all waiting handlers
        activeRequestHandlers.forEach((handler) => handler(err, result))
        cb()
      })
    }

    // setup the response lister
    activeRequestHandlers.push(end)
  }
}

module.exports = InflightCacheSubprovider

