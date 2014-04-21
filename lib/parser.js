
var _ = require('underscore');

/**
 * Parses an input string as a shell command. Outputs an object that indicates the current state of
 * the command string:
 *
 *  result.closed   : Boolean that determines if the command has been finished (e.g., no opening
 *                    quotes, didn't end with a back-slash). If doing multi-line parsing, this flag
 *                    indicates if you should proceed to a new line and continue taking input
 *
 *  result.str      : A sanitized command string. If doing multi-line parsing, you can use this as
 *                    the current command-in-progress. Takes care of concerns such as end-of-line
 *                    back-slash, which should not result in a new-line in the final command string
 *
 *  result.args     : Only set if result.closed is true. The final parsed arguments of the command
 */
var parse = module.exports.parse = function(str) {
    var state = {
        'CURR_ARG': '',
        'SINGLE_QUOTE': false,
        'DOUBLE_QUOTE': false,
        'ESCAPE_NEXT': false
    };

    var args = [];
    _.each(str, function(c) {
        if (state.ESCAPE_NEXT) {
            // If we are currently escaping the next character (previous
            // character was a \), then we put this character in verbatim
            // and reset the escape status
            state.CURR_ARG += c;
            state.ESCAPE_NEXT = false;
        } else if (c === '\\') {
            // We are not escaping this character and we have received the
            // backslash, signal an escape for the next character
            state.ESCAPE_NEXT = true;
        } else if (state.DOUBLE_QUOTE) {
            if (c === '"') {
                // We are currently double-quoted and we've hit a double-quote,
                // simply unflag double-quotes
                state.DOUBLE_QUOTE = false;
            } else {
                // We are currently double-quoting, take this character in
                // verbatim
                state.CURR_ARG += c;
            }
        } else if (state.SINGLE_QUOTE) {
            if (c === '\'') {
                // We are currently single-quoted and we've hit a single-quote,
                // simply unflag single-quotes
                state.SINGLE_QUOTE = false;
            } else {
                // We are currently single-quoting, take this character in
                // verbatim
                state.CURR_ARG += c;
            }
        } else if (c === ' ' || c === '\n') {
            // Any space or new-line character will terminate the argument so
            // long as it isn't escaped or in quotes
            args.push(state.CURR_ARG);
            state.CURR_ARG = '';
        } else if (c === '"') {
            // Start the double-quote flag
            state.DOUBLE_QUOTE = true;
        } else if (c === '\'') {
            // Start the single-quote flag
            state.SINGLE_QUOTE = true;
        } else {
            // Regular character under regular conditions, simply add it to the
            // current argument
            state.CURR_ARG += c;
        }
    });

    if (state.ESCAPE_NEXT) {
        // If it ended with an escape character, we exclude it since it is
        // escaping the new line in such a way that we don't retain the new
        // line in the input and we also don't escape the first character of
        // the next line
        return {'str': str.slice(0, -1), 'closed': false};
    } else if (state.DOUBLE_QUOTE || state.SINGLE_QUOTE) {
        // When we finished while quoting, we retain the new line at the end
        // of the current segment of the input string. So append it and continue
        // on
        return {'str': str + '\n', 'closed': false};
    } else {
        // We are finishing without any lingering state, so we can close off the
        // command
        args.push(state.CURR_ARG);
        return {'str': str, 'args': _.compact(args), 'closed': true};
    }
};