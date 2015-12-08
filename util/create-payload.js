const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER

module.exports = createPayload


function createPayload(data){
  return {
    id: getRandomId(),
    jsonrpc: '2.0',
    method: data.method,
    params: data.params || [],
  }
}

function getRandomId(){
  return Math.floor(Math.random()*MAX_SAFE_INTEGER)
}
