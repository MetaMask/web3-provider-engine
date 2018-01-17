'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var ethUtil = _interopDefault(require('ethereumjs-util'));
var EthBlockTracker = _interopDefault(require('eth-block-tracker'));
var async = require('async');
var async__default = _interopDefault(async);
var extend = _interopDefault(require('xtend'));
var Transaction = _interopDefault(require('ethereumjs-tx'));
var stringify = _interopDefault(require('json-stable-stringify'));
var clone = _interopDefault(require('clone'));
var sigUtil = _interopDefault(require('eth-sig-util'));
var Semaphore = _interopDefault(require('semaphore'));
var xhr = _interopDefault(require('request'));
var JsonRpcError = _interopDefault(require('json-rpc-error'));
var fetch = _interopDefault(require('fetch-ponyfill'));
var promiseToCallback = _interopDefault(require('promise-to-callback'));
var solc = _interopDefault(require('solc'));
var readableStream = require('readable-stream');
var hooked = require('ethereumjs-vm/lib/hooked');
var Block = _interopDefault(require('ethereumjs-block'));
var FakeTransaction = _interopDefault(require('ethereumjs-tx/fake.js'));

var domain;

// This constructor is used to store event handlers. Instantiating this is
// faster than explicitly calling `Object.create(null)` to get a "clean" empty
// object (tested with v8 v4.9).
function EventHandlers() {}
EventHandlers.prototype = Object.create(null);

function EventEmitter() {
  EventEmitter.init.call(this);
}
// nodejs oddity
// require('events') === require('events').EventEmitter
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.usingDomains = false;

EventEmitter.prototype.domain = undefined;
EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

EventEmitter.init = function() {
  this.domain = null;
  if (EventEmitter.usingDomains) {
    // if there is an active domain, then attach to it.
    if (domain.active && !(this instanceof domain.Domain)) {
      this.domain = domain.active;
    }
  }

  if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
    this._events = new EventHandlers();
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events, domain;
  var needDomainExit = false;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  domain = this.domain;

  // If there is no 'error' event listener then throw.
  if (doError) {
    er = arguments[1];
    if (domain) {
      if (!er)
        er = new Error('Uncaught, unspecified "error" event');
      er.domainEmitter = this;
      er.domain = domain;
      er.domainThrown = false;
      domain.emit('error', er);
    } else if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
    // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
    // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  if (needDomainExit)
    domain.exit();

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = new EventHandlers();
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] = prepend ? [listener, existing] :
                                          [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
                            existing.length + ' ' + type + ' listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        emitWarning(w);
      }
    }
  }

  return target;
}
function emitWarning(e) {
  typeof console.warn === 'function' ? console.warn(e) : console.log(e);
}
EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function _onceWrap(target, type, listener) {
  var fired = false;
  function g() {
    target.removeListener(type, g);
    if (!fired) {
      fired = true;
      listener.apply(target, arguments);
    }
  }
  g.listener = listener;
  return g;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || (list.listener && list.listener === listener)) {
        if (--this._eventsCount === 0)
          this._events = new EventHandlers();
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length; i-- > 0;) {
          if (list[i] === listener ||
              (list[i].listener && list[i].listener === listener)) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (list.length === 1) {
          list[0] = undefined;
          if (--this._eventsCount === 0) {
            this._events = new EventHandlers();
            return this;
          } else {
            delete events[type];
          }
        } else {
          spliceOne(list, position);
        }

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = new EventHandlers();
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = new EventHandlers();
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        for (var i = 0, key; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = new EventHandlers();
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        do {
          this.removeListener(type, listeners[listeners.length - 1]);
        } while (listeners[0]);
      }

      return this;
    };

EventEmitter.prototype.listeners = function listeners(type) {
  var evlistener;
  var ret;
  var events = this._events;

  if (!events)
    ret = [];
  else {
    evlistener = events[type];
    if (!evlistener)
      ret = [];
    else if (typeof evlistener === 'function')
      ret = [evlistener.listener || evlistener];
    else
      ret = unwrapListeners(evlistener);
  }

  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, i) {
  var copy = new Array(i);
  while (i--)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

// shim for using process in browser
// based off https://github.com/defunctzombie/node-process/blob/master/browser.js

if (typeof global.setTimeout === 'function') {
    
}
if (typeof global.clearTimeout === 'function') {
    
}







 // empty string to avoid regexp issues


















// from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
var performance = global.performance || {};
var performanceNow =
  performance.now        ||
  performance.mozNow     ||
  performance.msNow      ||
  performance.oNow       ||
  performance.webkitNow  ||
  function(){ return (new Date()).getTime() };

// generate timestamp or delta
// see http://nodejs.org/api/process.html#process_process_hrtime

var inherits;
if (typeof Object.create === 'function'){
  inherits = function inherits(ctor, superCtor) {
    // implementation from standard node.js 'util' module
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  inherits = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    var TempCtor = function () {};
    TempCtor.prototype = superCtor.prototype;
    ctor.prototype = new TempCtor();
    ctor.prototype.constructor = ctor;
  };
}
var inherits$1 = inherits;

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.



// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.






/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.






























// log is just a thin wrapper to console.log that prepends a timestamp



/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */

inherits$1(Stoplight, EventEmitter);

function Stoplight() {
  var self = this;
  EventEmitter.call(self);
  self.isLocked = true;
}

Stoplight.prototype.go = function () {
  var self = this;
  self.isLocked = false;
  self.emit('unlock');
};

Stoplight.prototype.stop = function () {
  var self = this;
  self.isLocked = true;
  self.emit('lock');
};

Stoplight.prototype.await = function (fn) {
  var self = this;
  if (self.isLocked) {
    self.once('unlock', fn);
  } else {
    setTimeout(fn);
  }
};

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};











var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();









var inherits$2 = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

var Web3ProviderEngine = function (_EventEmitter) {
  inherits$2(Web3ProviderEngine, _EventEmitter);

  function Web3ProviderEngine(opts) {
    classCallCheck(this, Web3ProviderEngine);

    var _this = possibleConstructorReturn(this, (Web3ProviderEngine.__proto__ || Object.getPrototypeOf(Web3ProviderEngine)).call(this));

    var self = _this;
    EventEmitter.call(self);
    self.setMaxListeners(30);
    //parse options
    opts = opts || {};
    //block polling
    var skipInitLockProvider = { sendAsync: self._handleAsync.bind(self) };
    var blockTrackerProvider = opts.blockTrackerProvider || skipInitLockProvider;
    self._blockTracker = new EthBlockTracker({
      provider: blockTrackerProvider,
      pollingInterval: opts.pollingInterval || 4000
    });
    //handle new block
    self._blockTracker.on('block', function (jsonBlock) {
      var bufferBlock = _this.toBufferBlock(jsonBlock);
      self._setCurrentBlock(bufferBlock);
    });

    //emit block events from the block tracker
    self._blockTracker.on('block', self.emit.bind(self, 'rawBlock'));
    self._blockTracker.on('sync', self.emit.bind(self, 'sync'));
    self._blockTracker.on('latest', self.emit.bind(self, 'latest'));

    //set initialization blocker
    self._ready = new Stoplight();
    //unblock initialization after first block
    self._blockTracker.once('block', function () {
      self._ready.go();
    });
    //local state
    self.currentBlock = null;
    self._providers = [];
    return _this;
  }

  //public


  createClass(Web3ProviderEngine, [{
    key: 'start',
    value: function start() {
      var self = this;
      //start block polling
      self._blockTracker.start();
    }
  }, {
    key: 'stop',
    value: function stop() {
      var self = this;
      //stop block polling
      self._blockTracker.stop();
    }
  }, {
    key: 'addProvider',
    value: function addProvider(source) {
      var self = this;
      self._providers.push(source);
      source.setEngine(this);
    }
  }, {
    key: 'send',
    value: function send(payload) {
      throw new Error('Web3ProviderEngine does not support synchronous requests.');
    }
  }, {
    key: 'sendAsync',
    value: function sendAsync(payload, cb) {
      var self = this;
      self._ready.await(function () {

        if (Array.isArray(payload)) {
          //handle batch
          async.map(payload, self._handleAsync.bind(self), cb);
        } else {
          //handle single
          self._handleAsync(payload, cb);
        }
      });
    }

    //private

  }, {
    key: '_handleAsync',
    value: function _handleAsync(payload, finished) {
      var self = this;
      var currentProvider = -1;
      var result = null;
      var error = null;

      var stack = [];

      next();

      function next(after) {
        currentProvider += 1;
        stack.unshift(after);

        //Bubbled down as far as we could go, and the request wasn't
        //handled. Return an error.
        if (currentProvider >= self._providers.length) {
          end(new Error('Request for method "' + payload.method + '" not handled by any subprovider. Please check your subprovider configuration to ensure this method is handled.'));
        } else {
          try {
            var provider = self._providers[currentProvider];
            provider.handleRequest(payload, next, end);
          } catch (e) {
            end(e);
          }
        }
      }

      function end(_error, _result) {
        error = _error;
        result = _result;

        async.eachSeries(stack, function (fn, callback) {

          if (fn) {
            fn(error, result, callback);
          } else {
            callback();
          }
        }, function () {
          //console.log('COMPLETED:', payload)
          //console.log('RESULT: ', result)

          var resultObj = {
            id: payload.id,
            jsonrpc: payload.jsonrpc,
            result: result
          };

          if (error != null) {
            resultObj.error = {
              message: error.stack || error.message || error,
              code: -32000
            };
            //respond with both error formats
            finished(error, resultObj);
          } else {
            finished(null, resultObj);
          }
        });
      }
    }

    //
    //from remote-data
    //

  }, {
    key: '_setCurrentBlock',
    value: function _setCurrentBlock(block) {
      var self = this;
      self.currentBlock = block;
      self.emit('block', block);
    }

    //util

  }, {
    key: 'toBufferBlock',
    value: function toBufferBlock(jsonBlock) {
      return {
        number: ethUtil.toBuffer(jsonBlock.number),
        hash: ethUtil.toBuffer(jsonBlock.hash),
        parentHash: ethUtil.toBuffer(jsonBlock.parentHash),
        nonce: ethUtil.toBuffer(jsonBlock.nonce),
        sha3Uncles: ethUtil.toBuffer(jsonBlock.sha3Uncles),
        logsBloom: ethUtil.toBuffer(jsonBlock.logsBloom),
        transactionsRoot: ethUtil.toBuffer(jsonBlock.transactionsRoot),
        stateRoot: ethUtil.toBuffer(jsonBlock.stateRoot),
        receiptsRoot: ethUtil.toBuffer(jsonBlock.receiptRoot || jsonBlock.receiptsRoot),
        miner: ethUtil.toBuffer(jsonBlock.miner),
        difficulty: ethUtil.toBuffer(jsonBlock.difficulty),
        totalDifficulty: ethUtil.toBuffer(jsonBlock.totalDifficulty),
        size: ethUtil.toBuffer(jsonBlock.size),
        extraData: ethUtil.toBuffer(jsonBlock.extraData),
        gasLimit: ethUtil.toBuffer(jsonBlock.gasLimit),
        gasUsed: ethUtil.toBuffer(jsonBlock.gasUsed),
        timestamp: ethUtil.toBuffer(jsonBlock.timestamp),
        transactions: jsonBlock.transactions
      };
    }
  }]);
  return Web3ProviderEngine;
}(EventEmitter);

