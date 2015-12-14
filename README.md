### 'zero-client' web3 provider

Here’s an explanation of what I’m currently working on:

a 'zero-client' web3 provider — it is very modular and works via a stack of ‘sub-providers’ which are like normal web3 providers but only handle a subset of rpc methods, specified via `subProvider.methods = [‘eth_call’, ’etc...']`. The intention is to handle as many requests locally as possible, and just let data lookups fallback to some data source ( hosted rpc, blockapps, etc ). Categorically, we don’t want / can’t have the following types of RPC calls go to the network:
* id mgmt + tx signing (requires private data)
* filters (requires a stateful data api)
* vm (expensive, hard to scale)
The subproviders can emit new rpc requests in order to handle their own;  e.g. `eth_call` may trigger `eth_getAccountBalance`, `eth_getCode`, and others.

'zero-client' web3 provider also handles caching of rpc requests