const inherits = require('util').inherits
const Subprovider = require('./subprovider.js')

module.exports = HttpSubprovider

inherits(HttpSubprovider, Subprovider)

function HttpSubprovider(httpprovider){
  this.provider = httpprovider;
}

HttpSubprovider.prototype.handleRequest = function(payload, next, end){
  this.provider.sendAsync(payload, function(err, response) {
    if (err != null) return end(err);
    if (response.error != null) return end(new Error(response.error.message));
    end(null, response.result);
  });
}
