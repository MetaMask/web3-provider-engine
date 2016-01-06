module.exports = SubProvider;

function SubProvider() {

}

SubProvider.prototype.setEngine = function(engine) {
  const self = this
  this.engine = engine;
  engine.on("block", function(block) {
    self.currentBlock = block;
  });
};

SubProvider.prototype.handleRequest = function(payload, next, end) {
  throw(new Error("Subproviders should override `handleRequest`."));
};
