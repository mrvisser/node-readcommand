
var _ = require('underscore');
var readline = require('readline');
var util = require('util');

var CommandHistory = require('./lib/history');
var CommandParser = require('./lib/parser');

/**
 * Start a command prompt loop.
 *
 * @param  {Object}     [options]
 * @param  {Stream}     [options.input=process.stdin]   The input stream to read a command from
 * @param  {Stream}     [options.output=process.stdout] The output stream to display results to
 * @param  {Function}   [options.ps1="> "]              A function to retrieve the ps1 prompt on
 *                                                      each command iteration
 * @param  {Function}   [options.ps2="> "]              A function to retrieve the ps2 prompt on
 *                                                      each command iteration
 * @param  {Function}   [options.autocomplete]          The autocomplete function to use
 * @param  {Readline}   [options.autocomplete.rl]       The readline instance
 * @param  {String[]}   [options.autocomplete.args]     The args that are being autocompleted,
 *                                                      similar to `readline` docs for `completer`
 * @param  {Function}   [options.autocomplete.callback] Invoke with autocomplete results, as per
 *                                                      `readline` docs for `completer`
 * @param  {Function}   onCommand                       Invoked each time the user has input a
 *                                                      command
 * @param  {Error}      onCommand.err                   An error occurred receiving the command, if
 *                                                      any
 * @param  {String}     onCommand.err.code              The type of error. Known codes: "SIGINT" The
 *                                                      user pressed CTRL+C
 * @param  {String[]}   onCommand.args                  The parsed command arguments from the user
 * @param  {String}     onCommand.str                   The raw input string from the user
 * @param  {Function}   onCommand.next                  Invoke this function to get the next
 *                                                      command. If you want to exit the loop,
 *                                                      simply don't invoke this, everything is
 *                                                      already cleaned up
 */
var loop = module.exports.loop = function(options, onCommand) {
    options = options || {};
    options.input = options.input || process.stdin;
    options.output = options.output || process.stdout;
    options.ps1 = _psToFunction(options.ps1);
    options.ps2 = _psToFunction(options.ps2);

    return _loop(options, onCommand);
};

/**
 * Read a single multi-line command from the user.
 *
 * @param  {Object}     [options]                       Optional read arguments
 * @param  {Stream}     [options.input=process.stdin]   The input stream to read a command from
 * @param  {Stream}     [options.output=process.stdout] The output stream to display results to
 * @param  {String}     [options.ps1="> "]              The PS1 prompt label for the first line of
 *                                                      the command
 * @param  {String}     [options.ps2="> "]              The PS2 prompt label for subsequent lines of
 *                                                      the command
 * @param  {String[]}   [options.history=[]]            The command history to use for toggling
 *                                                      command output with up and down
 * @param  {Function}   [options.autocomplete]          The autocomplete function to use
 * @param  {Readline}   [options.autocomplete.rl]       The readline instance
 * @param  {String[]}   [options.autocomplete.args]     The args that are being autocompleted,
 *                                                      similar to `readline` docs for `completer`
 * @param  {Function}   [options.autocomplete.callback] Invoke with autocomplete results, as per
 *                                                      `readline` docs for `completer`
 * @param  {Function}   callback                        Invoked when a command has been read by the
 *                                                      user
 * @param  {Error}      callback.err                    An error that occurred, if any
 * @param  {String}     callback.err.code               The type of error. Known codes: "SIGINT" The
 *                                                      user pressed CTRL+C
 * @param  {String[]}   callback.args                   The parsed command arguments
 * @param  {String}     callback.str                    The raw input string from the user
 */
var read = module.exports.read = function(options, callback) {
    options = options || {};
    options.input = options.input || process.stdin;
    options.output = options.output || process.stdout;
    options.ps1 = options.ps1 || '> ';
    options.ps2 = options.ps2 || '> ';
    options.history = options.history || [];
    callback = callback || function() {};

    var state = {
        'input': options.input,
        'output': options.output,
        'rl': null,
        'ps1': options.ps1,
        'ps2': options.ps2,
        'history': new CommandHistory(options.history),
        'autocomplete': options.autocomplete,
        'callback': callback,

        'currentCommand': '',
        'currentLine': '',
        'onFirstLine': true
    };

    // Create the readline instance and set it up for cool things!
    _resetReadLine(state);

    // This isn't done in _resetReadLineAndRead because it binds to the input, not the readline
    // instance
    _bindKeypress(state);

    return _read(state);
};

/*!
 * Do the heavy lifting of looping, asking for commands and managing the command history.
 */
