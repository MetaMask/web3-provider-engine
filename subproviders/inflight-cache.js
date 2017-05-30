const cacheIdentifierForPayload = require('../util/rpc-cache-utils.js').cacheIdentifierForPayload
const Subprovider = require('./subprovider.js')


class InflightCacheSubprovider extends Subprovider {

  constructor (opts) {
    this.inflightRequests = {}
  }

  addEngine (engine) {
    this.engine = engine
  }

  handleRequest (req, next, end) => {
    const cacheId = cacheIdentifierForPayload(req)
    // if not cacheable, skip
    if (!cacheId) return next()
    // check for matching requests
    let activeRequestHandlers = this.inflightRequests[cacheId]
    // if found, wait for the active request to be handled
    if (activeRequestHandlers) {
      // setup the response lister
      activeRequestHandlers.push((handledRes) => {
        const res = {}
        res.result = handledRes.result
        res.error = handledRes.error
        end(null, res)
      })
    } else {
      // setup response handler array for subsequent requests
      activeRequestHandlers = []
      this.inflightRequests[cacheId] = activeRequestHandlers
      // allow request to be handled normally
      next((done) => {
        // clear inflight requests
        delete this.inflightRequests[cacheId]
        // complete this request
        done()
        // once request has been handled, call all waiting handlers
        activeRequestHandlers.forEach((handler) => handler(res))
      })
    }
  }
}

module.exports = InflightCacheSubprovider

