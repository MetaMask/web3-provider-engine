const test = require('tape')
const asyncSeries = require('async/series')
const ProviderEngine = require('../index.js')
const SubscriptionSubprovider = require('../subproviders/subscriptions.js')
const TestBlockProvider = require('./util/block.js')
const createPayload = require('../util/create-payload.js')
const injectMetrics = require('./util/inject-metrics')

subscriptionTest('basic block subscription', {}, {
    method: 'eth_subscribe',
    params: ['newHeads']
  },
  function afterInstall(t, testMeta, response, cb){
    // nothing to do here, we just need a new block, which subscriptionTest does for us
    cb()
  },
  function subscriptionChanges(t, testMeta, response, cb){
    let returnedBlockHash = response.params.result.hash
    t.equal(returnedBlockHash, testMeta.block.hash, 'correct result')
    cb()
  }
)

subscriptionTest('log subscription - basic', {}, {
    method: 'eth_subscribe',
    params: ['logs', {
      topics: ['0x00000000000000000000000000000000000000000000000000deadbeefcafe01']
    }],
  },
  function afterInstall(t, testMeta, response, cb){
    testMeta.tx = testMeta.blockProvider.addTx({
      hash: '0x0000000000000000000000000000000000000000000000000000000000000001',
      _logTopics: ['0x00000000000000000000000000000000000000000000000000deadbeefcafe01']
    })
    testMeta.badTx = testMeta.blockProvider.addTx({
      _logTopics: ['0x00000000000000000000000000000000000000000000000000deadbeefcafe02']
    })
    cb()
  },
  function subscriptionChanges(t, testMeta, response, cb){
    var matchedLog = response.params.result
    t.ok(matchedLog.transactionHash, 'result has tx hash')
    t.deepEqual(matchedLog.transactionHash, testMeta.tx.hash, 'result tx hash matches')
    cb()
  }
)

subscriptionTest('log subscription - and logic', {}, {
    method: 'eth_subscribe',
    params: ['logs', {
      topics: [
      '0x00000000000000000000000000000000000000000000000000deadbeefcafe01',
      '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
      ],
    }],
  },
  function afterInstall(t, testMeta, response, cb){
    testMeta.tx = testMeta.blockProvider.addTx({
      hash: '0x0000000000000000000000000000000000000000000000000000000000000001',
      _logTopics: [
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe01',
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
      ],
    })
    testMeta.badTx = testMeta.blockProvider.addTx({
      _logTopics: [
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe01',
      ],
    })
    cb()
  },
  function subscriptionChangesOne(t, testMeta, response, cb){
    var matchedLog = response.params.result
    t.ok(matchedLog.transactionHash, 'result has tx hash')
    t.deepEqual(matchedLog.transactionHash, testMeta.tx.hash, 'result tx hash matches')
    cb()
  }
)

subscriptionTest('log subscription - or logic', {}, {
    method: 'eth_subscribe',
    params: ['logs', {
      topics: [
        [
          '0x00000000000000000000000000000000000000000000000000deadbeefcafe01',
          '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
        ],
      ],
    }],
  },
  function afterInstall(t, testMeta, response, cb){
    testMeta.tx1 = testMeta.blockProvider.addTx({
      hash: '0x0000000000000000000000000000000000000000000000000000000000000001',
      _logTopics: [
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe01',
      ],
    })
    cb()
  },
  function subscriptionChangesOne(t, testMeta, response, cb){
    var matchedLog = response.params.result
    t.ok(matchedLog.transactionHash, 'result has tx hash')
    t.deepEqual(matchedLog.transactionHash, testMeta.tx1.hash, 'result log matches tx hash')

    testMeta.tx2 = testMeta.blockProvider.addTx({
      hash: '0x0000000000000000000000000000000000000000000000000000000000000002',
      _logTopics: [
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
      ],
    })
    cb()
  },
  function subscriptionChangesTwo(t, testMeta, response, cb){
    var matchedLog = response.params.result
    t.ok(matchedLog.transactionHash, 'result has tx hash')
    t.deepEqual(matchedLog.transactionHash, testMeta.tx2.hash, 'result log matches tx hash')
    cb()
  }
)

