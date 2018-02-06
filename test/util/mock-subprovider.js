import {inherits} from 'util'
import Subprovider from '../../subproviders/subprovider.js'
import extend from 'xtend'

inherits(MockSubprovider, Subprovider)

function MockSubprovider(handleRequest){
  const self = this

  // Optionally provide a handleRequest method
  if (handleRequest) {
    this.handleRequest = handleRequest
  }
}

var mockResponse = {
  data: 'mock-success!'
}
MockSubprovider.prototype.handleRequest = function(payload, next, end){
  end(mockResponse)
}

export default MockSubprovider
