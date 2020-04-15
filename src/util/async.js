module.exports = {
  // Works the same as async.parallel
  parallel (fns, done) {
    done = done || function () {}
    this.map(fns, function (fn, callback) {
      fn(callback)
    }, done)
  },

  // Works the same as async.map
  map (items, iterator, done) {
    done = done || function () {}
    const results = []
    let failure = false
    const expected = items.length
    let actual = 0
    const createIntermediary = function (index) {
      return function (err, result) {
        // Return if we found a failure anywhere.
        // We can't stop execution of functions since they've already
        // been fired off; but we can prevent excessive handling of callbacks.
        if (failure != false) {
          return
        }

        if (err != null) {
          failure = true
          done(err, result)
          return
        }

        actual += 1

        if (actual == expected) {
          done(null, results)
        }
      }
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      iterator(item, createIntermediary(i))
    }

    if (items.length == 0) {
      done(null, [])
    }
  },

  // Works like async.eachSeries
  eachSeries (items, iterator, done) {
    done = done || function () {}
    const results = []
    const failure = false
    const expected = items.length
    let current = -1

    function callback (err, result) {
      if (err) {
        return done(err)
      }

      results.push(result)

      if (current == expected) {
        return done(null, results)
      }
      next()

    }

    function next () {
      current += 1

      const item = items[current]
      iterator(item, callback)
    }

    next()
  },
}