// gotta keep it within MAX_SAFE_INTEGER
var extraDigits = 3;

function createRandomId() {
  // 13 time digits
  var datePart = new Date().getTime() * Math.pow(10, extraDigits);
  // 3 random digits
  var extraPart = Math.floor(Math.random() * Math.pow(10, extraDigits));
  // 16 digits
  return datePart + extraPart;
}

function createPayload(data) {
  return extend({
    // defaults
    id: createRandomId(),
    jsonrpc: '2.0',
    params: []
    // user-specified
  }, data);
}

// this is the base class for a subprovider -- mostly helpers
function SubProvider() {}

SubProvider.prototype.setEngine = function (engine) {
  var self = this;
  self.engine = engine;
  engine.on('block', function (block) {
    self.currentBlock = block;
  });
};

SubProvider.prototype.handleRequest = function (payload, next, end) {
  throw new Error('Subproviders should override `handleRequest`.');
};

SubProvider.prototype.emitPayload = function (payload, cb) {
  var self = this;
  self.engine.sendAsync(createPayload(payload), cb);
};

inherits$1(FixtureProvider, SubProvider);

function FixtureProvider(staticResponses) {
  var self = this;
  staticResponses = staticResponses || {};
  self.staticResponses = staticResponses;
}

FixtureProvider.prototype.handleRequest = function (payload, next, end) {
  var self = this;
  var staticResponse = self.staticResponses[payload.method];
  // async function
  if ('function' === typeof staticResponse) {
    staticResponse(payload, next, end);
    // static response - null is valid response
  } else if (staticResponse !== undefined) {
    // return result asynchronously
    setTimeout(function () {
      return end(null, staticResponse);
    });
    // no prepared response - skip
  } else {
    next();
  }
};

var version$1 = "13.4.0";

inherits$1(DefaultFixtures, FixtureProvider);

function DefaultFixtures(opts) {
  var self = this;
  opts = opts || {};
  var responses = extend({
    web3_clientVersion: 'ProviderEngine/v' + version$1 + '/javascript',
    net_listening: true,
    eth_hashrate: '0x00',
    eth_mining: false
  }, opts);
  FixtureProvider.call(self, responses);
}

function cacheIdentifierForPayload(payload) {
  var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  if (!canCache(payload)) return null;
  var includeBlockRef = opts.includeBlockRef;

  var params = includeBlockRef ? payload.params : paramsWithoutBlockTag(payload);
  return payload.method + ':' + stringify(params);
}

function canCache(payload) {
  return cacheTypeForPayload(payload) !== 'never';
}

function blockTagForPayload(payload) {
  var index = blockTagParamIndex(payload);

  // Block tag param not passed.
  if (index >= payload.params.length) {
    return null;
  }

  return payload.params[index];
}

function paramsWithoutBlockTag(payload) {
  var index = blockTagParamIndex(payload);

  // Block tag param not passed.
  if (index >= payload.params.length) {
    return payload.params;
  }

  // eth_getBlockByNumber has the block tag first, then the optional includeTx? param
  if (payload.method === 'eth_getBlockByNumber') {
    return payload.params.slice(1);
  }

  return payload.params.slice(0, index);
}

function blockTagParamIndex(payload) {
  switch (payload.method) {
    // blockTag is second param
    case 'eth_getBalance':
    case 'eth_getCode':
    case 'eth_getTransactionCount':
    case 'eth_getStorageAt':
    case 'eth_call':
    case 'eth_estimateGas':
      return 1;
    // blockTag is first param
    case 'eth_getBlockByNumber':
      return 0;
    // there is no blockTag
    default:
      return undefined;
  }
}

function cacheTypeForPayload(payload) {
  switch (payload.method) {
    // cache permanently
    case 'web3_clientVersion':
    case 'web3_sha3':
    case 'eth_protocolVersion':
    case 'eth_getBlockTransactionCountByHash':
    case 'eth_getUncleCountByBlockHash':
    case 'eth_getCode':
    case 'eth_getBlockByHash':
    case 'eth_getTransactionByHash':
    case 'eth_getTransactionByBlockHashAndIndex':
    case 'eth_getTransactionReceipt':
    case 'eth_getUncleByBlockHashAndIndex':
    case 'eth_getCompilers':
    case 'eth_compileLLL':
    case 'eth_compileSolidity':
    case 'eth_compileSerpent':
    case 'shh_version':
      return 'perma';

    // cache until fork
    case 'eth_getBlockByNumber':
    case 'eth_getBlockTransactionCountByNumber':
    case 'eth_getUncleCountByBlockNumber':
    case 'eth_getTransactionByBlockNumberAndIndex':
    case 'eth_getUncleByBlockNumberAndIndex':
      return 'fork';

    // cache for block
    case 'eth_gasPrice':
    case 'eth_blockNumber':
    case 'eth_getBalance':
    case 'eth_getStorageAt':
    case 'eth_getTransactionCount':
    case 'eth_call':
    case 'eth_estimateGas':
    case 'eth_getFilterLogs':
    case 'eth_getLogs':
    case 'net_peerCount':
      return 'block';

    // never cache
    case 'net_version':
    case 'net_peerCount':
    case 'net_listening':
    case 'eth_syncing':
    case 'eth_sign':
    case 'eth_coinbase':
    case 'eth_mining':
    case 'eth_hashrate':
    case 'eth_accounts':
    case 'eth_sendTransaction':
    case 'eth_sendRawTransaction':
    case 'eth_newFilter':
    case 'eth_newBlockFilter':
    case 'eth_newPendingTransactionFilter':
    case 'eth_uninstallFilter':
    case 'eth_getFilterChanges':
    case 'eth_getWork':
    case 'eth_submitWork':
    case 'eth_submitHashrate':
    case 'db_putString':
    case 'db_getString':
    case 'db_putHex':
    case 'db_getHex':
    case 'shh_post':
    case 'shh_newIdentity':
    case 'shh_hasIdentity':
    case 'shh_newGroup':
    case 'shh_addToGroup':
    case 'shh_newFilter':
    case 'shh_uninstallFilter':
    case 'shh_getFilterChanges':
    case 'shh_getMessages':
      return 'never';
  }
}

// handles the following RPC methods:
//   eth_getTransactionCount (pending only)
// observes the following RPC methods:
//   eth_sendRawTransaction


inherits$1(NonceTrackerSubprovider, SubProvider);

function NonceTrackerSubprovider(opts) {
  var self = this;

  self.nonceCache = {};
}

NonceTrackerSubprovider.prototype.handleRequest = function (payload, next, end) {
  var self = this;

  switch (payload.method) {

    case 'eth_getTransactionCount':
      var blockTag = blockTagForPayload(payload);
      var address = payload.params[0].toLowerCase();
      var cachedResult = self.nonceCache[address];
      // only handle requests against the 'pending' blockTag
      if (blockTag === 'pending') {
        // has a result
        if (cachedResult) {
          end(null, cachedResult);
          // fallthrough then populate cache
        } else {
          next(function (err, result, cb) {
            if (err) return cb();
            if (self.nonceCache[address] === undefined) {
              self.nonceCache[address] = result;
            }
            cb();
          });
        }
      } else {
        next();
      }
      return;

    case 'eth_sendRawTransaction':
      // allow the request to continue normally
      next(function (err, result, cb) {
        // only update local nonce if tx was submitted correctly
        if (err) return cb();
        // parse raw tx
        var rawTx = payload.params[0];
        var stripped = ethUtil.stripHexPrefix(rawTx);
        var rawData = new Buffer(ethUtil.stripHexPrefix(rawTx), 'hex');
        var tx = new Transaction(new Buffer(ethUtil.stripHexPrefix(rawTx), 'hex'));
        // extract address
        var address = '0x' + tx.getSenderAddress().toString('hex').toLowerCase();
        // extract nonce and increment
        var nonce = ethUtil.bufferToInt(tx.nonce);
        nonce++;
        // hexify and normalize
        var hexNonce = nonce.toString(16);
        if (hexNonce.length % 2) hexNonce = '0' + hexNonce;
        hexNonce = '0x' + hexNonce;
        // dont update our record on the nonce until the submit was successful
        // update cache
        self.nonceCache[address] = hexNonce;
        cb();
      });
      return;

    default:
      next();
      return;
  }
};

var BN = ethUtil.BN;
inherits$1(BlockCacheProvider, SubProvider);

function BlockCacheProvider(opts) {
  var self = this;
  opts = opts || {};
  // set initialization blocker
  self._ready = new Stoplight();
  self.strategies = {
    perma: new ConditionalPermaCacheStrategy({
      eth_getTransactionByHash: containsBlockhash,
      eth_getTransactionReceipt: containsBlockhash
    }),
    block: new BlockCacheStrategy(self),
    fork: new BlockCacheStrategy(self)
  };
}

// setup a block listener on 'setEngine'
BlockCacheProvider.prototype.setEngine = function (engine) {
  var self = this;
  self.engine = engine;
  // unblock initialization after first block
  engine.once('block', function (block) {
    self.currentBlock = block;
    self._ready.go();
    // from now on, empty old cache every block
    engine.on('block', clearOldCache);
  });

  function clearOldCache(newBlock) {
    var previousBlock = self.currentBlock;
    self.currentBlock = newBlock;
    if (!previousBlock) return;
    self.strategies.block.cacheRollOff(previousBlock);
    self.strategies.fork.cacheRollOff(previousBlock);
  }
};

BlockCacheProvider.prototype.handleRequest = function (payload, next, end) {
  var self = this;

  // skip cache if told to do so
  if (payload.skipCache) {
    // console.log('CACHE SKIP - skip cache if told to do so')
    return next();
  }

  // Ignore block polling requests.
  if (payload.method === 'eth_getBlockByNumber' && payload.params[0] === 'latest') {
    // console.log('CACHE SKIP - Ignore block polling requests.')
    return next();
  }

  // wait for first block
  self._ready.await(function () {
    // actually handle the request
    self._handleRequest(payload, next, end);
  });
};

BlockCacheProvider.prototype._handleRequest = function (payload, next, end) {
  var self = this;

  var type = cacheTypeForPayload(payload);
  var strategy = this.strategies[type];

  // If there's no strategy in place, pass it down the chain.
  if (!strategy) {
    return next();
  }

  // If the strategy can't cache this request, ignore it.
  if (!strategy.canCache(payload)) {
    return next();
  }

  var blockTag = blockTagForPayload(payload);
  if (!blockTag) blockTag = 'latest';
  var requestedBlockNumber;

  if (blockTag === 'earliest') {
    requestedBlockNumber = '0x00';
  } else if (blockTag === 'latest') {
    requestedBlockNumber = ethUtil.bufferToHex(self.currentBlock.number);
  } else {
    // We have a hex number
    requestedBlockNumber = blockTag;
  }

  //console.log('REQUEST at block 0x' + requestedBlockNumber.toString('hex'))

  // end on a hit, continue on a miss
  strategy.hitCheck(payload, requestedBlockNumber, end, function () {
    // miss fallthrough to provider chain, caching the result on the way back up.
    next(function (err, result, cb) {
      // err is already handled by engine
      if (err) return cb();
      strategy.cacheResult(payload, result, requestedBlockNumber, cb);
    });
  });
};

