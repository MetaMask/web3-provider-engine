const getRandomId = require('./random-id.js')

module.exports = createPayload


function createPayload(data){
  return {
    id: data.id === undefined ? getRandomId() : data.id,
    jsonrpc: data.jsonrpc  === undefined ? '2.0' : data.jsonrpc,
    method: data.method,
    params: data.params || [],
  }
}