function _loop(options, onCommand, _history) {
    _history = _history || [];

    var readOptions = _.extend({}, options, {
        'ps1': options.ps1(),
        'ps2': options.ps2(),
        'history': _history
    });

    read(readOptions, function(err, args, str) {
        // If the user entered an actual command, put the string in the command history
        if (str) {
            _history.push(str.split('\n').shift());
        }

        // Provide the args to the caller
        onCommand(err, args, str, function() {
            // Recursively ask for the next command
            return _loop(options, onCommand, _history);
        });
    });
}

/*!
 * Perform the heavy lifting for reading the first and subsequent
 * command lines
 */
function _read(state) {
    var ps = (state.onFirstLine) ? state.ps1 : state.ps2;
    state.rl.question(ps, function(str) {
        // Append this input to the current full command string that we'll try and parse
        var commandToParse = state.currentCommand + str;

        // Parse the current full command
        var result = CommandParser.parse(commandToParse);
        if (!result.open) {
            // The multi-line command is completed. Send the result to the caller
            return _sendResult(state, null, result.args, result.str);
        }

        // We didn't close out the command. We should use the processed string that the command
        // parser wants us to continue with, so append that to the parser with the new-line the
        // user input, as that will now be a part of the command string
        state.currentCommand = result.str + '\n';

        // Read a second line of input
        state.onFirstLine = false;
        return _read(state);
    });

    // If we started with a line, clear it so subsequent reads don't start with this. `currentLine`
    // is necessary for up-down history replacement
    if (state.currentLine) {
        state.rl.write(state.currentLine);
        state.currentLine = '';
    }
}

/*!
 * Reset the state of the readline instance to get a new prompt
 */
function _resetReadLine(state) {
    if (state.rl) {
        state.rl.close();
    }

    state.rl = readline.createInterface({
        'input': state.input,
        'output': state.output,
        'completer': function(line, callback) {
            if (!_.isFunction(state.autocomplete)) {
                // No autocomplete was provided, do nothing
                return callback(null, [[], line]);
            }

            var doAutocomplete = false;

            /*!
             * Parse the full command to see if we are in a state where we can reasonably do an
             * auto-complete
             */
            var fullCommandStr = state.currentCommand + line;
            var fullCommandParsed = CommandParser.parse(fullCommandStr);

            // The last argument of the current command string is the only thing that can be
            // auto-completed
            var lastArg = _.last(fullCommandParsed.args);

            // If the last argument does not have an index, it means it's a cliff hanger (e.g., a
            // space at the end of the command string). Therefore, we'll assign it an index at the
            // end of the input string
            if (!_.isNumber(lastArg.i)) {
                lastArg.i = fullCommandStr.length - 1;
            }

            if (fullCommandParsed.open === CommandParser.OPEN_ESCAPE) {
                // We can't complete on an escape sequence, it doesn't really make sense I don't
                // think
                return callback(null, [[], line]);
            } else if (fullCommandStr.slice(lastArg.i).indexOf('\n') !== -1) {
                // We can't complete if the last argument spans a new line. This would imply we need
                // to do a replacement on data that has already been accepted which is not possible
                return callback(null, [[], line]);
            }

            // Hand just the string arguments (not parsed metadata) to the autocomplete caller
            var simpleArgs = _.pluck(_getAutocompleteArguments(fullCommandParsed.args), 'str');
            state.autocomplete(state.rl, simpleArgs, function(err, replacementsArray) {
                if (err) {
                    return callback(err);
                } else if (_.isEmpty(replacementsArray)) {
                    // No suggestions, just return empty
                    return callback(null, [[], line]);
                }

                // The replacement string is always from where the last argument began on the
                // current line until the end
                var distanceIndex = _getDistanceFromLastNewline(fullCommandStr, lastArg.i);
                var toReplaceStr = line.slice(distanceIndex);
                console.log('');
                console.log('full command: %s', JSON.stringify(fullCommandStr));
                console.log('       index: %s', distanceIndex);
                console.log('toReplaceStr: "%s"', toReplaceStr);

                replacementsArray = _.map(replacementsArray, function(replacement) {
                    if (lastArg.quoted) {
                        // If the last argument was quoted, reconstruct the quotes around the potential
                        // replacements
                        return util.format('%s%s%s', lastArg.quoted, replacement, lastArg.quoted);
                    }

                    return replacement;
                });

                return callback(null, [replacementsArray, toReplaceStr]);
            });
        }
    });

    /*!
     * Monkey-patch the setPrompt method to properly calculate the string length when colors are
     * used. :(
     *
     * http://stackoverflow.com/questions/12075396/adding-colors-to-terminal-prompt-results-in-large-white-space
     */
    var rl = state.rl;
    rl._setPrompt = rl.setPrompt;
    rl.setPrompt = function(prompt, length) {
        var strippedLength = null;
        if (length) {
            strippedLength = length;
        } else {
            var stripped = prompt.split(/[\r\n]/).pop().stripColors;
            if (stripped) {
                strippedLength = stripped.length;
            }
        }

        rl._setPrompt(prompt, strippedLength);
    };

    _bindSigint(state);
}