//
// Cache Strategies
//

function PermaCacheStrategy() {
  var self = this;
  self.cache = {};
  // clear cache every ten minutes
  var timeout = setInterval(function () {
    self.cache = {};
  }, 10 * 60 * 1e3);
  // do not require the Node.js event loop to remain active
  if (timeout.unref) timeout.unref();
}

PermaCacheStrategy.prototype.hitCheck = function (payload, requestedBlockNumber, hit, miss) {
  var identifier = cacheIdentifierForPayload(payload);
  var cached = this.cache[identifier];

  if (!cached) return miss();

  // If the block number we're requesting at is greater than or
  // equal to the block where we cached a previous response,
  // the cache is valid. If it's from earlier than the cache,
  // send it back down to the client (where it will be recached.)
  var cacheIsEarlyEnough = compareHex(requestedBlockNumber, cached.blockNumber) >= 0;
  if (cacheIsEarlyEnough) {
    var clonedValue = clone(cached.result);
    return hit(null, clonedValue);
  } else {
    return miss();
  }
};

PermaCacheStrategy.prototype.cacheResult = function (payload, result, requestedBlockNumber, callback) {
  var identifier = cacheIdentifierForPayload(payload);

  if (result) {
    var clonedValue = clone(result);
    this.cache[identifier] = {
      blockNumber: requestedBlockNumber,
      result: clonedValue
    };
  }

  callback();
};

PermaCacheStrategy.prototype.canCache = function (payload) {
  return canCache(payload);
};

//
// ConditionalPermaCacheStrategy
//

function ConditionalPermaCacheStrategy(conditionals) {
  this.strategy = new PermaCacheStrategy();
  this.conditionals = conditionals;
}

ConditionalPermaCacheStrategy.prototype.hitCheck = function (payload, requestedBlockNumber, hit, miss) {
  return this.strategy.hitCheck(payload, requestedBlockNumber, hit, miss);
};

ConditionalPermaCacheStrategy.prototype.cacheResult = function (payload, result, requestedBlockNumber, callback) {
  var conditional = this.conditionals[payload.method];

  if (conditional) {
    if (conditional(result)) {
      this.strategy.cacheResult(payload, result, requestedBlockNumber, callback);
    } else {
      callback();
    }
  } else {
    // Cache all requests that don't have a conditional
    this.strategy.cacheResult(payload, result, requestedBlockNumber, callback);
  }
};

ConditionalPermaCacheStrategy.prototype.canCache = function (payload) {
  return this.strategy.canCache(payload);
};

//
// BlockCacheStrategy
//

function BlockCacheStrategy() {
  this.cache = {};
}

BlockCacheStrategy.prototype.getBlockCacheForPayload = function (payload, blockNumber) {
  var blockTag = blockTagForPayload(payload);
  var blockCache = this.cache[blockNumber];
  // create new cache if necesary
  if (!blockCache) blockCache = this.cache[blockNumber] = {};

  return blockCache;
};

BlockCacheStrategy.prototype.hitCheck = function (payload, requestedBlockNumber, hit, miss) {
  var blockCache = this.getBlockCacheForPayload(payload, requestedBlockNumber);

  if (!blockCache) {
    return miss();
  }

  var identifier = cacheIdentifierForPayload(payload);
  var cached = blockCache[identifier];

  if (cached) {
    return hit(null, cached);
  } else {
    return miss();
  }
};

BlockCacheStrategy.prototype.cacheResult = function (payload, result, requestedBlockNumber, callback) {
  if (result) {
    var blockCache = this.getBlockCacheForPayload(payload, requestedBlockNumber);
    var identifier = cacheIdentifierForPayload(payload);
    blockCache[identifier] = result;
  }
  callback();
};

BlockCacheStrategy.prototype.canCache = function (payload) {
  if (!canCache(payload)) {
    return false;
  }

  var blockTag = blockTagForPayload(payload);

  return blockTag !== 'pending';
};

// naively removes older block caches
BlockCacheStrategy.prototype.cacheRollOff = function (previousBlock) {
  var self = this;
  var previousHex = ethUtil.bufferToHex(previousBlock.number);
  delete self.cache[previousHex];
};

// util

function compareHex(hexA, hexB) {
  var numA = parseInt(hexA, 16);
  var numB = parseInt(hexB, 16);
  return numA === numB ? 0 : numA > numB ? 1 : -1;
}

function hexToBN(hex) {
  return new BN(ethUtil.toBuffer(hex));
}

function containsBlockhash(result) {
  if (!result) return false;
  if (!result.blockHash) return false;
  var hasNonZeroHash = hexToBN(result.blockHash).gt(new BN(0));
  return hasNonZeroHash;
}

// handles the following RPC methods:
//   eth_newBlockFilter
//   eth_newPendingTransactionFilter
//   eth_newFilter
//   eth_getFilterChanges
//   eth_uninstallFilter
//   eth_getFilterLogs

inherits$1(FilterSubprovider, SubProvider);

function FilterSubprovider(opts) {
  opts = opts || {};
  var self = this;
  self.filterIndex = 0;
  self.filters = {};
  self.filterDestroyHandlers = {};
  self.asyncBlockHandlers = {};
  self.asyncPendingBlockHandlers = {};
  self._ready = new Stoplight();
  self._ready.go();
  self.pendingBlockTimeout = opts.pendingBlockTimeout || 4000;
  self.checkForPendingBlocksActive = false;

  // we dont have engine immeditately
  setTimeout(function () {
    // asyncBlockHandlers require locking provider until updates are completed
    self.engine.on('block', function (block) {
      // pause processing
      self._ready.stop();
      // update filters
      var updaters = valuesFor(self.asyncBlockHandlers).map(function (fn) {
        return fn.bind(null, block);
      });
      async__default.parallel(updaters, function (err) {
        if (err) console.error(err);
        // unpause processing
        self._ready.go();
      });
    });
  });
}

FilterSubprovider.prototype.handleRequest = function (payload, next, end) {
  var self = this;
  switch (payload.method) {

    case 'eth_newBlockFilter':
      self.newBlockFilter(end);
      return;

    case 'eth_newPendingTransactionFilter':
      self.newPendingTransactionFilter(end);
      self.checkForPendingBlocks();
      return;

    case 'eth_newFilter':
      self.newLogFilter(payload.params[0], end);
      return;

    case 'eth_getFilterChanges':
      self._ready.await(function () {
        self.getFilterChanges(payload.params[0], end);
      });
      return;

    case 'eth_getFilterLogs':
      self._ready.await(function () {
        self.getFilterLogs(payload.params[0], end);
      });
      return;

    case 'eth_uninstallFilter':
      self._ready.await(function () {
        self.uninstallFilter(payload.params[0], end);
      });
      return;

    default:
      next();
      return;
  }
};

FilterSubprovider.prototype.newBlockFilter = function (cb) {
  var self = this;

  self._getBlockNumber(function (err, blockNumber) {
    if (err) return cb(err);

    var filter = new BlockFilter({
      blockNumber: blockNumber
    });

    var newBlockHandler = filter.update.bind(filter);
    self.engine.on('block', newBlockHandler);
    var destroyHandler = function destroyHandler() {
      self.engine.removeListener('block', newBlockHandler);
    };

    self.filterIndex++;
    var hexFilterIndex = intToHex(self.filterIndex);
    self.filters[hexFilterIndex] = filter;
    self.filterDestroyHandlers[hexFilterIndex] = destroyHandler;

    cb(null, hexFilterIndex);
  });
};

FilterSubprovider.prototype.newLogFilter = function (opts, cb) {
  var self = this;

  self._getBlockNumber(function (err, blockNumber) {
    if (err) return cb(err);

    var filter = new LogFilter(opts);
    var newLogHandler = filter.update.bind(filter);
    var blockHandler = function blockHandler(block, cb) {
      self._logsForBlock(block, function (err, logs) {
        if (err) return cb(err);
        logs.forEach(newLogHandler);
        cb();
      });
    };

    self.filterIndex++;
    var hexFilterIndex = intToHex(self.filterIndex);
    self.asyncBlockHandlers[hexFilterIndex] = blockHandler;
    self.filters[hexFilterIndex] = filter;

    cb(null, hexFilterIndex);
  });
};

FilterSubprovider.prototype.newPendingTransactionFilter = function (cb) {
  var self = this;

  var filter = new PendingTransactionFilter();
  var newTxHandler = filter.update.bind(filter);
  var blockHandler = function blockHandler(block, cb) {
    self._txHashesForBlock(block, function (err, txs) {
      if (err) return cb(err);
      txs.forEach(newTxHandler);
      cb();
    });
  };

  self.filterIndex++;
  var hexFilterIndex = intToHex(self.filterIndex);
  self.asyncPendingBlockHandlers[hexFilterIndex] = blockHandler;
  self.filters[hexFilterIndex] = filter;

  cb(null, hexFilterIndex);
};

FilterSubprovider.prototype.getFilterChanges = function (filterId, cb) {
  var self = this;

  var filter = self.filters[filterId];
  if (!filter) console.warn('FilterSubprovider - no filter with that id:', filterId);
  if (!filter) return cb(null, []);
  var results = filter.getChanges();
  filter.clearChanges();
  cb(null, results);
};

FilterSubprovider.prototype.getFilterLogs = function (filterId, cb) {
  var self = this;

  var filter = self.filters[filterId];
  if (!filter) console.warn('FilterSubprovider - no filter with that id:', filterId);
  if (!filter) return cb(null, []);
  if (filter.type === 'log') {
    self.emitPayload({
      method: 'eth_getLogs',
      params: [{
        fromBlock: filter.fromBlock,
        toBlock: filter.toBlock,
        address: filter.address,
        topics: filter.topics
      }]
    }, function (err, res) {
      if (err) return cb(err);
      cb(null, res.result);
    });
  } else {
    var results = filter.getAllResults();
    cb(null, results);
  }
};

FilterSubprovider.prototype.uninstallFilter = function (filterId, cb) {
  var self = this;

  var filter = self.filters[filterId];
  if (!filter) {
    cb(null, false);
    return;
  }

  var destroyHandler = self.filterDestroyHandlers[filterId];
  delete self.filters[filterId];
  delete self.asyncBlockHandlers[filterId];
  delete self.asyncPendingBlockHandlers[filterId];
  delete self.filterDestroyHandlers[filterId];
  if (destroyHandler) destroyHandler();

  cb(null, true);
};

// private

// check for pending blocks
FilterSubprovider.prototype.checkForPendingBlocks = function () {
  var self = this;
  if (self.checkForPendingBlocksActive) return;
  var activePendingTxFilters = !!Object.keys(self.asyncPendingBlockHandlers).length;
  if (activePendingTxFilters) {
    self.checkForPendingBlocksActive = true;
    self.emitPayload({
      method: 'eth_getBlockByNumber',
      params: ['pending', true]
    }, function (err, res) {
      if (err) {
        self.checkForPendingBlocksActive = false;
        console.error(err);
        return;
      }
      self.onNewPendingBlock(res.result, function (err) {
        if (err) console.error(err);
        self.checkForPendingBlocksActive = false;
        setTimeout(self.checkForPendingBlocks.bind(self), self.pendingBlockTimeout);
      });
    });
  }
};

