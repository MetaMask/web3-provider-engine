module.exports = ManipulationDetector


function ManipulationDetector(){
  detector.current = undefined
  detector.previous = undefined
  detector.detected = false
  detector.reset = reset

  return detector

  function detector(req, res, next){
    var current = detector.current
    var rawRes = JSON.stringify(res)
    if (detector.detected) return next()
    if (!current) {
      detector.current = rawRes
    } else {
      detector.detected = (current !== rawRes)
      detector.previous = current
      detector.current = rawRes
    }
    next()
  }

  function reset(){
    detector.detected = false
    detector.current = undefined
    detector.previous = undefined
  }

}