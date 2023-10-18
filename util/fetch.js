if (process.browser) {
  module.exports = window.fetch;
} else {
  /* eslint-disable no-undef */
  if (typeof globalThis !== 'undefined' && globalThis.fetch) {
    module.exports = globalThis.fetch;
  } else if (typeof global !== 'undefined' && global.fetch) {
    module.exports = global.fetch;
  } else {
    module.exports = require('node-fetch');
  }
}