FilterSubprovider.prototype.onNewPendingBlock = function (block, cb) {
  var self = this;
  // update filters
  var updaters = valuesFor(self.asyncPendingBlockHandlers).map(function (fn) {
    return fn.bind(null, block);
  });
  async__default.parallel(updaters, cb);
};

FilterSubprovider.prototype._getBlockNumber = function (cb) {
  var self = this;
  var blockNumber = bufferToNumberHex(self.engine.currentBlock.number);
  cb(null, blockNumber);
};

FilterSubprovider.prototype._logsForBlock = function (block, cb) {
  var self = this;
  var blockNumber = bufferToNumberHex(block.number);
  self.emitPayload({
    method: 'eth_getLogs',
    params: [{
      fromBlock: blockNumber,
      toBlock: blockNumber
    }]
  }, function (err, response) {
    if (err) return cb(err);
    if (response.error) return cb(response.error);
    cb(null, response.result);
  });
};

FilterSubprovider.prototype._txHashesForBlock = function (block, cb) {
  var txs = block.transactions;
  // short circuit if empty
  if (txs.length === 0) return cb(null, []);
  // txs are already hashes
  if ('string' === typeof txs[0]) {
    cb(null, txs);
    // txs are obj, need to map to hashes
  } else {
    var results = txs.map(function (tx) {
      return tx.hash;
    });
    cb(null, results);
  }
};

//
// BlockFilter
//

function BlockFilter(opts) {
  // console.log('BlockFilter - new')
  var self = this;
  self.type = 'block';
  self.engine = opts.engine;
  self.blockNumber = opts.blockNumber;
  self.updates = [];
}

BlockFilter.prototype.update = function (block) {
  // console.log('BlockFilter - update')
  var self = this;
  var blockHash = bufferToHex(block.hash);
  self.updates.push(blockHash);
};

BlockFilter.prototype.getChanges = function () {
  var self = this;
  var results = self.updates;
  // console.log('BlockFilter - getChanges:', results.length)
  return results;
};

BlockFilter.prototype.clearChanges = function () {
  // console.log('BlockFilter - clearChanges')
  var self = this;
  self.updates = [];
};

//
// LogFilter
//

function LogFilter(opts) {
  // console.log('LogFilter - new')
  var self = this;
  self.type = 'log';
  self.fromBlock = opts.fromBlock || 'latest';
  self.toBlock = opts.toBlock || 'latest';
  self.address = opts.address ? normalizeHex(opts.address) : opts.address;
  self.topics = opts.topics || [];
  self.updates = [];
  self.allResults = [];
}

LogFilter.prototype.validateLog = function (log$$1) {
  // console.log('LogFilter - validateLog:', log)
  var self = this;

  // check if block number in bounds:
  // console.log('LogFilter - validateLog - blockNumber', self.fromBlock, self.toBlock)
  if (blockTagIsNumber(self.fromBlock) && hexToInt(self.fromBlock) >= hexToInt(log$$1.blockNumber)) return false;
  if (blockTagIsNumber(self.toBlock) && hexToInt(self.toBlock) <= hexToInt(log$$1.blockNumber)) return false;

  // address is correct:
  // console.log('LogFilter - validateLog - address', self.address)
  if (self.address && self.address !== log$$1.address) return false;

  // topics match:
  // topics are position-dependant
  // topics can be nested to represent `or` [[a || b], c]
  // topics can be null, representing a wild card for that position
  // console.log('LogFilter - validateLog - topics', log.topics)
  // console.log('LogFilter - validateLog - against topics', self.topics)
  var topicsMatch = self.topics.reduce(function (previousMatched, topicPattern, index) {
    // abort in progress
    if (!previousMatched) return false;
    // wild card
    if (!topicPattern) return true;
    // pattern is longer than actual topics
    var logTopic = log$$1.topics[index];
    if (!logTopic) return false;
    // check each possible matching topic
    var subtopicsToMatch = Array.isArray(topicPattern) ? topicPattern : [topicPattern];
    var topicDoesMatch = subtopicsToMatch.filter(function (subTopic) {
      return logTopic === subTopic;
    }).length > 0;
    return topicDoesMatch;
  }, true);

  // console.log('LogFilter - validateLog - '+(topicsMatch ? 'approved!' : 'denied!')+' ==============')
  return topicsMatch;
};

LogFilter.prototype.update = function (log$$1) {
  // console.log('LogFilter - update')
  var self = this;
  // validate filter match
  var validated = self.validateLog(log$$1);
  if (!validated) return;
  // add to results
  self.updates.push(log$$1);
  self.allResults.push(log$$1);
};

LogFilter.prototype.getChanges = function () {
  // console.log('LogFilter - getChanges')
  var self = this;
  var results = self.updates;
  return results;
};

LogFilter.prototype.getAllResults = function () {
  // console.log('LogFilter - getAllResults')
  var self = this;
  var results = self.allResults;
  return results;
};

LogFilter.prototype.clearChanges = function () {
  // console.log('LogFilter - clearChanges')
  var self = this;
  self.updates = [];
};

//
// PendingTxFilter
//

function PendingTransactionFilter() {
  // console.log('PendingTransactionFilter - new')
  var self = this;
  self.type = 'pendingTx';
  self.updates = [];
  self.allResults = [];
}

PendingTransactionFilter.prototype.validateUnique = function (tx) {
  var self = this;
  return self.allResults.indexOf(tx) === -1;
};

PendingTransactionFilter.prototype.update = function (tx) {
  // console.log('PendingTransactionFilter - update')
  var self = this;
  // validate filter match
  var validated = self.validateUnique(tx);
  if (!validated) return;
  // add to results
  self.updates.push(tx);
  self.allResults.push(tx);
};

PendingTransactionFilter.prototype.getChanges = function () {
  // console.log('PendingTransactionFilter - getChanges')
  var self = this;
  var results = self.updates;
  return results;
};

PendingTransactionFilter.prototype.getAllResults = function () {
  // console.log('PendingTransactionFilter - getAllResults')
  var self = this;
  var results = self.allResults;
  return results;
};

PendingTransactionFilter.prototype.clearChanges = function () {
  // console.log('PendingTransactionFilter - clearChanges')
  var self = this;
  self.updates = [];
};

// util

function normalizeHex(hexString) {
  return hexString.slice(0, 2) === '0x' ? hexString : '0x' + hexString;
}

function intToHex(value) {
  return ethUtil.intToHex(value);
}

function hexToInt(hexString) {
  return Number(hexString);
}

function bufferToHex(buffer) {
  return '0x' + buffer.toString('hex');
}

function bufferToNumberHex(buffer) {
  return stripLeadingZero(buffer.toString('hex'));
}

function stripLeadingZero(hexNum) {
  var stripped = ethUtil.stripHexPrefix(hexNum);
  while (stripped[0] === '0') {
    stripped = stripped.substr(1);
  }
  return '0x' + stripped;
}

function blockTagIsNumber(blockTag) {
  return blockTag && ['earliest', 'latest', 'pending'].indexOf(blockTag) === -1;
}

function valuesFor(obj) {
  return Object.keys(obj).map(function (key) {
    return obj[key];
  });
}

var InflightCacheSubprovider = function (_Subprovider) {
  inherits$2(InflightCacheSubprovider, _Subprovider);

  function InflightCacheSubprovider(opts) {
    classCallCheck(this, InflightCacheSubprovider);

    var _this = possibleConstructorReturn(this, (InflightCacheSubprovider.__proto__ || Object.getPrototypeOf(InflightCacheSubprovider)).call(this));

    _this.inflightRequests = {};
    return _this;
  }

  createClass(InflightCacheSubprovider, [{
    key: 'addEngine',
    value: function addEngine(engine) {
      this.engine = engine;
    }
  }, {
    key: 'handleRequest',
    value: function handleRequest(req, next, end) {
      var _this2 = this;

      var cacheId = cacheIdentifierForPayload(req, { includeBlockRef: true });

      // if not cacheable, skip
      if (!cacheId) return next();

      // check for matching requests
      var activeRequestHandlers = this.inflightRequests[cacheId];

      if (!activeRequestHandlers) {
        // create inflight cache for cacheId
        activeRequestHandlers = [];
        this.inflightRequests[cacheId] = activeRequestHandlers;

        next(function (err, result, cb) {
          // complete inflight for cacheId
          delete _this2.inflightRequests[cacheId];
          activeRequestHandlers.forEach(function (handler) {
            return handler(err, result);
          });
          cb(err, result);
        });
      } else {
        // hit inflight cache for cacheId
        // setup the response listener
        activeRequestHandlers.push(end);
      }
    }
  }]);
  return InflightCacheSubprovider;
}(SubProvider);

/*

This is a work around for https://github.com/ethereum/go-ethereum/issues/2577

*/

function estimateGas(provider, txParams, cb) {
  provider.sendAsync(createPayload({
    method: 'eth_estimateGas',
    params: [txParams]
  }), function (err, res) {
    if (err) {
      // handle simple value transfer case
      if (err.message === 'no contract code at given address') {
        return cb(null, '0xcf08');
      } else {
        return cb(err);
      }
    }
    cb(null, res.result);
  });
}

/*
 * Emulate 'eth_accounts' / 'eth_sendTransaction' using 'eth_sendRawTransaction'
 *
 * The two callbacks a user needs to implement are:
 * - getAccounts() -- array of addresses supported
 * - signTransaction(tx) -- sign a raw transaction object
 */

var hexRegex = /^[0-9A-Fa-f]+$/g;

// handles the following RPC methods:
//   eth_coinbase
//   eth_accounts
//   eth_sendTransaction
//   eth_sign
//   personal_sign
//   personal_ecRecover

//
// Tx Signature Flow
//
// handleRequest: eth_sendTransaction
//   validateTransaction (basic validity check)
//     validateSender (checks that sender is in accounts)
//   processTransaction (sign tx and submit to network)
//     approveTransaction (UI approval hook)
//     checkApproval
//     finalizeAndSubmitTx (tx signing)
//       nonceLock.take (bottle neck to ensure atomic nonce)
//         fillInTxExtras (set fallback gasPrice, nonce, etc)
//         signTransaction (perform the signature)
//         publishTransaction (publish signed tx to network)
//


inherits$1(HookedWalletSubprovider, SubProvider);

function HookedWalletSubprovider(opts) {
  var self = this;
  // control flow
  self.nonceLock = Semaphore(1);

  // data lookup
  if (!opts.getAccounts) throw new Error('ProviderEngine - HookedWalletSubprovider - did not provide "getAccounts" fn in constructor options');
  self.getAccounts = opts.getAccounts;
  // high level override
  if (opts.processTransaction) self.processTransaction = opts.processTransaction;
  if (opts.processMessage) self.processMessage = opts.processMessage;
  if (opts.processPersonalMessage) self.processPersonalMessage = opts.processPersonalMessage;
  if (opts.processTypedMessage) self.processTypedMessage = opts.processTypedMessage;
  // approval hooks
  self.approveTransaction = opts.approveTransaction || self.autoApprove;
  self.approveMessage = opts.approveMessage || self.autoApprove;
  self.approvePersonalMessage = opts.approvePersonalMessage || self.autoApprove;
  self.approveTypedMessage = opts.approveTypedMessage || self.autoApprove;
  // actually perform the signature
  if (opts.signTransaction) self.signTransaction = opts.signTransaction;
  if (opts.signMessage) self.signMessage = opts.signMessage;
  if (opts.signPersonalMessage) self.signPersonalMessage = opts.signPersonalMessage;
  if (opts.signTypedMessage) self.signTypedMessage = opts.signTypedMessage;
  if (opts.recoverPersonalSignature) self.recoverPersonalSignature = opts.recoverPersonalSignature;
  // publish to network
  if (opts.publishTransaction) self.publishTransaction = opts.publishTransaction;
}

