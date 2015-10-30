var assert = require('assert');

var promiseCounter = 0;

/////////////////////// AForthPromise
function AForthPromise(label) {
  this.counter = promiseCounter;
  this.delivered = false;
  this.data = null;
  this.error = null;
  this.listeners = [];
  promiseCounter++;
}

AForthPromise.prototype.disp = function() {
  console.log('  AForthPromise (%d):', this.counter);
  console.log('    %d listeners', this.listeners.length);
  if (this.delivered) {
    console.log('    data: %j', this.data);
    if (this.error) {
      console.log('    error: %j', this.error);
    }
  } else {
    console.log('    pending...');
  }
}

AForthPromise.prototype.informListeners = function() {
  assert(this.delivered);
  for (var i = 0; i < this.listeners.length; i++) {
    this.listeners[i](this.error, this.data);
  }
}

AForthPromise.prototype.deliver = function(err, data) {
  if (this.delivered) {
    console.log('**************** ERROR: ALREADY DELIVERED DATA TO PROMISE');
    console.log('AForthPromise:');
    this.disp();
    console.log('Data:');
    console.log(data);
  } else {
    this.error = err;
    this.data = data;
    this.delivered = true;
    this.informListeners();
  }
}

AForthPromise.prototype.get = function(cb) {
  if (this.delivered) {
    cb(this.error, this.data);
  } else {
    this.listeners.push(cb);
  }
}

/////////////////////// ArgArray
function ArgArray(n) {
  this.data = new Array(n);
  this.marked = new Array(n);
  this.counter = 0;
  this.error = null;
  this.listeners = [];
}

ArgArray.prototype.finished = function() {
  return this.error || this.data.length <= this.counter;
}

ArgArray.prototype.inform = function(dst) {
  assert(this.finished());
  if (this.error) {
    dst(this.error);
  } else {
    dst(null, this.data);
  }
}

ArgArray.prototype.get = function(cb) {
  if (this.finished()) {
    this.inform(cb);
  } else {
    this.listeners.push(cb);
  }
}

ArgArray.prototype.tryInformListeners = function() {
  if (this.finished()) {
    for (var i = 0; i < this.listeners.length; i++) {
      this.inform(this.listeners[i]);
    }
  }
}

ArgArray.prototype.report = function(index, err, value) {
  if (!this.finished() && !this.marked[index]) {
    this.error = err;
    this.marked[index] = true;
    this.data[index] = value;
    this.counter++;
    this.tryInformListeners();
  }
}

ArgArray.prototype.makeReporter = function(index) {
  var self = this;
  return function(err, value) {
    self.report(index, err, value);
  };
}


/////////////////////// Value
function Value(x) {
  this.data = x;
}

Value.prototype.get = function(cb) {
  cb(null, this.data);
}

Value.prototype.disp = function() {
  console.log("  Value: %j", this.data);
}



/////////////////////// Stack
function Stack() {
  this.data = [];
}

Stack.prototype.push = function(x) {
  this.data.push(new Value(x));
}



Stack.prototype.top = function() {
  return this.data[this.data.length-1]
}

Stack.prototype.getLazy = function(cb) {
  var top = this.top();
  if (top == undefined) {
    cb();
  } else {
    top.get(cb);
  }
}

// Get the top element,
// but require the evaluation of all elements in the stack
Stack.prototype.get = function(cb) {
  this.getArray(function(err, arr) {
    if (err) {
      cb(err);
    } else if (arr.length == 0) {
      cb();
    } else {
      cb(null, arr[arr.length-1]);
    }
  });
}

// Evaluate all elements, but
// don't pass any of them.
Stack.prototype.done = function(cb) {
  this.get(function(err, value) {
    cb(err);
  });
}

Stack.prototype.size = function() {
  return this.data.length;
}

Stack.prototype.makeArgArray = function(len) {
  k = this.size() - len;
  var args = this.data.slice(k);
  this.data = this.data.slice(0, k);
  var arr = new ArgArray(len);
  for (var i = 0; i < len; i++) {
    args[i].get(arr.makeReporter(i));
  }
  return arr;
}


function argsToArray(x) {
  return Array.prototype.slice.call(x);
}


/*
    How to get the names of function parameters:
    
      http://stackoverflow.com/questions/1007981/how-to-get-function-parameter-names-values-dynamically-from-javascript
*/
var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
var ARGUMENT_NAMES = /([^\s,]+)/g;
function getParamNames(func) {
  var fnStr = func.toString().replace(STRIP_COMMENTS, '');
  var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
  if(result === null)
     result = [];
  return result;
}

function getInputCount(opts, f, isSync) {
  if (opts.in == null) {
    var names = getParamNames(f);
    return (isSync? names.length : names.length - 1);
  } else {
    return opts.in;
  }
}

function getOutputCount(opts, f, isSync) {
  if (opts.out == null) {
    return 1;
  } else {
    return opts.out;
  }
}

function deliver(promises, err, value) {
  for (var i = 0; i < promises.length; i++) {
    promises[i].deliver(err, value);
  }
}

