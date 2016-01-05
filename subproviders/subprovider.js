const inherits = require('util').inherits;

module.exports = SubProvider;

function SubProvider() {

}

SubProvider.prototype.handleRequest(payload, next, end) {
  throw(new Error("Subproviders should override `handleRequest`."));
}
