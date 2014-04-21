
## ReadCommand

A utility that wraps the built-in `readline` utility in order to read and parse multi-line commands. This module was extracted from work that was bloating in [node-corporal](https://github.com/mrvisser/node-corporal), an interactive shell command-line utility.

## Features

* Argument parsing from the user's input
* Multi-line command input
* Command navigation using `up` and `down` arrow keys
* Auto-complete hook for `readline` autocomplete

TODO: Expose auto-complete functionality

## Example

### Read a single command

This example reads a command and prints the parsed argument array. It is invoked with the history of commands: 1, 2, 3, 4 and 5 (5 being the newest), therefore using the up and down arrow keys will toggle through these items.

```javascript
var readcommand = require('../index');

readcommand.read({'history': ['1', '2', '3', '4', '5']}, function(args) {
    console.log('args: %s', JSON.stringify(args));
});
```

### Start a command loop

This example starts an interactive command prompt, where each command is provided to the callback function. After 2 SIGINT invocations by the user, the loop terminates. After each command, it prints the parsed arguments. The command history is maintained within the command loop.

```javascript
var readcommand = require('../index');

var sigints = 0;

readcommand.loop(null, function(err, args, str, next) {
    if (err && err.code !== 'SIGINT') {
        throw err;
    } else if (err) {
        if (sigints === 1) {
            process.exit(0);
        } else {
            sigints++;
            console.log('Press ^C again to exit.');
            return next();
        }
    } else {
        sigints = 0;
    }

    console.log('Received args: %s', JSON.stringify(args));
    return next();
});

## License

Copyright (c) 2014 Branden Visser

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
