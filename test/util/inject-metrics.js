
module.exports = injectSubproviderMetrics

function injectSubproviderMetrics(subprovider){
  subprovider.payloadsWitnessed = {}
  subprovider.payloadsHandled = {}

  subprovider.getWitnessed = getWitnessed.bind(subprovider)
  subprovider.getHandled = getHandled.bind(subprovider)

  var _super = subprovider.handleRequest.bind(subprovider)
  subprovider.handleRequest = handleRequest.bind(subprovider, _super)

  return subprovider
}

function getWitnessed(method){
  const self = this
  var witnessed = self.payloadsWitnessed[method] = self.payloadsWitnessed[method] || []
  return witnessed
}

function getHandled(method){
  const self = this
  var witnessed = self.payloadsHandled[method] = self.payloadsHandled[method] || []
  return witnessed
}

function handleRequest(_super, req, res, next){
  const self = this
  // mark req witnessed
  var witnessed = self.getWitnessed(req.method)
  witnessed.push(req)
  // record res before handling
  var resBefore = JSON.stringify(res)
  // continue
  _super(req, res, function(err, returnHandler){
    if (err) return next(err)
    var resAfter = JSON.stringify(res)
    var wasHandled = resBefore !== resAfter
    // mark req handled
    if (wasHandled) {
      var handled = self.getHandled(req.method)
      handled.push(req)
     }
    // continue
    next(null, returnHandler)
  })
}