const inherits = require('util').inherits
const Subprovider = require('./subprovider.js')

module.exports = Web3Subprovider

inherits(Web3Subprovider, Subprovider)

function Web3Subprovider(provider){
  this.provider = provider;
}

Web3Subprovider.prototype.handleRequest = function(payload, next, end){
  this.provider.sendAsync(payload, function(err, response) {
    if (err != null) return end(err);
    if (response.error != null) return end(new Error(response.error.message));
    end(null, response.result);
  });
}
