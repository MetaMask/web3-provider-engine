'use strict';

var ProviderEngine = require('./index.js');
var DefaultFixture = require('./subproviders/default-fixture.js');
var NonceTrackerSubprovider = require('./subproviders/nonce-tracker.js');
var CacheSubprovider = require('./subproviders/cache.js');
var FilterSubprovider = require('./subproviders/filters.js');
var InflightCacheSubprovider = require('./subproviders/inflight-cache');
var HookedWalletSubprovider = require('./subproviders/hooked-wallet.js');
var SanitizingSubprovider = require('./subproviders/sanitizer.js');
var RpcSubprovider = require('./subproviders/rpc.js');
var FetchSubprovider = require('./subproviders/fetch.js');

module.exports = ZeroClientProvider;

function ZeroClientProvider(opts) {
  opts = opts || {};

  var engine = new ProviderEngine(opts.engineParams);

  // static
  var staticSubprovider = new DefaultFixture(opts.static);
  engine.addProvider(staticSubprovider);

  // nonce tracker
  engine.addProvider(new NonceTrackerSubprovider());

  // sanitization
  var sanitizer = new SanitizingSubprovider();
  engine.addProvider(sanitizer);

  // cache layer
  var cacheSubprovider = new CacheSubprovider();
  engine.addProvider(cacheSubprovider);

  // filters
  var filterSubprovider = new FilterSubprovider();
  engine.addProvider(filterSubprovider);

  // inflight cache
  var inflightCache = new InflightCacheSubprovider();
  engine.addProvider(inflightCache);

  // id mgmt
  var idmgmtSubprovider = new HookedWalletSubprovider({
    // accounts
    getAccounts: opts.getAccounts,
    // transactions
    processTransaction: opts.processTransaction,
    approveTransaction: opts.approveTransaction,
    signTransaction: opts.signTransaction,
    publishTransaction: opts.publishTransaction,
    // messages
    // old eth_sign
    processMessage: opts.processMessage,
    approveMessage: opts.approveMessage,
    signMessage: opts.signMessage,
    // new personal_sign
    processPersonalMessage: opts.processPersonalMessage,
    processTypedMessage: opts.processTypedMessage,
    approvePersonalMessage: opts.approvePersonalMessage,
    approveTypedMessage: opts.approveTypedMessage,
    signPersonalMessage: opts.signPersonalMessage,
    signTypedMessage: opts.signTypedMessage,
    personalRecoverSigner: opts.personalRecoverSigner
  });
  engine.addProvider(idmgmtSubprovider);

  // data source
  var dataSubprovider = opts.dataSubprovider || new FetchSubprovider({
    rpcUrl: opts.rpcUrl || 'https://mainnet.infura.io/',
    originHttpHeaderKey: opts.originHttpHeaderKey
  });
  engine.addProvider(dataSubprovider);

  // start polling
  engine.start();

  return engine;
}