HookedWalletSubprovider.prototype.handleRequest = function (payload, next, end) {
  var self = this;

  switch (payload.method) {

    case 'eth_coinbase':
      self.getAccounts(function (err, accounts) {
        if (err) return end(err);
        var result = accounts[0] || null;
        end(null, result);
      });
      return;

    case 'eth_accounts':
      self.getAccounts(function (err, accounts) {
        if (err) return end(err);
        end(null, accounts);
      });
      return;

    case 'eth_sendTransaction':
      var txParams = payload.params[0];
      async.waterfall([function (cb) {
        return self.validateTransaction(txParams, cb);
      }, function (cb) {
        return self.processTransaction(txParams, cb);
      }], end);
      return;

    case 'eth_signTransaction':
      var txParams = payload.params[0];
      async.waterfall([function (cb) {
        return self.validateTransaction(txParams, cb);
      }, function (cb) {
        return self.processSignTransaction(txParams, cb);
      }], end);
      return;

    case 'eth_sign':
      var address = payload.params[0];
      var message = payload.params[1];
      // non-standard "extraParams" to be appended to our "msgParams" obj
      // good place for metadata
      var extraParams = payload.params[2] || {};
      var msgParams = extend(extraParams, {
        from: address,
        data: message
      });
      async.waterfall([function (cb) {
        return self.validateMessage(msgParams, cb);
      }, function (cb) {
        return self.processMessage(msgParams, cb);
      }], end);
      return;

    case 'personal_sign':
      var first = payload.params[0];
      var second = payload.params[1];

      var message, address;

      // We initially incorrectly ordered these parameters.
      // To gracefully respect users who adopted this API early,
      // we are currently gracefully recovering from the wrong param order
      // when it is clearly identifiable.
      //
      // That means when the first param is definitely an address,
      // and the second param is definitely not, but is hex.
      if (resemblesData(second) && resemblesAddress(first)) {
        var warning = 'The eth_personalSign method requires params ordered ';
        warning += '[message, address]. This was previously handled incorrectly, ';
        warning += 'and has been corrected automatically. ';
        warning += 'Please switch this param order for smooth behavior in the future.';
        console.warn(warning);

        address = payload.params[0];
        message = payload.params[1];
      } else {
        message = payload.params[0];
        address = payload.params[1];
      }

      // non-standard "extraParams" to be appended to our "msgParams" obj
      // good place for metadata
      var extraParams = payload.params[2] || {};
      var msgParams = extend(extraParams, {
        from: address,
        data: message
      });
      async.waterfall([function (cb) {
        return self.validatePersonalMessage(msgParams, cb);
      }, function (cb) {
        return self.processPersonalMessage(msgParams, cb);
      }], end);
      return;

    case 'personal_ecRecover':
      var message = payload.params[0];
      var signature = payload.params[1];
      // non-standard "extraParams" to be appended to our "msgParams" obj
      // good place for metadata
      var extraParams = payload.params[2] || {};
      var msgParams = extend(extraParams, {
        sig: signature,
        data: message
      });
      self.recoverPersonalSignature(msgParams, end);
      return;

    case 'eth_signTypedData':
      message = payload.params[0];
      address = payload.params[1];
      var extraParams = payload.params[2] || {};
      var msgParams = extend(extraParams, {
        from: address,
        data: message
      });
      async.waterfall([function (cb) {
        return self.validateTypedMessage(msgParams, cb);
      }, function (cb) {
        return self.processTypedMessage(msgParams, cb);
      }], end);
      return;

    default:
      next();
      return;

  }
};

//
// "process" high level flow
//

HookedWalletSubprovider.prototype.processTransaction = function (txParams, cb) {
  var self = this;
  async.waterfall([function (cb) {
    return self.approveTransaction(txParams, cb);
  }, function (didApprove, cb) {
    return self.checkApproval('transaction', didApprove, cb);
  }, function (cb) {
    return self.finalizeAndSubmitTx(txParams, cb);
  }], cb);
};

HookedWalletSubprovider.prototype.processSignTransaction = function (txParams, cb) {
  var self = this;
  async.waterfall([function (cb) {
    return self.approveTransaction(txParams, cb);
  }, function (didApprove, cb) {
    return self.checkApproval('transaction', didApprove, cb);
  }, function (cb) {
    return self.finalizeTx(txParams, cb);
  }], cb);
};

HookedWalletSubprovider.prototype.processMessage = function (msgParams, cb) {
  var self = this;
  async.waterfall([function (cb) {
    return self.approveMessage(msgParams, cb);
  }, function (didApprove, cb) {
    return self.checkApproval('message', didApprove, cb);
  }, function (cb) {
    return self.signMessage(msgParams, cb);
  }], cb);
};

HookedWalletSubprovider.prototype.processPersonalMessage = function (msgParams, cb) {
  var self = this;
  async.waterfall([function (cb) {
    return self.approvePersonalMessage(msgParams, cb);
  }, function (didApprove, cb) {
    return self.checkApproval('message', didApprove, cb);
  }, function (cb) {
    return self.signPersonalMessage(msgParams, cb);
  }], cb);
};

HookedWalletSubprovider.prototype.processTypedMessage = function (msgParams, cb) {
  var self = this;
  async.waterfall([function (cb) {
    return self.approveTypedMessage(msgParams, cb);
  }, function (didApprove, cb) {
    return self.checkApproval('message', didApprove, cb);
  }, function (cb) {
    return self.signTypedMessage(msgParams, cb);
  }], cb);
};

//
// approval
//

HookedWalletSubprovider.prototype.autoApprove = function (txParams, cb) {
  cb(null, true);
};

HookedWalletSubprovider.prototype.checkApproval = function (type, didApprove, cb) {
  cb(didApprove ? null : new Error('User denied ' + type + ' signature.'));
};

//
// signature and recovery
//

HookedWalletSubprovider.prototype.signTransaction = function (tx, cb) {
  cb(new Error('ProviderEngine - HookedWalletSubprovider - Must provide "signTransaction" fn in constructor options'));
};
HookedWalletSubprovider.prototype.signMessage = function (msgParams, cb) {
  cb(new Error('ProviderEngine - HookedWalletSubprovider - Must provide "signMessage" fn in constructor options'));
};
HookedWalletSubprovider.prototype.signPersonalMessage = function (msgParams, cb) {
  cb(new Error('ProviderEngine - HookedWalletSubprovider - Must provide "signPersonalMessage" fn in constructor options'));
};
HookedWalletSubprovider.prototype.signTypedMessage = function (msgParams, cb) {
  cb(new Error('ProviderEngine - HookedWalletSubprovider - Must provide "signTypedMessage" fn in constructor options'));
};

HookedWalletSubprovider.prototype.recoverPersonalSignature = function (msgParams, cb) {
  var senderHex = void 0;
  try {
    senderHex = sigUtil.recoverPersonalSignature(msgParams);
  } catch (err) {
    return cb(err);
  }
  cb(null, senderHex);
};

//
// validation
//

HookedWalletSubprovider.prototype.validateTransaction = function (txParams, cb) {
  var self = this;
  // shortcut: undefined sender is invalid
  if (txParams.from === undefined) return cb(new Error('Undefined address - from address required to sign transaction.'));
  self.validateSender(txParams.from, function (err, senderIsValid) {
    if (err) return cb(err);
    if (!senderIsValid) return cb(new Error('Unknown address - unable to sign transaction for this address: "' + txParams.from + '"'));
    cb();
  });
};

HookedWalletSubprovider.prototype.validateMessage = function (msgParams, cb) {
  var self = this;
  if (msgParams.from === undefined) return cb(new Error('Undefined address - from address required to sign message.'));
  self.validateSender(msgParams.from, function (err, senderIsValid) {
    if (err) return cb(err);
    if (!senderIsValid) return cb(new Error('Unknown address - unable to sign message for this address: "' + msgParams.from + '"'));
    cb();
  });
};

HookedWalletSubprovider.prototype.validatePersonalMessage = function (msgParams, cb) {
  var self = this;
  if (msgParams.from === undefined) return cb(new Error('Undefined address - from address required to sign personal message.'));
  if (msgParams.data === undefined) return cb(new Error('Undefined message - message required to sign personal message.'));
  if (!isValidHex(msgParams.data)) return cb(new Error('HookedWalletSubprovider - validateMessage - message was not encoded as hex.'));
  self.validateSender(msgParams.from, function (err, senderIsValid) {
    if (err) return cb(err);
    if (!senderIsValid) return cb(new Error('Unknown address - unable to sign message for this address: "' + msgParams.from + '"'));
    cb();
  });
};

HookedWalletSubprovider.prototype.validateTypedMessage = function (msgParams, cb) {
  if (msgParams.from === undefined) return cb(new Error('Undefined address - from address required to sign typed data.'));
  if (msgParams.data === undefined) return cb(new Error('Undefined data - message required to sign typed data.'));
  this.validateSender(msgParams.from, function (err, senderIsValid) {
    if (err) return cb(err);
    if (!senderIsValid) return cb(new Error('Unknown address - unable to sign message for this address: "' + msgParams.from + '"'));
    cb();
  });
};

HookedWalletSubprovider.prototype.validateSender = function (senderAddress, cb) {
  var self = this;
  // shortcut: undefined sender is invalid
  if (!senderAddress) return cb(null, false);
  self.getAccounts(function (err, accounts) {
    if (err) return cb(err);
    var senderIsValid = accounts.map(toLowerCase).indexOf(senderAddress.toLowerCase()) !== -1;
    cb(null, senderIsValid);
  });
};

//
// tx helpers
//

HookedWalletSubprovider.prototype.finalizeAndSubmitTx = function (txParams, cb) {
  var self = this;
  // can only allow one tx to pass through this flow at a time
  // so we can atomically consume a nonce
  self.nonceLock.take(function () {
    async.waterfall([self.fillInTxExtras.bind(self, txParams), self.signTransaction.bind(self), self.publishTransaction.bind(self)], function (err, txHash) {
      self.nonceLock.leave();
      if (err) return cb(err);
      cb(null, txHash);
    });
  });
};

HookedWalletSubprovider.prototype.finalizeTx = function (txParams, cb) {
  var self = this;
  // can only allow one tx to pass through this flow at a time
  // so we can atomically consume a nonce
  self.nonceLock.take(function () {
    async.waterfall([self.fillInTxExtras.bind(self, txParams), self.signTransaction.bind(self)], function (err, signedTx) {
      self.nonceLock.leave();
      if (err) return cb(err);
      cb(null, { raw: signedTx, tx: txParams });
    });
  });
};

