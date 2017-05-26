const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const clone = require('clone')
const cacheUtils = require('../util/rpc-cache-utils.js')
const Stoplight = require('../util/stoplight.js')
const Subprovider = require('./subprovider.js')


class AdaptedRpcSubprovider extends Subprovider {

  constructor (rpcSubprovider) {
    this.rpcSubprovider = rpcSubprovider
  }

  setEngine (engine) {
    this.engine = engine
  }

  handleRequest (payload, next, end) {
    const res = {}
    this.rpcSubprovider(payload, res, next, (err) => {
      end (err, res)
    })
  }

}

module.exports = AdaptedRpcSubprovider

