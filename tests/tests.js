
var assert = require('assert');
var readcommand = require('../index');

var InOut = require('./util/inout');

describe('Read', function() {

    it('returns a simple single-line command', function(callback) {
        var inout = new InOut();
        readcommand.read({'input': inout.input(), 'output': inout.output()}, function(err, args, str) {
            assert.strictEqual(args.length, 3);
            assert.strictEqual(args[0], 'curl');
            assert.strictEqual(args[1], 'https://www.google.ca');
            assert.strictEqual(args[2], '--insecure');
            assert.strictEqual(str, 'curl https://www.google.ca --insecure');
            return callback();
        });
        inout.write('curl https://www.google.ca --insecure\n');
    });

    it('parses double-quotes with single-quotes properly in a single-line command', function(callback) {
        var inout = new InOut();
        readcommand.read({'input': inout.input(), 'output': inout.output()}, function(err, args, str) {
            assert.strictEqual(args.length, 2);
            assert.strictEqual(args[0], 'with \' single quote');
            assert.strictEqual(args[1], 'with " double quote');
            assert.strictEqual(str, '"with \' single quote" \'with " double quote\'');
            return callback();
        });
        inout.write('"with \' single quote" \'with " double quote\'\n');
    });

    it('reads escaped quotes and back-slashes as verbatim input', function(callback) {
        var inout = new InOut();
        readcommand.read({'input': inout.input(), 'output': inout.output()}, function(err, args, str) {
            assert.strictEqual(args.length, 3);
            assert.strictEqual(args[0], '\'');
            assert.strictEqual(args[1], '"');
            assert.strictEqual(args[2], '\\');
            assert.strictEqual(str, '\\\' \\" \\\\');
            return callback();
        });
        inout.write('\\\' \\" \\\\\n');
    });

    it('spans to new line when newline is escaped', function(callback) {
        var inout = new InOut();

        // Receive first prompt
        inout.once('data', function(data) {
            assert.strictEqual(data.toString(), '> ');

            // Write first line and wait for second prompt
            inout.write('firstline \\\n');
            inout.once('data', function(data) {
                assert.strictEqual(data.toString(), '> ');

                // Write second line. This will invoke the readcommand.read callback and we finish
                // the test there
                inout.write('secondline\n');
            });
        });

        readcommand.read({'input': inout.input(), 'output': inout.output()}, function(err, args, str) {
            assert.strictEqual(args.length, 2);
            assert.strictEqual(args[0], 'firstline');
            assert.strictEqual(args[1], 'secondline');
            return callback();
        });
    });

    it('consumes new line when there is an open double-quote', function(callback) {
        var inout = new InOut();

        // Receive first prompt
        inout.once('data', function(data) {
            assert.strictEqual(data.toString(), '> ');

            // Write first line and wait for second prompt
            inout.write('this line is "constrained by\n');
            inout.once('data', function(data) {
                assert.strictEqual(data.toString(), '> ');

                // Write second line, which still doesn't close, wait for third prompt
                inout.write('a double-\'\n');
                inout.once('data', function(data) {
                    assert.strictEqual(data.toString(), '> ');

                    // Finish the last line. Test will finish in the readcommand.read callback
                    inout.write('and now we finish" it\n');
                });
            });
        });

        readcommand.read({'input': inout.input(), 'output': inout.output()}, function(err, args, str) {
            assert.strictEqual(args.length, 5);
            assert.strictEqual(args[0], 'this');
            assert.strictEqual(args[1], 'line');
            assert.strictEqual(args[2], 'is');
            assert.strictEqual(args[3], 'constrained by\na double-\'\nand now we finish');
            assert.strictEqual(args[4], 'it');
            assert.strictEqual(str, 'this line is "constrained by\na double-\'\nand now we finish" it');
            return callback();
        });
    });

    it('consumes new line when there is an open single-quote', function(callback) {
        var inout = new InOut();

        // Receive first prompt
        inout.once('data', function(data) {
            assert.strictEqual(data.toString(), '> ');

            // Write first line and wait for second prompt
            inout.write('this line is \'constrained by\n');
            inout.once('data', function(data) {
                assert.strictEqual(data.toString(), '> ');

                // Write second line, which still doesn't close, wait for third prompt
                inout.write('a single-\\\'\n');
                inout.once('data', function(data) {
                    assert.strictEqual(data.toString(), '> ');

                    // Finish the last line. Test will finish in the readcommand.read callback
                    inout.write('and now we finish\' it\n');
                });
            });
        });

        readcommand.read({'input': inout.input(), 'output': inout.output()}, function(err, args, str) {
            assert.strictEqual(args.length, 5);
            assert.strictEqual(args[0], 'this');
            assert.strictEqual(args[1], 'line');
            assert.strictEqual(args[2], 'is');
            assert.strictEqual(args[3], 'constrained by\na single-\'\nand now we finish');
            assert.strictEqual(args[4], 'it');
            assert.strictEqual(str, 'this line is \'constrained by\na single-\\\'\nand now we finish\' it');
            return callback();
        });
    });

    it('shows custom prompts', function(callback) {
        var inout = new InOut();

        // Receive first prompt
        inout.once('data', function(data) {
            // Ensure the prompt is the custom "ps1" prompt
            assert.strictEqual(data.toString(), 'ps1');

            // Write first line and wait for second prompt
            inout.write('firstline \\\n');
            inout.once('data', function(data) {
                // Ensure the prompt is the custom "ps2" prompt
                assert.strictEqual(data.toString(), 'ps2');

                // Write second line. This will invoke the readcommand.read callback and we finish
                // the test there
                inout.write('secondline\n');
            });
        });

        readcommand.read({'input': inout.input(), 'output': inout.output(), 'ps1': 'ps1', 'ps2': 'ps2'}, function(err, args, str) {
            assert.strictEqual(args.length, 2);
            assert.strictEqual(args[0], 'firstline');
            assert.strictEqual(args[1], 'secondline');
            return callback();
        });
    });
});

describe('Loop', function() {

    it('reads a series of commands from the input', function(callback) {
        var inout = new InOut();

        var one = false;
        var two = false;
        var three = false;

        // Kick off the first prompt
        inout.once('data', function(data) {
            assert.strictEqual(data.toString(), '> ');
            inout.write('one\n');
        });

        readcommand.loop({'input': inout.input(), 'output': inout.output()}, function(err, args, str, next) {
            // Receive the "one" command
            if (args[0] === 'one') {
                one = true;
                assert.strictEqual(two, false);
                assert.strictEqual(three, false);
                next();

                inout.once('data', function(data) {
                    assert.strictEqual(data.toString(), '> ');
                    inout.write('two\n');
                });
            } else if (args[0] === 'two') {
                two = true;
                assert.strictEqual(one, true);
                assert.strictEqual(three, false);
                next();

                inout.once('data', function(data) {
                    assert.strictEqual(data.toString(), '> ');
                    inout.write('three\n');
                });
            } else if (args[0] === 'three') {
                three = true;
                assert.strictEqual(one, true);
                assert.strictEqual(two, true);
                return callback();
            } else {
                assert.fail();
            }
        });
    });

});
