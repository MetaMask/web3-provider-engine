// const EventEmitter = require('events').EventEmitter
// const inherits = require('util').inherits

// module.exports = BaseProvider


// inherits(BaseProvider, EventEmitter)

// function BaseProvider(){
//   const self = this
//   EventEmitter.call(self)
//   // local state
//   self.currentBlock = null
// }

// BaseProvider.prototype.setCurrentBlock = function(block){
//   const self = this
//   self.currentBlock = block
//   self.emit('block', block)
// }

// BaseProvider.prototype.send = function(payload){
//   const self = this
//   return self._handleSync(payload)
// }

// BaseProvider.prototype.sendAsync = function(payload, cb){
//   const self = this
//   if (Array.isArray(payload)) {
//     // handle batch
//     async.each(payload, self._handleAsync.bind(self), cb)
//   } else {
//     // handle single
//     self._handleAsync(payload, cb)
//   }
// }

// // private

// BaseProvider.prototype._handleSync = function(payload){
//   throw new Error('RPC Method not handled in provider sync stack: '+payload.method)
//   // const self = this
//   // var fn = self.syncRpc[payload.method]
//   // if (!fn) throw new Error('RPC Method not handled in provider sync stack: '+payload.method)
//   // var result = fn(payload)
//   // return { 
//   //   id: payload.id,
//   //   jsonrpc: payload.jsonrpc,
//   //   result: result,
//   // }
// }

// BaseProvider.prototype._handleAsync = function(payload, cb){
//   var err = new Error('RPC Method not handled in provider async stack: '+payload.method)
//   cb(err)
//   // const self = this
//   // // try async
//   // var fn = self.asyncRpc[payload.method]
//   // // fallback to sync stack
//   // if (!fn) {
//   //   var syncFn = self.syncRpc[payload.method]
//   //   if (syncFn) fn = asyncify(syncFn)
//   // }
//   // // if no handler, fail
//   // if (!fn) throw new Error('RPC Method not handled in provider async stack: '+payload.method)
//   // // if handler, process
//   // fn(payload, function(err, result){
//   //   if (err) return cb(err)
//   //   cb(null, { 
//   //     id: payload.id,
//   //     jsonrpc: payload.jsonrpc,
//   //     result: result,
//   //   })
//   // })
// }