subscriptionTest('log subscription - wildcard logic', {}, {
    method: 'eth_subscribe',
    params: ['logs', {
      topics: [
        null,
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
      ],
    }],
  },
  function afterInstall(t, testMeta, response, cb){
    testMeta.tx1 = testMeta.blockProvider.addTx({
      _logTopics: [
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe01',
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
      ],
    })
    cb()
  },
  function subscriptionChangesOne(t, testMeta, response, cb){
    var matchedLog = response.params.result
    t.equal(matchedLog.transactionHash, testMeta.tx1.hash, 'result log matches tx hash')
    testMeta.tx2 = testMeta.blockProvider.addTx({
      _logTopics: [
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
        '0x00000000000000000000000000000000000000000000000000deadbeefcafe02',
      ],
    })
    cb()
  },
  function subscriptionChangesTwo(t, testMeta, response, cb){
    var matchedLog = response.params.result
    t.equal(matchedLog.transactionHash, testMeta.tx2.hash, 'result log matches tx hash')
    cb()
  }
)

subscriptionTest('block subscription - parsing large difficulty', { triggerNextBlock: false }, {
    method: 'eth_subscribe',
    params: ['newHeads']
  },
  function afterInstall(t, testMeta, response, cb) {
    const newBlock = testMeta.blockProvider.nextBlock({
      gasLimit: '0x01',
      difficulty: '0xfffffffffffffffffffffffffffffffe'
    })
    cb()
  },
  function subscriptionChangesOne(t, testMeta, response, cb) {
    var returnedDifficulty = response.params.result.difficulty
    var returnedGasLimit = response.params.result.gasLimit
    t.equal(returnedDifficulty, '0xfffffffffffffffffffffffffffffffe', 'correct result')
    t.equal(returnedGasLimit, '0x01', 'correct result')
    cb()
  }
)

function subscriptionTest(label, opts, subscriptionPayload, afterInstall, subscriptionChangesOne, subscriptionChangesTwo) {
  const shouldTriggerNextBlock = opts.triggerNextBlock === undefined ? true : opts.triggerNextBlock
  let testMeta = {}
  let t = test('subscriptions - '+label, function(t) {
    // subscribe
    // new block
    // check for notification


    // handle "test_rpc"
    let subscriptionSubprovider = testMeta.subscriptionSubprovider = injectMetrics(new SubscriptionSubprovider())
    // handle block requests
    let blockProvider = testMeta.blockProvider = injectMetrics(new TestBlockProvider())

    let engine = testMeta.engine = new ProviderEngine({
      pollingInterval: 200,
      pollingShouldUnref: false,
    })
    engine.addProvider(subscriptionSubprovider)
    engine.addProvider(blockProvider)

    let response, notification
    
    asyncSeries([
      // wait for first block
      (next) => {
        engine.start()
        engine.once('rawBlock', (block) => {
          testMeta.block = block
          next()
        })
      },
      // install subscription
      (next) => {
        engine.sendAsync(createPayload(subscriptionPayload), function(err, _response){
          if (err) return next(err)

          response = _response
          t.ok(response, 'has response')
  
          let method = subscriptionPayload.method
          t.equal(subscriptionSubprovider.getWitnessed(method).length, 1, 'subscriptionSubprovider did see "'+method+'"')
          t.equal(subscriptionSubprovider.getHandled(method).length, 1, 'subscriptionSubprovider did handle "'+method+'"')
  
          testMeta.subscriptionId = response.result
          next()
        })
      },
      // manipulates next block to trigger a notification
      (next) => afterInstall(t, testMeta, response, next),
      (next) => {
        checkSubscriptionChanges(subscriptionChangesOne, next)
      },
      (next) => {
        if (!subscriptionChangesTwo) return next()
        checkSubscriptionChanges(subscriptionChangesTwo, next)
      },
      // cleanup
      (next) => {
        engine.sendAsync(createPayload({ method: 'eth_unsubscribe', params: [testMeta.subscriptionId] }), next)
      },
    ], (err) => {
      t.ifErr(err)
      testMeta.engine.stop()
      t.end()
    })

    function checkSubscriptionChanges(onChange, cb) {
      let notification
      asyncSeries([
        // wait for subscription trigger
        (next) => {
          engine.once('data', (err, _notification) => {
            if (err) return next(err)
            notification = _notification
            // validate notification
            let subscriptionId = testMeta.subscriptionId
            t.ok(notification, 'has notification')
            t.equal(notification.params.subscription, subscriptionId, 'notification has correct subscription id')
            next()
          })
          // create next block so that notification is sent
          if (shouldTriggerNextBlock) {
            testMeta.block = testMeta.blockProvider.nextBlock()
          }
        },
        // call test-specific onChange handler
        (next) => {
          onChange(t, testMeta, notification, next)
        },
      ], cb)
    }

  })
}