/*!
 * Bind the SIGINT handling to the readline instance, which effectively returns with an empty
 * command.
 */
function _bindSigint(state) {
    state.rl.once('SIGINT', function() {
        // Mock a new-line and send an empty result
        state.output.write('\n');
        return _sendResult(state, _.extend(new Error('User pressed CTRL+C'), {'code': 'SIGINT'}));
    });
}

/*!
 * Bind the keypress handling to the input stream to handle navigating command history
 */
function _bindKeypress(state) {
    state.onKeypress = function(ch, key) {
        if (!key || !state.onFirstLine) {
            // Ignore the up/down history searcing when we've extended to a new line
            return;
        }

        var replace = null;
        if (_keyIs(key, 'up')) {
            replace = state.history.prev();
        } else if (_keyIs(key, 'down')) {
            replace = state.history.next();
        }

        if (_.isString(replace)) {
            // This will close the current prompt, so we can safely get a new one by re-invoking
            // `_read`
            _resetReadLine(state);
            state.currentLine = replace;
            return _read(state);
        }
    };

    state.input.on('keypress', state.onKeypress);
}

/*!
 * Unbind the keypress handler from the input stream
 */
function _unbindKeypress(state) {
    state.input.removeListener('keypress', state.onKeypress);
}

/*!
 * Send the arguments result to the caller and clean up after ourselves
 */
function _sendResult(state, err, args, str) {
    _unbindKeypress(state);
    state.rl.close();

    // At this point, we should be able to parse a closed command. If not, something is not right
    return state.callback(err, _.pluck(_getFinalArguments(args), 'str'), str);
}

/*!
 * When giving the args array to the caller, we need to indicate if the cursor position is beginning
 * a new argument, or if it is in progress on a current argument. The parser will strip that
 * information in its sanitized `str` representation of the arguments. For example:
 *
 *  `"--log-level"` will look example the same as `"--log-level "` (trailing space)
 *
 * ... but for doing auto-complete on either argument keys or argument values, it is an important
 * distinction to make. So if the state is the latter, we maintain the empty string at the end of
 * the args array. Other than that, this is the same as `_getFinalArguments`
 */
function _getAutocompleteArguments(args) {
    // The logic is the same as `_getFinalArguments`, however if the last argument is stripped, we
    // ensure we still keep it
    return _.filter(args, function(arg, i) {
        return (i === (args.length - 1) || arg.quote || arg.str !== '');
    });
}

/*!
 * Clean vestigial arguments out of the arguments array so that it may be sent to the caller
 * as a completed command
 */
function _getFinalArguments(args) {
    return _.filter(args, function(arg) {
        // We filter out empty arguments, but only if they weren't explicitly specified with
        // quotes. E.g., "--verbose ''" will retain the empty string, while "--verbose " will have
        // it stripped
        return (arg.quote || arg.str !== '');
    });
}

/*!
 * Given a string that might contain new-lines, the number of characters `i` is away from the last
 * new-line in the string. If the string does not contain a new-line, the result is just `i`
 */
function _getDistanceFromLastNewline(str, i) {
    var distance = i;
    var lastNewlineIndex = str.lastIndexOf('\n');
    if (lastNewlineIndex !== -1) {
        distance = (i - lastNewlineIndex - 1);
    }

    return distance;
}

/*!
 * Convenience function to convert a potential string or undefined ps string to a function that
 * returns the same string.
 */
function _psToFunction(ps) {
    var result = null;
    if (_.isString(ps)) {
        result = function() {
            return ps;
        };
    } else if (_.isFunction(ps)) {
        result = ps;
    } else {
        result = function() {
            return '> ';
        };
    }

    return result;
}

/*!
 * Convenience method to determine if the provided keypress key is a verbatim key. Returns false if
 * it's not the specified key name or it has been executed with shift, ctrl or a meta key
 */
function _keyIs(key, name) {
    return (key.name === name && !key.ctrl && !key.shift && !key.meta);
}
