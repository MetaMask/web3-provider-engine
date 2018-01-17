import getRandomId from './random-id.js';
import extend from 'xtend';

function createPayload(data){
  return extend({
    // defaults
    id: getRandomId(),
    jsonrpc: '2.0',
    params: [],
    // user-specified
  }, data)
}

export default createPayload;
