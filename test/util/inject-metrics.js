
module.exports = injectSubproviderMetrics

function injectSubproviderMetrics (subprovider) {
  subprovider.getWitnessed = getWitnessed.bind(subprovider)
  subprovider.getHandled = getHandled.bind(subprovider)
  subprovider.clearMetrics = () => {
    subprovider.payloadsWitnessed = {}
    subprovider.payloadsHandled = {}
  }

  subprovider.clearMetrics()

  const _super = subprovider.handleRequest.bind(subprovider)
  subprovider.handleRequest = handleRequest.bind(subprovider, _super)

  return subprovider
}

function getWitnessed (method) {
  const self = this
  const witnessed = self.payloadsWitnessed[method] = self.payloadsWitnessed[method] || []
  return witnessed
}

function getHandled (method) {
  const self = this
  const witnessed = self.payloadsHandled[method] = self.payloadsHandled[method] || []
  return witnessed
}

function handleRequest (_super, payload, next, end) {
  const self = this
  // mark payload witnessed
  const witnessed = self.getWitnessed(payload.method)
  witnessed.push(payload)
  // continue
  _super(payload, next, function (err, result) {
    // mark payload handled
    const handled = self.getHandled(payload.method)
    handled.push(payload)
    // continue
    end(err, result)
  })
}