HookedWalletSubprovider.prototype.publishTransaction = function (rawTx, cb) {
  var self = this;
  self.emitPayload({
    method: 'eth_sendRawTransaction',
    params: [rawTx]
  }, function (err, res) {
    if (err) return cb(err);
    cb(null, res.result);
  });
};

HookedWalletSubprovider.prototype.fillInTxExtras = function (txParams, cb) {
  var self = this;
  var address = txParams.from;
  // console.log('fillInTxExtras - address:', address)

  var reqs = {};

  if (txParams.gasPrice === undefined) {
    // console.log("need to get gasprice")
    reqs.gasPrice = self.emitPayload.bind(self, { method: 'eth_gasPrice', params: [] });
  }

  if (txParams.nonce === undefined) {
    // console.log("need to get nonce")
    reqs.nonce = self.emitPayload.bind(self, { method: 'eth_getTransactionCount', params: [address, 'pending'] });
  }

  if (txParams.gas === undefined) {
    // console.log("need to get gas")
    reqs.gas = estimateGas.bind(null, self.engine, cloneTxParams(txParams));
  }

  async.parallel(reqs, function (err, result) {
    if (err) return cb(err);
    // console.log('fillInTxExtras - result:', result)

    var res = {};
    if (result.gasPrice) res.gasPrice = result.gasPrice.result;
    if (result.nonce) res.nonce = result.nonce.result;
    if (result.gas) res.gas = result.gas;

    cb(null, extend(res, txParams));
  });
};

// util

// we use this to clean any custom params from the txParams
function cloneTxParams(txParams) {
  return {
    from: txParams.from,
    to: txParams.to,
    value: txParams.value,
    data: txParams.data,
    gas: txParams.gas,
    gasPrice: txParams.gasPrice,
    nonce: txParams.nonce
  };
}

function toLowerCase(string) {
  return string.toLowerCase();
}

function resemblesAddress(string) {
  var fixed = ethUtil.addHexPrefix(string);
  var isValid = ethUtil.isValidAddress(fixed);
  return isValid;
}

// Returns true if resembles hex data
// but definitely not a valid address.
function resemblesData(string) {
  var fixed = ethUtil.addHexPrefix(string);
  var isValidAddress = ethUtil.isValidAddress(fixed);
  return !isValidAddress && isValidHex(string);
}

function isValidHex(data) {
  var isString$$1 = typeof data === 'string';
  if (!isString$$1) return false;
  var isHexPrefixed = data.slice(0, 2) === '0x';
  if (!isHexPrefixed) return false;
  var nonPrefixed = data.slice(2);
  var isValid = nonPrefixed.match(hexRegex);
  return isValid;
}

/* Sanitization Subprovider
 * For Parity compatibility
 * removes irregular keys
 */

inherits$1(SanitizerSubprovider, SubProvider);

function SanitizerSubprovider(opts) {
  
}

SanitizerSubprovider.prototype.handleRequest = function (payload, next, end) {
  var txParams = payload.params[0];

  if ((typeof txParams === 'undefined' ? 'undefined' : _typeof(txParams)) === 'object' && !Array.isArray(txParams)) {
    var sanitized = cloneTxParams$1(txParams);
    payload.params[0] = sanitized;
  }

  next();
};

// we use this to clean any custom params from the txParams
var permitted = ['from', 'to', 'value', 'data', 'gas', 'gasPrice', 'nonce', 'fromBlock', 'toBlock', 'address', 'topics'];

function cloneTxParams$1(txParams) {
  var sanitized = permitted.reduce(function (copy, permitted) {
    if (permitted in txParams) {
      if (Array.isArray(txParams[permitted])) {
        copy[permitted] = txParams[permitted].map(function (item) {
          return sanitize(item);
        });
      } else {
        copy[permitted] = sanitize(txParams[permitted]);
      }
    }
    return copy;
  }, {});

  return sanitized;
}

function sanitize(value) {
  switch (value) {
    case 'latest':
      return value;
    case 'pending':
      return value;
    case 'earliest':
      return value;
    default:
      if (typeof value === 'string') {
        return ethUtil.addHexPrefix(value.toLowerCase());
      } else {
        return value;
      }
  }
}

inherits$1(RpcSource, SubProvider);

function RpcSource(opts) {
  var self = this;
  self.rpcUrl = opts.rpcUrl;
}

RpcSource.prototype.handleRequest = function (payload, next, end) {
  var self = this;
  var targetUrl = self.rpcUrl;

  // overwrite id to conflict with other concurrent users
  var newPayload = createPayload(payload);

  xhr({
    uri: targetUrl,
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(newPayload),
    rejectUnauthorized: false
  }, function (err, res, body) {
    if (err) return end(new JsonRpcError.InternalError(err));

    // check for error code
    switch (res.statusCode) {
      case 405:
        return end(new JsonRpcError.MethodNotFound());
      case 504:
        // Gateway timeout
        var msg = 'Gateway timeout. The request took too long to process. ';
        msg += 'This can happen when querying logs over too wide a block range.';
        var _err = new Error(msg);
        return end(new JsonRpcError.InternalError(_err));
      default:
        if (res.statusCode != 200) {
          return end(new JsonRpcError.InternalError(res.body));
        }
    }

    // parse response
    var data = void 0;
    try {
      data = JSON.parse(body);
    } catch (err) {
      console.error(err.stack);
      return end(new JsonRpcError.InternalError(err));
    }
    if (data.error) return end(data.error);

    end(null, data.result);
  });
};

inherits$1(FetchSubprovider, SubProvider);

function FetchSubprovider(opts) {
  var self = this;
  self.rpcUrl = opts.rpcUrl;
  self.originHttpHeaderKey = opts.originHttpHeaderKey;
}

FetchSubprovider.prototype.handleRequest = function (payload, next, end) {
  var self = this;
  var originDomain = payload.origin;

  // overwrite id to not conflict with other concurrent users
  var newPayload = createPayload(payload);
  // remove extra parameter from request
  delete newPayload.origin;

  var reqParams = {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(newPayload)
  };

  if (self.originHttpHeaderKey && originDomain) {
    reqParams.headers[self.originHttpHeaderKey] = originDomain;
  }

  async.retry({
    times: 5,
    interval: 1000,
    errorFilter: function errorFilter(err) {
      return [
      // ignore server overload errors
      'Gateway timeout', 'ETIMEDOUT',
      // ignore server sent html error pages
      // or truncated json responses
      'SyntaxError'].some(function (phrase) {
        return err.message.includes(phrase);
      });
    }
  }, function (cb) {
    return self._submitRequest(reqParams, cb);
  }, end);
};

FetchSubprovider.prototype._submitRequest = function (reqParams, cb) {
  var self = this;
  var targetUrl = self.rpcUrl;

  promiseToCallback(fetch(targetUrl, reqParams))(function (err, res) {
    if (err) return cb(err);

    // continue parsing result
    async.waterfall([checkForHttpErrors,
    // buffer body
    function (cb) {
      return promiseToCallback(res.text())(cb);
    },
    // parse body
    async.asyncify(function (rawBody) {
      return JSON.parse(rawBody);
    }), parseResponse], cb);

    function checkForHttpErrors(cb) {
      // check for errors
      switch (res.status) {
        case 405:
          return cb(new JsonRpcError.MethodNotFound());

        case 418:
          return cb(createRatelimitError());

        case 503:
        case 504:
          return cb(createTimeoutError());

        default:
          return cb();
      }
    }

    function parseResponse(body, cb) {
      // check for error code
      if (res.status !== 200) {
        return cb(new JsonRpcError.InternalError(body));
      }
      // check for rpc error
      if (body.error) return cb(new JsonRpcError.InternalError(body.error));
      // return successful result
      cb(null, body.result);
    }
  });
};

function createRatelimitError() {
  var msg = 'Request is being rate limited.';
  var err = new Error(msg);
  return new JsonRpcError.InternalError(err);
}

function createTimeoutError() {
  var msg = 'Gateway timeout. The request took too long to process. ';
  msg += 'This can happen when querying logs over too wide a block range.';
  var err = new Error(msg);
  return new JsonRpcError.InternalError(err);
}

function ZeroClientProvider(opts) {
  opts = opts || {};

  var engine = new Web3ProviderEngine(opts.engineParams);

  // static
  var staticSubprovider = new DefaultFixtures(opts.static);
  engine.addProvider(staticSubprovider);

  // nonce tracker
  engine.addProvider(new NonceTrackerSubprovider());

  // sanitization
  var sanitizer = new SanitizerSubprovider();
  engine.addProvider(sanitizer);

  // cache layer
  var cacheSubprovider = new BlockCacheProvider();
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
  var fetchSubprovider = new FetchSubprovider({
    rpcUrl: opts.rpcUrl || 'https://mainnet.infura.io/',
    originHttpHeaderKey: opts.originHttpHeaderKey
  });
  engine.addProvider(fetchSubprovider);

  // start polling
  engine.start();

  return engine;
}

/*
 * Etherscan.io API connector
 * @author github.com/axic
 *
 * The etherscan.io API supports:
 *
 * 1) Natively via proxy methods
 * - eth_blockNumber *
 * - eth_getBlockByNumber *
 * - eth_getBlockTransactionCountByNumber
 * - getTransactionByHash
 * - getTransactionByBlockNumberAndIndex
 * - eth_getTransactionCount *
 * - eth_sendRawTransaction *
 * - eth_call *
 * - eth_getTransactionReceipt *
 * - eth_getCode *
 * - eth_getStorageAt *
 *
 * 2) Via non-native methods
 * - eth_getBalance
 * - eth_listTransactions (non-standard)
 */
inherits$1(EtherscanProvider, SubProvider);

function EtherscanProvider(opts) {
  opts = opts || {};
  this.network = opts.network || 'api';
  this.proto = opts.https || false ? 'https' : 'http';
  this.requests = [];
  this.times = isNaN(opts.times) ? 4 : opts.times;
  this.interval = isNaN(opts.interval) ? 1000 : opts.interval;
  this.retryFailed = typeof opts.retryFailed === 'boolean' ? opts.retryFailed : true; // not built yet

  setInterval(this.handleRequests, this.interval, this);
}

EtherscanProvider.prototype.handleRequests = function (self) {
  if (self.requests.length == 0) return;

  //console.log('Handling the next ' + self.times + ' of ' + self.requests.length + ' requests');

  for (var requestIndex = 0; requestIndex < self.times; requestIndex++) {
    var requestItem = self.requests.shift();

    if (typeof requestItem !== 'undefined') handlePayload(requestItem.proto, requestItem.network, requestItem.payload, requestItem.next, requestItem.end);
  }
};

EtherscanProvider.prototype.handleRequest = function (payload, next, end) {
  var requestObject = { proto: this.proto, network: this.network, payload: payload, next: next, end: end },
      self = this;

  if (this.retryFailed) requestObject.end = function (err, result) {
    if (err === '403 - Forbidden: Access is denied.') self.requests.push(requestObject);else end(err, result);
  };

  this.requests.push(requestObject);
};

