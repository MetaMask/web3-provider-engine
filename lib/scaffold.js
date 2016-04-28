module.exports = ScaffoldMiddleware

//
// helper for handling only specific methods
// takes an obj with keys as rpc methods and values as static results or middleware functions
//

function ScaffoldMiddleware(staticResponses){
  
  return function scaffoldMiddleware(req, res, next){
    var staticResponse = staticResponses[req.method]
    // async function
    if ('function' === typeof staticResponse) {
      staticResponse(req, res, next)
    // static response - null is valid response
    } else if (staticResponse !== undefined) {
      res.result = staticResponse
      next()
    // no prepared response - skip
    } else {
      next()
    }
  }

}
