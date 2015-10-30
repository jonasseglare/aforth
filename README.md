# aforth
Asynchronous node.js with postfix notation

Asynchronous control flow in node.js using a stack, similar to forth. An alternative to using promises. This is what a function to concatenate two files might look like:
```javascript
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
```
Look at the test cases for more ideas.