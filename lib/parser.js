
var _ = require('underscore');

/*!
 * Indicates that the parser was left open due to a lingering escape
 */
var OPEN_ESCAPE = module.exports.OPEN_ESCAPE = 'escape';

/*!
 * Indicates that the parser was left open due to a lingering quote
 */
var OPEN_QUOTE = module.exports.OPEN_QUOTE = 'quote';

/**
 * Parses an input string as a shell command. Outputs an object that indicates the current state of
 * the command string:
 *
 *  result.open     : String that determines how, if at all the command has been left open for more
 *                    input (e.g., unbalanced quotes, ended with a back-slash). If doing multi-line
 *                    parsing, this flag indicates if you should proceed to a new line and continue
 *                    taking input. The possible values are `parser.OPEN_ESCAPE` and
 *                    `parser.OPEN_QUOTE`. If this is `false`y, then the command is complete
 *
 *  result.str      : A sanitized command string. If doing multi-line parsing, you can use this as
 *                    the current command-in-progress. Takes care of concerns such as end-of-line
 *                    back-slash, which should not result in a new-line in the final command string
 *
 *  result.args     : Represents either the parsed command-in-progress if `result.open` is not
 *                    `false`y, or the full command. In situations where there were open quotes or
 *                    a final backslash, the command is simply force-closed in this arguments array
 */
var parse = module.exports.parse = function(str) {
    var state = {
        'CURR_ARG': {'str': ''},
        'SINGLE_QUOTE': false,
        'DOUBLE_QUOTE': false,
        'ESCAPE_NEXT': false
    };

    var args = [];
    _.each(str, function(c, i) {
        if (state.ESCAPE_NEXT) {
            // If we are currently escaping the next character (previous character was a \), then we
            // put this character in verbatim (except for new line) and reset the escape status. If
            // the character is a new-line, we simply scrub it from the argument, it's a special
            // case
            if (c !== '\n') {
                state.CURR_ARG.str += c;
            }

            state.ESCAPE_NEXT = false;
        } else if (c === '\\') {
            // We are not escaping this character and we have received the backslash, signal an
            // escape for the next character
            state.ESCAPE_NEXT = true;
        } else if (state.DOUBLE_QUOTE) {
            if (c === '"') {
                // We are currently double-quoted and we've hit a double-quote, simply unflag
                // double-quotes
                state.DOUBLE_QUOTE = false;
            } else {
                // We are currently double-quoting, take this character in verbatim
                state.CURR_ARG.str += c;
            }
        } else if (state.SINGLE_QUOTE) {
            if (c === '\'') {
                // We are currently single-quoted and we've hit a single-quote, simply unflag
                // single-quotes
                state.SINGLE_QUOTE = false;
            } else {
                // We are currently single-quoting, take this character in verbatim
                state.CURR_ARG.str += c;
            }
        } else if (c === ' ' || c === '\n') {
            // Any space or new-line character will terminate the argument so long as it isn't
            // escaped or in quotes
            args.push(state.CURR_ARG);
            state.CURR_ARG = {'str': ''};
        } else if (c === '"') {
            // This argument is starting new. Record where and how it began
            if (!_.isNumber(state.CURR_ARG.i)) {
                state.CURR_ARG.i = i;
                state.CURR_ARG.quoted = '"';
            }

            // Start the double-quote flag
            state.DOUBLE_QUOTE = true;
        } else if (c === '\'') {
            // This argument is starting new. Record where it began
            if (!_.isNumber(state.CURR_ARG.i)) {
                state.CURR_ARG.i = i;
                state.CURR_ARG.quoted = '\'';
            }

            // Start the single-quote flag
            state.SINGLE_QUOTE = true;
        } else {
            // This argument is starting new. Record where it began
            if (!_.isNumber(state.CURR_ARG.i)) {
                state.CURR_ARG.i = i;
            }

            // Regular character under regular conditions, simply add it to the current argument
            state.CURR_ARG.str += c;
        }
    });

    // Push the final argument onto the arguments array
    args.push(state.CURR_ARG);

    if (state.ESCAPE_NEXT) {
        // If we finished with an escape, we indicate that we did so which helps in determining how
        // to handle the new line if any
        return {
            'args': args,
            'open': OPEN_ESCAPE,
            'str': str
        };
    } else if (state.DOUBLE_QUOTE || state.SINGLE_QUOTE) {
        // When we finished while quoting, we have not finished the command, so we return the
        // input string as-is so far with the arguments we've parsed
        return {
            'args': args,
            'open': OPEN_QUOTE,
            'str': str
        };
    } else {
        // We are finishing without any lingering state, so we can close off the command
        return {
            'args': args,
            'str': str
        };
    }
};