function handlePayload(proto, network, payload, next, end) {
  switch (payload.method) {
    case 'eth_blockNumber':
      etherscanXHR(true, proto, network, 'proxy', 'eth_blockNumber', {}, end);
      return;

    case 'eth_getBlockByNumber':
      etherscanXHR(true, proto, network, 'proxy', 'eth_getBlockByNumber', {
        tag: payload.params[0],
        boolean: payload.params[1] }, end);
      return;

    case 'eth_getBlockTransactionCountByNumber':
      etherscanXHR(true, proto, network, 'proxy', 'eth_getBlockTransactionCountByNumber', {
        tag: payload.params[0]
      }, end);
      return;

    case 'eth_getTransactionByHash':
      etherscanXHR(true, proto, network, 'proxy', 'eth_getTransactionByHash', {
        txhash: payload.params[0]
      }, end);
      return;

    case 'eth_getBalance':
      etherscanXHR(true, proto, network, 'account', 'balance', {
        address: payload.params[0],
        tag: payload.params[1] }, end);
      return;

    case 'eth_listTransactions':
      var props = ['address', 'startblock', 'endblock', 'sort', 'page', 'offset'];

      var params = {};
      for (var i = 0, l = Math.min(payload.params.length, props.length); i < l; i++) {
        params[props[i]] = payload.params[i];
      }

      etherscanXHR(true, proto, network, 'account', 'txlist', params, end);
      return;

    case 'eth_call':
      etherscanXHR(true, proto, network, 'proxy', 'eth_call', payload.params[0], end);
      return;

    case 'eth_sendRawTransaction':
      etherscanXHR(false, proto, network, 'proxy', 'eth_sendRawTransaction', { hex: payload.params[0] }, end);
      return;

    case 'eth_getTransactionReceipt':
      etherscanXHR(true, proto, network, 'proxy', 'eth_getTransactionReceipt', { txhash: payload.params[0] }, end);
      return;

    // note !! this does not support topic filtering yet, it will return all block logs
    case 'eth_getLogs':
      var payloadObject = payload.params[0],
          txProcessed = 0,
          logs = [];

      etherscanXHR(true, proto, network, 'proxy', 'eth_getBlockByNumber', {
        tag: payloadObject.toBlock,
        boolean: payload.params[1] }, function (err, blockResult) {
        if (err) return end(err);

        for (var transaction in blockResult.transactions) {
          etherscanXHR(true, proto, network, 'proxy', 'eth_getTransactionReceipt', { txhash: transaction.hash }, function (err, receiptResult) {
            if (!err) logs.concat(receiptResult.logs);
            txProcessed += 1;
            if (txProcessed === blockResult.transactions.length) end(null, logs);
          });
        }
      });
      return;

    case 'eth_getTransactionCount':
      etherscanXHR(true, proto, network, 'proxy', 'eth_getTransactionCount', {
        address: payload.params[0],
        tag: payload.params[1]
      }, end);
      return;

    case 'eth_getCode':
      etherscanXHR(true, proto, network, 'proxy', 'eth_getCode', {
        address: payload.params[0],
        tag: payload.params[1]
      }, end);
      return;

    case 'eth_getStorageAt':
      etherscanXHR(true, proto, network, 'proxy', 'eth_getStorageAt', {
        address: payload.params[0],
        position: payload.params[1],
        tag: payload.params[2]
      }, end);
      return;

    default:
      next();
      return;
  }
}

function toQueryString(params) {
  return Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
}

function etherscanXHR(useGetMethod, proto, network, module, action, params, end) {
  var uri = proto + '://' + network + '.etherscan.io/api?' + toQueryString({ module: module, action: action }) + '&' + toQueryString(params);

  xhr({
    uri: uri,
    method: useGetMethod ? 'GET' : 'POST',
    headers: {
      'Accept': 'application/json'
      // 'Content-Type': 'application/json',
    },
    rejectUnauthorized: false
  }, function (err, res, body) {
    // console.log('[etherscan] response: ', err)

    if (err) return end(err);

    /*console.log('[etherscan request]'
          + ' method: ' + useGetMethod
          + ' proto: ' + proto
          + ' network: ' + network
          + ' module: ' + module
          + ' action: ' + action
          + ' params: ' + params
          + ' return body: ' + body);*/

    if (body.indexOf('403 - Forbidden: Access is denied.') > -1) return end('403 - Forbidden: Access is denied.');

    var data;
    try {
      data = JSON.parse(body);
    } catch (err) {
      console.error(err.stack);
      return end(err);
    }

    // console.log('[etherscan] response decoded: ', data)

    // NOTE: or use id === -1? (id=1 is 'success')
    if (module === 'proxy' && data.error) {
      // Maybe send back the code too?
      return end(data.error.message);
    }

    // NOTE: or data.status !== 1?
    if (module === 'account' && data.message !== 'OK') {
      return end(data.message);
    }

    end(null, data.result);
  });
}

/*
 * Calculate gasPrice based on last blocks.
 * @author github.com/axic
 *
 * FIXME: support minimum suggested gas and perhaps other options from geth:
 * https://github.com/ethereum/go-ethereum/blob/master/eth/gasprice.go
 * https://github.com/ethereum/go-ethereum/wiki/Gas-Price-Oracle
 */

inherits$1(GaspriceProvider, SubProvider);

function GaspriceProvider(opts) {
  opts = opts || {};
  this.numberOfBlocks = opts.numberOfBlocks || 10;
}

GaspriceProvider.prototype.handleRequest = function (payload, next, end) {
  if (payload.method !== 'eth_gasPrice') return next();

  var self = this;

  self.emitPayload({ method: 'eth_blockNumber' }, function (err, res) {
    // FIXME: convert number using a bignum library
    var lastBlock = parseInt(res.result, 16);
    var blockNumbers = [];
    for (var i = 0; i < self.numberOfBlocks; i++) {
      blockNumbers.push('0x' + lastBlock.toString(16));
      lastBlock--;
    }

    function getBlock(item, end) {
      self.emitPayload({ method: 'eth_getBlockByNumber', params: [item, true] }, function (err, res) {
        if (err) return end(err);
        end(null, res.result.transactions);
      });
    }

    // FIXME: this could be made much faster
    function calcPrice(err, transactions) {
      // flatten array
      transactions = transactions.reduce(function (a, b) {
        return a.concat(b);
      }, []);

      // leave only the gasprice
      // FIXME: convert number using a bignum library
      transactions = transactions.map(function (a) {
        return parseInt(a.gasPrice, 16);
      }, []);

      // order ascending
      transactions.sort(function (a, b) {
        return a - b;
      });

      // ze median
      var half = Math.floor(transactions.length / 2);

      var median;
      if (transactions.length % 2) median = transactions[half];else median = Math.floor((transactions[half - 1] + transactions[half]) / 2.0);

      end(null, median);
    }

    async.map(blockNumbers, getBlock, calcPrice);
  });
};

/*
 * Uses ethereumjs-tx to sign a transaction.
 *
 * The two callbacks a user needs to implement are:
 * - getAccounts() -- array of addresses supported
 * - getPrivateKey(address) -- return private key for a given address
 *
 * Optionally approveTransaction(), approveMessage() can be supplied too.
 */

inherits$1(HookedWalletEthTxSubprovider, HookedWalletSubprovider);

function HookedWalletEthTxSubprovider(opts) {
  var self = this;

  HookedWalletEthTxSubprovider.super_.call(self, opts);

  self.signTransaction = function (txData, cb) {
    // defaults
    if (txData.gas !== undefined) txData.gasLimit = txData.gas;
    txData.value = txData.value || '0x00';
    txData.data = ethUtil.addHexPrefix(txData.data);

    opts.getPrivateKey(txData.from, function (err, privateKey) {
      if (err) return cb(err);

      var tx = new Transaction(txData);
      tx.sign(privateKey);
      cb(null, '0x' + tx.serialize().toString('hex'));
    });
  };

  self.signMessage = function (msgParams, cb) {
    opts.getPrivateKey(msgParams.from, function (err, privateKey) {
      if (err) return cb(err);
      var msgHash = ethUtil.sha3(msgParams.data);
      var sig = ethUtil.ecsign(msgHash, privateKey);
      var serialized = ethUtil.bufferToHex(concatSig(sig.v, sig.r, sig.s));
      cb(null, serialized);
    });
  };

  self.signPersonalMessage = function (msgParams, cb) {
    opts.getPrivateKey(msgParams.from, function (err, privateKey) {
      if (err) return cb(err);
      var serialized = sigUtil.personalSign(privateKey, msgParams);
      cb(null, serialized);
    });
  };

  self.signTypedMessage = function (msgParams, cb) {
    opts.getPrivateKey(msgParams.from, function (err, privateKey) {
      if (err) return cb(err);
      var serialized = sigUtil.signTypedData(privateKey, msgParams);
      cb(null, serialized);
    });
  };
}

function concatSig(v, r, s) {
  r = ethUtil.fromSigned(r);
  s = ethUtil.fromSigned(s);
  v = ethUtil.bufferToInt(v);
  r = ethUtil.toUnsigned(r).toString('hex');
  s = ethUtil.toUnsigned(s).toString('hex');
  v = ethUtil.stripHexPrefix(ethUtil.intToHex(v));
  return ethUtil.addHexPrefix(r.concat(s, v).toString("hex"));
}

var net = {};

inherits$1(IpcSource, SubProvider);

function IpcSource(opts) {
  var self = this;
  self.ipcPath = opts.ipcPath || '/root/.ethereum/geth.ipc';
}

IpcSource.prototype.handleRequest = function (payload, next, end) {
  var self = this;
  var targetPath = self.ipcPath;
  var method = payload.method;
  var params = payload.params;

  // new payload with random large id,
  // so as not to conflict with other concurrent users
  var newPayload = createPayload(payload);
  // console.log('------------------ network attempt -----------------')
  // console.log(payload)
  // console.log('---------------------------------------------')

  if (newPayload == null) {
    console.log('no payload');
    end('no payload', null);
  }

  var client = net.connect({ path: targetPath }, function () {
    client.end(JSON.stringify(payload));
  });

  client.on('connection', function (d) {
    console.log(d);
  });

  client.on('data', function (data) {
    var response = "";
    response += data.toString();
    var res = JSON.parse(response);
    end(null, res.result);
  });

  // client.on('end', () => {
  //   console.log('Socket Received payload');
  // });

  client.on('error', function (error) {
    console.error(error);
    end(error, null);
  });

  process.setMaxListeners(Infinity);

  process.on('SIGINT', function () {
    console.log("Caught interrupt signal");

    client.end();
    process.exit();
  });
};

inherits$1(SolcSubprovider, SubProvider);

function SolcSubprovider(opts) {
  if (opts && opts.version) {
    this.solc = solc.useVersion(opts.version);
  } else {
    this.solc = solc;
  }
}

SolcSubprovider.prototype.handleRequest = function (payload, next, end) {
  switch (payload.method) {
    case 'eth_getCompilers':
      end(null, ["solidity"]);
      break;

    case 'eth_compileSolidity':
      this._compileSolidity(payload, end);
      break;

    default:
      next();
  }
};

