const test = require('tape')
const ProviderEngine = require('../index.js')
const FilterProvider = require('../subproviders/filters.js')
const TestBlockProvider = require('./util/block.js')
const createPayload = require('../util/create-payload.js')
const injectMetrics = require('./util/inject-metrics')


test('filters - basic block filter', function(t){
  // t.plan(8)

  // install filter
  // new block
  // check filter

  // handle "test_rpc"
  var filterProvider = injectMetrics(new FilterProvider())
  // handle block requests
  var blockProvider = injectMetrics(new TestBlockProvider())

  var engine = new ProviderEngine({
    pollingInterval: 20,
  })
  engine.addProvider(filterProvider)
  engine.addProvider(blockProvider)
  engine.start()

  // install block filter
  engine.sendAsync(createPayload({ method: 'eth_newBlockFilter' }), function(err, response){
    t.ifError(err, 'did not error')
    t.ok(response, 'has response')

    t.equal(filterProvider.getWitnessed('eth_newBlockFilter').length, 1, 'filterProvider did see "eth_newBlockFilter"')
    t.equal(filterProvider.getHandled('eth_newBlockFilter').length, 1, 'filterProvider did handle "eth_newBlockFilter"')

    var filterId = response.result

    // increment block
    var block = blockProvider.nextBlock()
    engine.once('block', function(){

      // check filter
      engine.sendAsync(createPayload({ method: 'eth_getFilterChanges', params: [filterId] }), function(err, response){
        t.ifError(err, 'did not error')
        t.ok(response, 'has response')

        t.equal(filterProvider.getWitnessed('eth_getFilterChanges').length, 1, 'filterProvider did see "eth_getFilterChanges"')
        t.equal(filterProvider.getHandled('eth_getFilterChanges').length, 1, 'filterProvider did handle "eth_getFilterChanges"')

        var results = response.result        
        var returnedBlockHash = response.result[0]
        t.equal(results.length, 1, 'correct number of results')
        t.equal(returnedBlockHash, block.hash, 'correct result')

        // post check
        engine.sendAsync(createPayload({ method: 'eth_getFilterChanges', params: [filterId] }), function(err, response){
          t.ifError(err, 'did not error')
          t.ok(response, 'has response')

          t.equal(filterProvider.getWitnessed('eth_getFilterChanges').length, 2, 'filterProvider did see "eth_getFilterChanges"')
          t.equal(filterProvider.getHandled('eth_getFilterChanges').length, 2, 'filterProvider did handle "eth_getFilterChanges"')

          var results = response.result        
          t.equal(results.length, 0, 'correct number of results')

          engine.stop()
          t.end()
        })

      })

    })
  })

})
