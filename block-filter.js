module.exports = BlockFilter


function BlockFilter (provider) {
  var self = this
  self.provider = provider
}

BlockFilter.prototype.initialize = function(callback) {
  var self = this
  if (self.provider.verbosity >= 1) console.log('   BlockFilter.initialize')
  self.provider.eth_blockNumber(function(err, number) {
    if (err) return callback(err)
      
    self.block_number = toDecimal(number)
    callback()
  })
}

BlockFilter.prototype.getChanges = function(callback) {
  var self = this
  if (self.provider.verbosity >= 1) console.log('   BlockFilter.getChanges')
  self.provider.eth_blockNumber(function(err, finish_number) {
    if (err) return callback(err)
      
    finish_number = toDecimal(finish_number)
    self.getBlockHashesRecursively([], self.block_number, finish_number + 1, callback)
  })
}

BlockFilter.prototype.getBlockHashesRecursively = function(hashes, current_number, finish_number, callback) {
  var self = this
  if (self.provider.verbosity >= 1) console.log('   BlockFilter.getBlockHashesRecursively')
  self.getBlockHash(current_number, function(err, hash) {
    if (err) return callback(err)
      
    if (hash) {
      hashes.push(hash)
    }
    if (current_number >= finish_number || hash == null) {
      callback(null, hashes)
      return
    }
    self.getBlockHashesRecursively(hashes, current_number + 1, finish_number, callback)
  })
}

BlockFilter.prototype.getBlockHash = function(block_number, callback) {
  if (self.provider.verbosity >= 1) console.log('   BlockFilter.getBlockHash')

  // Request the next block so we can get the parent hash.

  ///////////////////////////////////////////////////////////////////////////////
  /////////////////////////////// BIG DIRTY HACK! ///////////////////////////////
  ///////////////////////////////////////////////////////////////////////////////

  // Explanation: When you query blockapps for a block by block number, it won't
  // give you its own hash. Instead, it gives you the hash of the block that came
  // before it (parentHash). In order to successfully get the hash of the current
  // block number, then, we have to request block with number (block_number + 1).
  // However: stablenet, currently, isn't a blockchain that continues punching out
  // blocks every 12 seconds or so, which means the block with block number of
  // (block_number + 1) won't exist until someone makes another transaction, which
  // could be never (stablenet creates new blocks as transactions come in). So,
  // in order to get this to work correctly with web3, we're actually going to
  // request the *current* block (block_number), rather than the next block
  // (block_number + 1). This is going to return the wrong parent hash, but it's
  // the only way we can successfully integrate with most apps that use block
  // filters. Thankfully, the block hashes in block filters don't usually matter.

  // Here's what the code should be once stablenet starts acting like a real network:
  // self.provider.requestFromBlockApps('/block?number=' + (block_number + 1), ...)
  self.provider.requestFromBlockApps('/block?number=' + block_number, (function(_this) {
    return function(err, block_result) {
      var block
      if (err) {
        callback(err)
        return
      }
      if (block_result.length === 0) {
        callback()
        return
      }
      block = block_result[0]
      callback(null, '0x' + block.blockData.parentHash)
    }
  })(this))
}