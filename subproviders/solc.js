const inherits = require('util').inherits
const solc = require('solc')
const Subprovider = require('./subprovider.js')

module.exports = SolcSubprovider

inherits(SolcSubprovider, Subprovider)

function SolcSubprovider(opts) {
}

SolcSubprovider.prototype.handleRequest = function(payload, next, end) {
  switch (payload.method) {
    case 'eth_getCompilers':
      cb(null, [ "solidity" ])
      break

    case 'eth_compileSolidity':
      compileSolidity(payload, end)
      break;

    default:
      next()
  }
}

// Conforms to https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_compilesolidity
function compileSolidity(payload, end) {
  // optimised
  var output = solc.compile(payload.params[0], 1)
  if (!output) {
    end('Compilation error')
  } else if (output.errors) {
    end(output.errors)
  } else {
    // Select first contract FIXME??
    var contract = output.contracts[Object.keys(output.contracts)[0]];

    var ret = {
      code: contract.bytecode,
      info: {
        source: payload.params[0],
        language: 'Solidity',
        languageVersion: '0',
        compilerVersion: solc.version(),
        abiDefinition: JSON.parse(contract.interface),
        userDoc: { methods: {} },
        developerDoc: { methods: {} }
      }
    }

    end(null, ret)
  }
}
