var aforth = require('../index.js');
var assert = require('assert');
var fs = require('fs');

 

/* http://blog.vullum.io/javascript-flow-callback-hell-vs-async-vs-highland/

var express = require('express');  
var fs = require('fs');  
var app = express();
var aforth = require('../index.js');

app.post('/process-file', function(req, res) {
  var s = new aforth.Stack();
  s.push('output.txt');
  s.push('input.txt');
  s.async(fs.readFile, 1);
  s.async(process1);
  s.async(process2);
  s.async(process3);
  s.async(fs.writeFile, 2);
  s.done(function(err) {
    if (err) {
      res.status(500).send(err);
    } else {
      res.status(200).send('processed successfully using aforth');
    }
  });
});

*/


/*
  Read the file with name 'a' and the file with name 'b'.
  Concatenate their contents and write to a new file
  named 'out'. Then call 'cb'.
  */
function concatFiles(a, b, out, cb) {
  var s = new aforth.Stack();
  s.push(out);
  s.push(a);
  s.async(fs.readFile, 1);
  s.push(b);
  s.async(fs.readFile, 1);
  s.sync(function(a, b) {return a + b;});
  s.async(fs.writeFile, 2);
  s.done(cb);
}

describe('aforth', function() {
  it('filecat', function(done) {
    var a = "/tmp/aa.txt";
    var b = "/tmp/bb.txt";
    var out = "/tmp/result.txt";
    
    var s = new aforth.Stack();
    s.push(a);
    s.push("Anemo");
    var aw = s.async(0, fs.writeFile, 2);
    s.push(a);

    s.push(b);
    s.push("mind");
    var bw = s.async(0, fs.writeFile, 2);
    s.push(b);
    
    s.push(out);
    s.async({require: [aw, bw]}, concatFiles);
    s.as(out);
    
    s.async(fs.readFile, 1);
    
    s.get(function(err, value) {
      assert(!err);
      assert.equal(value, "Anemomind");
      done();
    });
  });
  
  it('Stack', function(done) {
    var s = new aforth.Stack();
    s.push(13);
    s.push(9);
    s.get(function(err, value) {
      assert.equal(9, value);
      assert.equal(2, s.size());
      var args = s.makeArgArray(2);
      args.get(function(err, value) {
        assert(!err);
        assert(value instanceof Array);
        assert.equal(value.length, 2);
        assert.equal(value[0], 13);
        assert.equal(value[1], 9);
        assert.equal(0, s.size());
        done();
      });
    });
  });

  it('ArgArray', function(done) {
    var arr = new aforth.ArgArray(3);
    assert(!arr.finished());
    arr.get(function(err, results) {
      assert(!err);
      assert.equal(results[2], 3)
      done();
    });
    arr.report(0, null, 1);
    arr.report(1, null, 2);
    arr.report(2, null, 3);
  });

  it('Add sync', function(done) {
    var s = new aforth.Stack();
    s.push(3);
    s.push(4);
    s.sync(function(a, b) {return a + b;});
    s.get(function(err, value) {
      assert(!err);
      assert.equal(value, 7);
      done();
    });
  });
  
  it('Add async', function(done) {
    var s = new aforth.Stack();
    s.push(3);
    s.push(4);
    s.async(function(a, b, cb) {
      setTimeout(function() {
        cb(null, a + b);
      }, 1);
    });
    s.get(function(err, value) {
      assert(!err);
      assert.equal(value, 7);
      done();
    });
  });

  it('file', function(done) {
    var s = new aforth.Stack();
    
    s.push("/tmp/a.txt");
    s.dup();
    s.push("Hej");
    s.async(fs.writeFile, 2);
    s.pop();
    s.push("/tmp/b.txt");
    s.dup();
    s.push(" Mummi");
    s.async(fs.writeFile, 2);
    s.pop();
    s.swap();
    var k = s.async(fs.readFile, 1);
    assert(k.listeners);
    s.swap();
    s.async(fs.readFile, 1);
    s.sync(function(a, b) {
      return a + b;
    });
    s.get(function(err, value) {
      assert(!err);
      assert.equal(s.size(), 1);
      assert.equal(value, "Hej Mummi");
      done();
    });
  });

  it('multiple outputs', function(done) {
    var s = new aforth.Stack();
    s.push(3);
    s.push(9);
    s.async(2, function(a, b, cb) {
      cb(null, a + b, a*b);
    });
    assert.equal(s.size(), 2);
    s.getArray(function(err, arr) {
      assert(!err);
      assert(arr instanceof Array);
      assert(arr[0] == 12);
      assert(arr[1] == 27);
      done();
    });
  });

  it('async-error', function(done) {
    var s = new aforth.Stack();
    s.async(function(cb) {
      cb('This is an error');
    });
    s.get(function(err, value) {
      assert.equal(err, 'This is an error');
      assert.equal(value, null);
      done();
    });
  });

  it('sync-error', function(done) {
    var s = new aforth.Stack();
    s.sync(function() {
      throw 'This is an error';
    });
    s.get(function(err, value) {
      assert.equal(err, 'This is an error');
      assert.equal(value, null);
      done();
    });
  });

  it('done', function(d) {
    var x = null;
    var s = new aforth.Stack();
    s.async(function(cb) {
      setTimeout(function() {
        x = 119;
        cb();
      }, 1);
    });
    s.done(function(err) {
      assert(!err);
      assert.equal(x, 119);
      d();
    });
  });
  
  it('noerror', function(done) {
    var s = new aforth.Stack();
    s.push(7);
    s.push(17);
    s.async({outputError: false}, function(a, b, cb) {
      cb(a + b);
    });
    s.get(function(err, value) {
      assert(!err);
      assert.equal(value, 24);
      done();
    });
  });
  
  it('misc', function(done) {
    assert.equal(aforth.getInputCount({}, function(a, b){}, true), 2);
    assert.equal(aforth.getInputCount({}, function(a, b, c){}, true), 3);
    assert.equal(aforth.getInputCount({in:4}, function() {}, true), 4);
    assert.equal(aforth.getOutputCount({in:4}, function() {}, true), 1);
    assert.equal(aforth.getOutputCount({out:9}, function() {}, true), 9);
    done();
  });

  it('parseargs', function() {
    var x = aforth.parseArgs(['Some random test', 3, function(a, b) {}, 2]);
    assert.equal(x.in, 2);
    assert.equal(x.out, 3);
    assert.equal('Some random test', x.label);
    assert.equal(typeof x.f, 'function');
  });

  it('waitfor', function(done) {
    var a = new aforth.AForthPromise();
    var b = new aforth.AForthPromise();
    aforth.waitFor([a, b], function(err) {
      assert.equal(a.data, 3);
      assert.equal(b.data, 4);
      done();
    });
    a.deliver(null, 3);
    b.deliver(null, 4);
  });
  
  it('waitfor2', function(done) {
    var a = new aforth.AForthPromise();
    var b = new aforth.AForthPromise();
    var c = new aforth.AForthPromise();
    aforth.waitFor([a, b], function(err) {
      assert.equal(a.data, 3);
      assert.equal(b.data, null);
      assert.equal(c.data, null);
      assert.equal(err, 'err');
      done();
    });
    a.deliver(null, 3);
    b.deliver('err');
  });
  
  it('waitfor-empty', function(done) {
    aforth.waitFor([], function(err) {
      done();
    });
  });
  
});
