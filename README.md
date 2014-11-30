
## ReadCommand

[![Build Status](https://travis-ci.org/mrvisser/node-readcommand.png?branch=master)](https://travis-ci.org/mrvisser/node-readcommand)

A utility that wraps the built-in node.js `readline` functionality to parse multi-line shell commands. This module was extracted from work that was bloating in [node-corporal](https://github.com/mrvisser/node-corporal), a utility that makes building CLI apps FUN.

## Features

* Argument parsing from the user's input
* Multi-line command input
* Command history navigation using `up` and `down` arrow keys
* Auto-complete hook for argument auto-completion

## API

* [readcommand.read(options, callback)](https://github.com/mrvisser/node-readcommand/blob/master/index.js#L54-L80)
    * Read a single command from the user

* [readcommand.loop(options, callback)](https://github.com/mrvisser/node-readcommand/blob/master/index.js#L10-L39)
    * Read commands from the user in an interactive loop

## Examples

### Read a single command

This is the most simple example, reading a command from a user in your interactive shell, and parsing it into an arguments array like `process.argv`, then printing it to the console.

```javascript
require('readcommand').read(function(err, args) {
    console.log('Arguments: %s', JSON.stringify(args))
});
```

Example usage:

```
$ node simple.js
> mycommand --arg1 val1 --arg2 val2
Arguments: ["mycommand","--arg1","val1","--arg2","val2"]
```

And multi-line goodness!

```
$ node simple.js
> mycommand \
>   --arg1 val1 \
>   --arg2 val2
Arguments: ["mycommand","--arg1","val1","--arg2","val2"]
```

### Read a single command with history

Provide a history array for the user to toggle through using up/down keys.

```javascript
require('readcommand').read({'history': ['cd', 'ls', 'curl', 'ps -aux | grep node', 'netstat -r']}, function(err, args) {
    console.log('Arguments: %s', JSON.stringify(args))
});
```

### Start a command loop

This example starts an interactive command prompt, where each command is provided to the callback function. After 2 SIGINT invocations by the user, the loop terminates. After each command, it prints the parsed arguments. The command history is maintained within the command loop.

```javascript
var readcommand = require('readcommand');

var sigints = 0;

readcommand.loop(function(err, args, str, next) {
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
```

### Auto-complete

The auto-complete functionality wraps `readline`'s autocomplete functionality, providing an API that works with high-level parsed argument replacement instead of low-level loose string replacement.

The following example provides replacements for either argument keys or argument values depending on context:

```javascript
var _ = require('underscore');
var readcommand = require('readcommand');

var possibleArguments = [
    '--verbose',
    '--log-level'
];

var possibleLogLevels = [
    'trace',
    'debug',
    'info',
    'warn',
    'error'
];

readcommand.loop({'autocomplete': _autocomplete}, function(err, args, str, next) {
    if (err) {
        return;
    }

    console.log('executed: %s', JSON.stringify(args));
    return next();
});

function _autocomplete(args, callback) {
    if (_.isEmpty(args)) {
        return callback(null, possibleArguments);
    }

    var replacements = [];
    var lastArg = _.last(args);
    if (args.length === 1) {
        // If there is only one argument, we just try and auto complete one of the possible flags
        replacements = _.filter(possibleArguments, function(possibleArgument) {
            return (possibleArgument.indexOf(lastArg) === 0);
        });
    } else {
        var secondLastArg = args[args.length - 2];
        if (secondLastArg === '--log-level') {
            // If we are choosing a log level, we offer up potential log levels for the value
            replacements = _.filter(possibleLogLevels, function(possibleLogLevel) {
                return (possibleLogLevel.indexOf(lastArg) === 0);
            });
        } else {
            // We are not giving a flag value, so offer up another flag
            replacements = _.filter(possibleArguments, function(possibleArgument) {
                return (possibleArgument.indexOf(lastArg) === 0);
            });
        }
    }

    return callback(null, replacements);
}
```

## License

Copyright (c) 2014 Branden Visser

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