function waitFor(promises, cb) {
  if (promises == null) {
    cb();
  } else {
    var counter = 0;
    var delivered = false;
    var deliver = function(err) {
      if (!delivered) {
        cb(err);
        delivered = true;
      }
    }
    for (var i = 0; i < promises.length; i++) {
      promises[i].get(function(err) {
        counter++;
        if (err || counter == promises.length) {
          deliver(err);
        }
      });
    }
    if (promises.length == 0) {
      cb();
    }
  }
}

Stack.prototype.runSub = function(isSync, opts, f) {
  var self = this;
  if (typeof(opts) == 'function') {
    var f = opts;
    opts = {};
  }

  var n = getInputCount(opts, f, isSync);
  if (n < 0) {
    console.log('--> ERROR: Negative number of inputs. Did you forget the callback parameter?');
    console.log('    The function: ' + f.toString());
    throw new Error('Bad input count');      
  }
  var out = getOutputCount(opts, f);
  if (this.size() < n) {
    console.log('--> ERROR in when running "' + opts.label + "'");
    console.log('    The stack has ' + this.size() + ' elements but ');
    console.log('    the command requires ' + n);
    console.log('    The function: ' + f.toString());
    throw new Error('Bad input count');
  }

  var argArray = this.makeArgArray(n);
  var promises = new Array(out);
  var completed = new AForthPromise();
  for (var i = 0; i < out; i++) {
    promises[i] = new AForthPromise();
    this.data.push(promises[i]);
  }
  if (out > 1 && isSync) {
    console.log("Warning: Too many outputs for synchronous function");
  }

  waitFor(opts.require, function(err) {
    if (err) {
      deliver(promises, err);
      completed.deliver(err);
    } else {
      argArray.get(function(err, args) {
        if (err) {
          deliver(promises, err);
          completed.deliver(err);
        } else {
          try {
            if (isSync) {
              var ret = f.apply(null, args);
              deliver(promises, null, ret);
              completed.deliver(null, ret);
            } else {
              f.apply(null, args.concat([function() {
                var outputs = argsToArray(arguments);
                var error = null;
                var results = null;
                if (opts.outputError != null) {
                  results = outputs;
                } else {
                  error = outputs[0];
                  results = outputs.slice(1);              
                }
                for (var i = 0; i < out; i++) {
                  promises[i].deliver(error, results[i]);
                }
                completed.deliver(error);
              }]));
            }
          } catch (e) {
            deliver(promises, e, null);
            completed.deliver(e);
          }
        }
      });
    }
  });
  return completed;
}

Stack.prototype.run = function(isSync, opts) {
  return this.runSub(isSync, opts, opts.f);
}

function setIfDefined(dst, key, value) {
  if (value != undefined) {
    dst[key] = value;
  }
}

function parseArgs(args) {
  var opts = {};
  var inCount = null;
  var outCount = null;
  var label = null;
  var f = null;
  for (var i = 0; i < args.length; i++) {
    var x = args[i];
    if (typeof(x) == 'number') {
      if (f) {
        inCount = x;
      } else {
        outCount = x;
      }
    } else if (typeof(x) == 'function') {
      f = x;
    } else if (typeof(x) == 'string') {
      label = x;
    } else {
      opts = x;
    }
  }
  return {
    in: opts.in || inCount,
    out: opts.out || outCount,
    label: opts.label || label,
    f: f,
    require: opts.require,
    outputError: opts.outputError
  };
}

Stack.prototype.sync = function() {
  return this.run(true, parseArgs(argsToArray(arguments)));
}

// Requires the evaluation of the top stack element,
// discards it, and replaces it by a new value.
Stack.prototype.as = function(newValue) {
  this.sync(function(x) {
    return newValue;
  });
}


Stack.prototype.async = function(opts, f) {
  return this.run(false, parseArgs(argsToArray(arguments)));  
}

Stack.prototype.pop = function() {
  this.data.pop();
}

Stack.prototype.dup = function() {
  assert(this.size() >= 1);
  this.data.push(this.top());
}

Stack.prototype.empty = function() {
  return this.size() == 0;
}

Stack.prototype.swap = function() {
  assert(this.size() >= 2);
  i = this.data.length - 2;
  var a = this.data[i];
  this.data[i] = this.data[i+1];
  this.data[i+1] = a;
}

Stack.prototype.getArray = function(cb) {
  var args = new ArgArray(this.data.length);
  for (var i = 0; i < this.data.length; i++) {
    var x = this.data[i];
    x.get(args.makeReporter(i));
  }
  args.get(cb);
}

Stack.prototype.disp = function() {
  console.log('==== STACK CONTENTS FROM BOTTOM  ====');
  for (var i = 0; i < this.data.length; i++) {
    console.log('Element %d of %d', i, this.data.length);
    this.data[i].disp();
  }
}

function isSsync(x) {
  if (x.sync) {
    return true;
  }
}


module.exports.Stack = Stack;

// Just for debugging:
module.exports.ArgArray = ArgArray;
module.exports.getInputCount = getInputCount;
module.exports.getOutputCount = getOutputCount;
module.exports.getParamNames = getParamNames;
module.exports.parseArgs = parseArgs;
module.exports.AForthPromise = AForthPromise;
module.exports.waitFor = waitFor;
