
var assert = require('assert');
var readcommand = require('../index');

var CommandAutocomplete = require('../lib/autocomplete');
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

describe('Auto-complete', function() {

    describe('#getAutocompleteArguments', function() {

        it('returns an empty args array with an empty string', function(callback) {
            CommandAutocomplete.getAutocompleteArguments(null, null, function(abort, args) {
                assert.ok(!abort);
                assert.strictEqual(args.length, 0);
                return callback();
            });
        });

        it('aborts when input string ends in an escape sequence', function(callback) {
            CommandAutocomplete.getAutocompleteArguments(null, '\\', function(abort, args) {
                assert.ok(abort);
                return callback();
            });
        });

        it('aborts when input string spans two lines due to escape sequence', function(callback) {
            CommandAutocomplete.getAutocompleteArguments('my args\\\n', 'are', function(abort, args) {
                assert.ok(abort);
                return callback();
            });
        });

        it('aborts when input string spans two lines due to double-quote', function(callback) {
            CommandAutocomplete.getAutocompleteArguments('my "args\n', 'are', function(abort, args) {
                assert.ok(abort);
                return callback();
            });
        });

        it('aborts when input string spans two lines due to single-quote', function(callback) {
            CommandAutocomplete.getAutocompleteArguments('my \'args\n', 'are', function(abort, args) {
                assert.ok(abort);
                return callback();
            });
        });

        it('does not abort when empty argument spans to second line with escape sequence', function(callback) {
            CommandAutocomplete.getAutocompleteArguments('my args \\\n', '', function(abort, args) {
                assert.ok(!abort);
                assert.strictEqual(args.length, 3);
                assert.strictEqual(args[0], 'my');
                assert.strictEqual(args[1], 'args');
                assert.strictEqual(args[2], '');
                return callback();
            });
        });

        it('provides unquoted arguments', function(callback) {
            CommandAutocomplete.getAutocompleteArguments(null, 'my commands are', function(abort, args) {
                assert.ok(!abort);
                assert.strictEqual(args.length, 3);
                assert.strictEqual(args[0], 'my');
                assert.strictEqual(args[1], 'commands');
                assert.strictEqual(args[2], 'are');
                return callback();
            });
        });

        it('provides double-quote arguments that are unclosed at the end', function(callback) {
            CommandAutocomplete.getAutocompleteArguments(null, 'my commands "are so', function(abort, args) {
                assert.ok(!abort);
                assert.strictEqual(args.length, 3);
                assert.strictEqual(args[0], 'my');
                assert.strictEqual(args[1], 'commands');
                assert.strictEqual(args[2], 'are so');
                return callback();
            });
        });

        it('provides single-quote arguments that are unclosed at the end', function(callback) {
            CommandAutocomplete.getAutocompleteArguments(null, 'my commands \'are so', function(abort, args) {
                assert.ok(!abort);
                assert.strictEqual(args.length, 3);
                assert.strictEqual(args[0], 'my');
                assert.strictEqual(args[1], 'commands');
                assert.strictEqual(args[2], 'are so');
                return callback();
            });
        });

        it('provides double-quote arguments that are closed at the end', function(callback) {
            CommandAutocomplete.getAutocompleteArguments(null, 'my commands "are so"', function(abort, args) {
                assert.ok(!abort);
                assert.strictEqual(args.length, 3);
                assert.strictEqual(args[0], 'my');
                assert.strictEqual(args[1], 'commands');
                assert.strictEqual(args[2], 'are so');
                return callback();
            });
        });

        it('provides single-quote arguments that are closed at the end', function(callback) {
            CommandAutocomplete.getAutocompleteArguments(null, 'my commands \'are so\'', function(abort, args) {
                assert.ok(!abort);
                assert.strictEqual(args.length, 3);
                assert.strictEqual(args[0], 'my');
                assert.strictEqual(args[1], 'commands');
                assert.strictEqual(args[2], 'are so');
                return callback();
            });
        });

        it('filters empty arguments except for the last one', function(callback) {
            CommandAutocomplete.getAutocompleteArguments(null, '  my  commands  are  ', function(abort, args) {
                assert.ok(!abort);
                assert.strictEqual(args.length, 4);
                assert.strictEqual(args[0], 'my');
                assert.strictEqual(args[1], 'commands');
                assert.strictEqual(args[2], 'are');
                assert.strictEqual(args[3], '');
                return callback();
            });
        });

        it('does not abort when final argument is fully in buffer due to escape sequence', function(callback) {
            CommandAutocomplete.getAutocompleteArguments('first line wi\\\n', 'th args', function(abort, args) {
                assert.ok(!abort);
                assert.strictEqual(args.length, 4);
                assert.strictEqual(args[0], 'first');
                assert.strictEqual(args[1], 'line');
                assert.strictEqual(args[2], 'with');
                assert.strictEqual(args[3], 'args');
                return callback();
            });
        });

        it('does not abort when final argument is full in buffer due to double-quote', function(callback) {
            CommandAutocomplete.getAutocompleteArguments('first line "wi\n', 'th" args', function(abort, args) {
                assert.ok(!abort);
                assert.strictEqual(args.length, 4);
                assert.strictEqual(args[0], 'first');
                assert.strictEqual(args[1], 'line');
                assert.strictEqual(args[2], 'wi\nth');
                assert.strictEqual(args[3], 'args');
                return callback();
            });
        });

        it('does not abort when final argument is full in buffer due to single-quote', function(callback) {
            CommandAutocomplete.getAutocompleteArguments('first line \'wi\n', 'th\' args', function(abort, args) {
                assert.ok(!abort);
                assert.strictEqual(args.length, 4);
                assert.strictEqual(args[0], 'first');
                assert.strictEqual(args[1], 'line');
                assert.strictEqual(args[2], 'wi\nth');
                assert.strictEqual(args[3], 'args');
                return callback();
            });
        });

        it('does not abort when quoted arguments starts immediately on new line', function(callback) {
            CommandAutocomplete.getAutocompleteArguments('first line \\\n', '"my argument"', function(abort, args) {
                assert.ok(!abort);
                assert.strictEqual(args.length, 3);
                assert.strictEqual(args[0], 'first');
                assert.strictEqual(args[1], 'line');
                assert.strictEqual(args[2], 'my argument');
                return callback();
            });
        });
    });

    describe('#getAutocompleteReplacements', function() {

        it('replaces single line command at very start of line', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements(null, 'my', ['mycommandisbad'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], 'mycommandisbad ');
                assert.strictEqual(toReplace, 'my');
                return callback();
            });
        });

        it('replaces single line command without quotes', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements(null, 'my command is good', ['bad'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], 'bad ');
                assert.strictEqual(toReplace, 'good');
                return callback();
            });
        });

        it('replaces single line command with double-quotes', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements(null, 'my command is "good yes', ['good no'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], '"good no" ');
                assert.strictEqual(toReplace, '"good yes');
                return callback();
            });
        });

        it('replaces single line command with single-quotes', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements(null, 'my command is \'good yes', ['good no'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], '\'good no\' ');
                assert.strictEqual(toReplace, '\'good yes');
                return callback();
            });
        });

        it('replaces escaped multi-line command without quotes', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements('my command i\\\n', 's good', ['bad'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], 'bad ');
                assert.strictEqual(toReplace, 'good');
                return callback();
            });
        });

        it('replaces escaped multi-line commands with double-quotes', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements('my command i\\\n', 's "good yes', ['good no'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], '"good no" ');
                assert.strictEqual(toReplace, '"good yes');
                return callback();
            });
        });

        it('replaces escaped multi-line commands with single-quotes', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements('my command i\\\n', 's \'good yes', ['good no'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], '\'good no\' ');
                assert.strictEqual(toReplace, '\'good yes');
                return callback();
            });
        });

        it('replaces double-quoted multi-line command without quotes', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements('my command "i\n', 's" good', ['bad'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], 'bad ');
                assert.strictEqual(toReplace, 'good');
                return callback();
            });
        });

        it('replaces double-quoted multi-line commands with double-quotes', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements('my command "i\n', 's" "good yes', ['good no'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], '"good no" ');
                assert.strictEqual(toReplace, '"good yes');
                return callback();
            });
        });

        it('replaces double-quoted multi-line commands with single-quotes', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements('my command "i\n', 's" \'good yes', ['good no'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], '\'good no\' ');
                assert.strictEqual(toReplace, '\'good yes');
                return callback();
            });
        });

        it('replaces single-quoted multi-line command without quotes', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements('my command \'i\n', 's\' good', ['bad'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], 'bad ');
                assert.strictEqual(toReplace, 'good');
                return callback();
            });
        });

        it('replaces single-quoted multi-line commands with double-quotes', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements('my command \'i\n', 's\' "good yes', ['good no'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], '"good no" ');
                assert.strictEqual(toReplace, '"good yes');
                return callback();
            });
        });

        it('replaces single-quoted multi-line commands with single-quotes', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements('my command \'i\n', 's\' \'good yes', ['good no'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], '\'good no\' ');
                assert.strictEqual(toReplace, '\'good yes');
                return callback();
            });
        });

        it('replaces multi-line command at very start of line', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements('my command \\\n', 'is', ['isbad'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], 'isbad ');
                assert.strictEqual(toReplace, 'is');
                return callback();
            });
        });

        it('quotes replacements that contain spaces', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements(null, 'my', ['command is bad'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], '"command is bad" ');
                assert.strictEqual(toReplace, 'my');
                return callback();
            });
        });

        it('appends replacements to the command string when command ends with single white-space', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements(null, 'number ', ['123456789'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], '123456789 ');
                assert.strictEqual(toReplace, '');
                return callback();
            });
        });

        it('appends replacements to the command string when command ends with multiple white-space', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements(null, 'number    ', ['123456789'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], '123456789 ');
                assert.strictEqual(toReplace, '');
                return callback();
            });
        });

        it('appends replacements to the command string when command ends with all white-space then a new line', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements('number \\\n', null, ['123456789'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], '123456789 ');
                assert.strictEqual(toReplace, '');
                return callback();
            });
        });

        it('appends replacements to the command string when command ends with all white-space then a new line and more white-space', function(callback) {
            CommandAutocomplete.getAutocompleteReplacements('number \\\n', '  ', ['123456789'], function(replacements, toReplace) {
                assert.strictEqual(replacements.length, 1);
                assert.strictEqual(replacements[0], '123456789 ');
                assert.strictEqual(toReplace, '');
                return callback();
            });
        });
    });
});
