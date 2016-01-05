module.exports = StaticProvider

function StaticProvider(staticResponses){
  const self = this
  staticResponses = staticResponses || {}
  self.staticResponses = staticResponses
  self.methods = Object.keys(staticResponses)
}

StaticProvider.prototype.handleRequest = function(payload, next, end){
  if (typeof this.staticResponses[payload.method] != 'undefined') {
    end(null, staticResponses[payload.method]);
  } else {
    next();
  }
}
