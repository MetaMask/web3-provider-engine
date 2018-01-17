import {inherits} from 'util'
import FixtureProvider from '../../subproviders/fixture.js'

//
// handles no methods, skips all requests
// mostly useless
//

inherits(PassthroughProvider, FixtureProvider)
function PassthroughProvider(methods){
  const self = this
  FixtureProvider.call(self, {})
}

export default PassthroughProvider