// Conforms to https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_compilesolidity
SolcSubprovider.prototype._compileSolidity = function (payload, end) {
  // optimised
  var output = this.solc.compile(payload.params[0], 1);
  if (!output) {
    end('Compilation error');
  } else if (output.errors) {
    end(output.errors.join('\n'));
  } else {
    // Select first contract FIXME??
    var contract = output.contracts[Object.keys(output.contracts)[0]];

    var ret = {
      code: '0x' + contract.bytecode,
      info: {
        source: payload.params[0],
        language: 'Solidity',
        languageVersion: this.solc.version(),
        compilerVersion: this.solc.version(),
        abiDefinition: JSON.parse(contract.interface),
        userDoc: { methods: {} },
        developerDoc: { methods: {} }
      }
    };

    end(null, ret);
  }
};

inherits$1(StreamSubprovider, readableStream.Duplex);

function StreamSubprovider() {
  readableStream.Duplex.call(this, {
    objectMode: true
  });

  this._payloads = {};
}

StreamSubprovider.prototype.handleRequest = function (payload, next, end) {
  var id = payload.id;
  // handle batch requests
  if (Array.isArray(payload)) {
    // short circuit for empty batch requests
    if (payload.length === 0) {
      return callback(null, []);
    }
    id = generateBatchId(payload);
  }
  // store request details
  this._payloads[id] = [payload, end];
  this.push(payload);
};

StreamSubprovider.prototype.setEngine = noop$1;

// stream plumbing

StreamSubprovider.prototype._read = noop$1;

StreamSubprovider.prototype._write = function (msg, encoding, cb) {
  this._onResponse(msg);
  cb();
};

// private

StreamSubprovider.prototype._onResponse = function (response) {
  var id = response.id;
  // handle batch requests
  if (Array.isArray(response)) {
    id = generateBatchId(response);
  }
  var data = this._payloads[id];
  if (!data) throw new Error('StreamSubprovider - Unknown response id');
  delete this._payloads[id];
  var callback = data[1];

  // run callback on empty stack,
  // prevent internal stream-handler from catching errors
  setTimeout(function () {
    callback(null, response.result);
  });
};

// util

function generateBatchId(batchPayload) {
  return 'batch:' + batchPayload.map(function (payload) {
    return payload.id;
  }).join(',');
}

function noop$1() {}

function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}

/*
 * As per https://github.com/ethereum/wiki/wiki/JSON-RPC#hex-value-encoding
 * Quanities should be represented by the most compact hex representation possible
 * This means that no leading zeroes are allowed. There helpers make it easy
 * to convert to and from integers and their compact hex representation
 */

function intToQuantityHex(n) {
    assert(typeof n === 'number' && n === Math.floor(n), 'intToQuantityHex arg must be an integer');
    var nHex = ethUtil.toBuffer(n).toString('hex');
    if (nHex[0] === '0') {
        nHex = nHex.substring(1);
    }
    return ethUtil.addHexPrefix(nHex);
}

// handles the following RPC methods:
//   eth_call
//   eth_estimateGas

inherits$1(VmSubprovider, SubProvider);

function VmSubprovider(opts) {
  var self = this;
  self.opts = opts || {};
  self.methods = ['eth_call', 'eth_estimateGas'];
  // set initialization blocker
  self._ready = new Stoplight();
  self._blockGasLimit = null;
}

// setup a block listener on 'setEngine'
VmSubprovider.prototype.setEngine = function (engine) {
  var self = this;
  SubProvider.prototype.setEngine.call(self, engine);
  // unblock initialization after first block
  engine.once('block', function (block) {
    self._blockGasLimit = ethUtil.bufferToInt(block.gasLimit);
    self._ready.go();
  });
};

VmSubprovider.prototype.handleRequest = function (payload, next, end) {
  if (this.methods.indexOf(payload.method) < 0) {
    return next();
  }

  var self = this;
  switch (payload.method) {

    case 'eth_call':
      self.runVm(payload, function (err, results) {
        if (err) return end(err);
        var result = '0x';
        if (!results.error && results.vm.return) {
          result = ethUtil.addHexPrefix(results.vm.return.toString('hex'));
        }
        end(null, result);
      });
      return;

    case 'eth_estimateGas':
      self.estimateGas(payload, end);
      return;
  }
};

VmSubprovider.prototype.estimateGas = function (payload, end) {
  var self = this;
  var lo = 0;
  var hi = self._blockGasLimit;

  var minDiffBetweenIterations = 1200;
  var prevGasLimit = self._blockGasLimit;
  async.doWhilst(function (callback) {
    // Take a guess at the gas, and check transaction validity
    var mid = (hi + lo) / 2;
    payload.params[0].gas = mid;
    self.runVm(payload, function (err, results) {
      gasUsed = err ? self._blockGasLimit : ethUtil.bufferToInt(results.gasUsed);
      if (err || gasUsed === 0) {
        lo = mid;
      } else {
        hi = mid;
        // Perf improvement: stop the binary search when the difference in gas between two iterations
        // is less then `minDiffBetweenIterations`. Doing this cuts the number of iterations from 23
        // to 12, with only a ~1000 gas loss in precision.
        if (Math.abs(prevGasLimit - mid) < minDiffBetweenIterations) {
          lo = hi;
        }
      }
      prevGasLimit = mid;
      callback();
    });
  }, function () {
    return lo + 1 < hi;
  }, function (err) {
    if (err) {
      end(err);
    } else {
      hi = Math.floor(hi);
      var gasEstimateHex = intToQuantityHex(hi);
      end(null, gasEstimateHex);
    }
  });
};

VmSubprovider.prototype.runVm = function (payload, cb) {
  var self = this;

  var blockData = self.currentBlock;
  var block = blockFromBlockData(blockData);
  var blockNumber = ethUtil.addHexPrefix(blockData.number.toString('hex'));

  // create vm with state lookup intercepted
  var vm = self.vm = hooked.fromWeb3Provider(self.engine, blockNumber, {
    enableHomestead: true
  });

  if (self.opts.debug) {
    vm.on('step', function (data) {
      console.log(data.opcode.name);
    });
  }

  // create tx
  var txParams = payload.params[0];
  // console.log('params:', payload.params)

  var tx = new FakeTransaction({
    to: txParams.to ? ethUtil.addHexPrefix(txParams.to) : undefined,
    from: txParams.from ? ethUtil.addHexPrefix(txParams.from) : undefined,
    value: txParams.value ? ethUtil.addHexPrefix(txParams.value) : undefined,
    data: txParams.data ? ethUtil.addHexPrefix(txParams.data) : undefined,
    gasLimit: txParams.gas ? ethUtil.addHexPrefix(txParams.gas) : block.header.gasLimit,
    gasPrice: txParams.gasPrice ? ethUtil.addHexPrefix(txParams.gasPrice) : undefined,
    nonce: txParams.nonce ? ethUtil.addHexPrefix(txParams.nonce) : undefined
  });

  vm.runTx({
    tx: tx,
    block: block,
    skipNonce: true,
    skipBalance: true
  }, function (err, results) {
    if (err) return cb(err);
    if (results.error != null) {
      return cb(new Error("VM error: " + results.error));
    }
    if (results.vm && results.vm.exception !== 1) {
      return cb(new Error("VM Exception while executing " + payload.method + ": " + results.vm.exceptionError));
    }

    cb(null, results);
  });
};

function blockFromBlockData(blockData) {
  var block = new Block();
  // block.header.hash = ethUtil.addHexPrefix(blockData.hash.toString('hex'))

  block.header.parentHash = blockData.parentHash;
  block.header.uncleHash = blockData.sha3Uncles;
  block.header.coinbase = blockData.miner;
  block.header.stateRoot = blockData.stateRoot;
  block.header.transactionTrie = blockData.transactionsRoot;
  block.header.receiptTrie = blockData.receiptRoot || blockData.receiptsRoot;
  block.header.bloom = blockData.logsBloom;
  block.header.difficulty = blockData.difficulty;
  block.header.number = blockData.number;
  block.header.gasLimit = blockData.gasLimit;
  block.header.gasUsed = blockData.gasUsed;
  block.header.timestamp = blockData.timestamp;
  block.header.extraData = blockData.extraData;
  return block;
}

inherits$1(WalletSubprovider, HookedWalletEthTxSubprovider);

function WalletSubprovider(wallet, opts) {
  opts.getAccounts = function (cb) {
    cb(null, [wallet.getAddressString()]);
  };

  opts.getPrivateKey = function (address, cb) {
    if (address !== wallet.getAddressString()) {
      return cb('Account not found');
    }

    cb(null, wallet.getPrivateKey());
  };

  WalletSubprovider.super_.call(this, opts);
}

inherits$1(Web3Subprovider, SubProvider);

function Web3Subprovider(provider) {
  this.provider = provider;
}

Web3Subprovider.prototype.handleRequest = function (payload, next, end) {
  this.provider.sendAsync(payload, function (err, response) {
    if (err != null) return end(err);
    if (response.error != null) return end(new Error(response.error.message));
    end(null, response.result);
  });
};

inherits$1(WhitelistProvider, SubProvider);

function WhitelistProvider(methods) {
  this.methods = methods;

  if (this.methods == null) {
    this.methods = ['eth_gasPrice', 'eth_blockNumber', 'eth_getBalance', 'eth_getBlockByHash', 'eth_getBlockByNumber', 'eth_getBlockTransactionCountByHash', 'eth_getBlockTransactionCountByNumber', 'eth_getCode', 'eth_getStorageAt', 'eth_getTransactionByBlockHashAndIndex', 'eth_getTransactionByBlockNumberAndIndex', 'eth_getTransactionByHash', 'eth_getTransactionCount', 'eth_getTransactionReceipt', 'eth_getUncleByBlockHashAndIndex', 'eth_getUncleByBlockNumberAndIndex', 'eth_getUncleCountByBlockHash', 'eth_getUncleCountByBlockNumber', 'eth_sendRawTransaction', 'eth_getLogs'];
  }
}

WhitelistProvider.prototype.handleRequest = function (payload, next, end) {
  if (this.methods.indexOf(payload.method) >= 0) {
    next();
  } else {
    end(new Error("Method '" + payload.method + "' not allowed in whitelist."));
  }
};

exports.ProviderEngine = Web3ProviderEngine;
exports.ZeroClientProvider = ZeroClientProvider;
exports.CacheSubprovider = BlockCacheProvider;
exports.DefaultFixtures = DefaultFixtures;
exports.EtherscanSubprovider = EtherscanProvider;
exports.FetchSubprovider = FetchSubprovider;
exports.FilterSubprovider = FilterSubprovider;
exports.GaspriceProvider = GaspriceProvider;
exports.HookedWalletEthTxSubprovider = HookedWalletEthTxSubprovider;
exports.HookedWalletSubprovider = HookedWalletSubprovider;
exports.InflightCacheSubprovider = InflightCacheSubprovider;
exports.IpcSubprovider = IpcSource;
exports.NonceSubprovider = NonceTrackerSubprovider;
exports.RpcSubprovider = RpcSource;
exports.SanitizerSubprovider = SanitizerSubprovider;
exports.SolcSubprovider = SolcSubprovider;
exports.StreamSubprovider = StreamSubprovider;
exports.SubProvider = SubProvider;
exports.VmSubprovider = VmSubprovider;
exports.WalletSubprovider = WalletSubprovider;
exports.Web3Subprovider = Web3Subprovider;
exports.WhitelistProvider = WhitelistProvider;
