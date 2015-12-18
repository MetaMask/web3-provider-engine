### 'zero-client' web3 provider engine

Here’s an explanation of what I’m currently working on:

a 'zero-client' web3 provider — it is very modular and works via a stack of ‘sub-providers’ which are like normal web3 providers but only handle a subset of rpc methods,
specified via `subProvider.methods = [‘eth_call’, ’etc...']`.
The intention is to handle as many requests locally as possible, and just let data lookups fallback to some data source ( hosted rpc, blockapps, etc ).
Categorically, we don’t want / can’t have the following types of RPC calls go to the network:
* id mgmt + tx signing (requires private data)
* filters (requires a stateful data api)
* vm (expensive, hard to scale)

The subproviders can emit new rpc requests in order to handle their own;  e.g. `eth_call` may trigger `eth_getAccountBalance`, `eth_getCode`, and others.
The provider engine also handles caching of rpc request results.


### Current RPC method support:

##### static
- [x] web3_clientVersion
- [x] net_version
- [x] net_listening
- [x] net_peerCount
- [x] eth_protocolVersion
- [x] eth_hashrate
- [x] eth_mining
- [x] eth_syncing

##### filters
- [x] eth_newBlockFilter
- [ ] eth_newPendingTransactionFilter
- [x] eth_newFilter
- [x] eth_uninstallFilter
- [x] eth_getFilterLogs
- [x] eth_getFilterChanges

##### accounts manager
- [ ] eth_coinbase
- [ ] eth_accounts
- [ ] eth_sendTransaction
- [ ] eth_sign ( not used in web3.js )

##### vm
- [x] eth_call
- [x] eth_estimateGas

##### db source
- [ ] db_putString
- [ ] db_getString
- [ ] db_putHex
- [ ] db_getHex

##### compiler
- [ ] eth_getCompilers
- [ ] eth_compileLLL
- [ ] eth_compileSerpent
- [ ] eth_compileSolidity

##### shh gateway
- [ ] shh_version
- [ ] shh_post
- [ ] shh_newIdentity
- [ ] shh_hasIdentity
- [ ] shh_newGroup
- [ ] shh_addToGroup

##### data source ( fallback to rpc )
* eth_gasPrice
* eth_blockNumber
* eth_getBalance
* eth_getBlockByHash
* eth_getBlockByNumber
* eth_getBlockTransactionCountByHash
* eth_getBlockTransactionCountByNumber
* eth_getCode
* eth_getStorageAt
* eth_getTransactionByBlockHashAndIndex
* eth_getTransactionByBlockNumberAndIndex
* eth_getTransactionByHash
* eth_getTransactionCount
* eth_getTransactionReceipt
* eth_getUncleByBlockHashAndIndex
* eth_getUncleByBlockNumberAndIndex
* eth_getUncleCountByBlockHash
* eth_getUncleCountByBlockNumber
* eth_sendRawTransaction
* eth_getLogs ( not used in web3.js )

##### ( not supported )
* eth_getWork
* eth_submitWork
* eth_submitHashrate ( not used in web3.js )
