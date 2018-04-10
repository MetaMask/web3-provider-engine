const inherits = require('util').inherits
const Subprovider = require('./subprovider.js')

// wraps a provider in a subprovider interface

module.exports = ProviderSubprovider

inherits(ProviderSubprovider, Subprovider)

function ProviderSubprovider(provider){
  this.provider = provider
}

ProviderSubprovider.prototype.handleRequest = function(payload, next, end){
  this.provider.sendAsync(payload, function(err, response) {
    if (err) return end(err)
    if (response.error) return end(new Error(response.error.message))
    end(null, response.result)
  })
}
