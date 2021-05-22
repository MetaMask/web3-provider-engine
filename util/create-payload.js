const getRandomId = require('./random-id.js')

module.exports = createPayload


function createPayload(data){
  return Object.assign({
    // defaults
    id: getRandomId(),
    jsonrpc: '2.0',
    params: [],
    // user-specified
  }, data)
}
