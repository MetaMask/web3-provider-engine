const getRandomId = require('./random-id.js')
const extend = require('xtend')

module.exports = createPayload


function createPayload(data) {
  return extend({
    // defaults
    id: getRandomId(),
    params: [],
    // user-specified
  }, data)
}
