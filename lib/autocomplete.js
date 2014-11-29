
var _ = require('underscore');
var util = require('util');

var CommandParser = require('./parser');

/**
 * Get the arguments to send to an autocomplete handler implemented by a readcommand consumer. This
 * function will also determine if auto-complete should be handled at all.
 *
 * @param  {String}     currentCommand      The current command string, not including what is in the
 *                                          current line buffer
 * @param  {String}     currentLine         The contents of the current line buffer
 * @param  {Function}   callback            Invoked when complete
 * @param  {Boolean}    callback.abort      Whether or not auto-complete should be passed to the
 *                                          caller. `true`thy indicates it should not, `false`y
 *                                          indicates it should not
 * @param  {String[]}   callback.args       The arguments array to send to the caller. This will not
 *                                          be specified if `callback.abort` is `true`thy
 */
module.exports.getAutocompleteArguments = function(currentCommand, currentLine, callback) {
    currentCommand = currentCommand || '';
    currentLine = currentLine || '';

    /*!
     * Parse the full command to see if we are in a state where we can reasonably do an auto-
     * complete
     */
    var fullCommandStr = currentCommand + currentLine;
    var fullCommandParsed = _parseForAutocomplete(fullCommandStr);

    // The last argument of the current command string is the only thing that can be auto-completed
    var lastArg = _.last(fullCommandParsed.args);

    if (fullCommandParsed.open === CommandParser.OPEN_ESCAPE) {
        // We can't complete on an escape sequence, it doesn't really make sense I don't think
        return callback(true);
    } else if (fullCommandStr.slice(lastArg.i).indexOf('\n') !== -1) {
        // We can't complete if the last argument spans a new line. This would imply we need to do a
        // replacement on data that has already been accepted which is not possible
        return callback(true);
    }

    // Hand just the string arguments (not parsed metadata) to the autocomplete caller
    return callback(false, _.pluck(_filterAutocompleteArguments(fullCommandParsed.args), 'str'));
};

/**
 * Get the replacement values and replacement substring given the array of potential replacements
 * provided by the autocomplete implementation.
 *
 * @param  {String}     currentCommand          The current command string, not including what is in
 *                                              the current line buffer
 * @param  {String}     currentLine             The contents of the current line buffer
 * @param  {Function}   callback                Invoked when complete
 * @param  {String[]}   callback.replacements   The potential replacements
 * @param  {String}     callback.toReplace      The replacement substring of the `currentLine` of
 *                                              user input
 */
module.exports.getAutocompleteReplacements = function(currentCommand, currentLine, replacementsArray, callback) {
    if (_.isEmpty(replacementsArray)) {
        return callback([], currentLine);
    }

    currentCommand = currentCommand || '';
    currentLine = currentLine || '';

    var fullCommandStr = currentCommand + currentLine;
    var fullCommandParsed = _parseForAutocomplete(fullCommandStr);

    // The last argument of the current command string is the only thing that can be auto-completed
    var lastArg = _.last(fullCommandParsed.args);

    // The replacement string is always from where the last argument began on the current line until
    // the end
    var distanceIndex = _getDistanceFromLastNewline(fullCommandStr, lastArg.i);
    var toReplaceStr = currentLine.slice(distanceIndex);

    replacementsArray = _.map(replacementsArray, function(replacement) {
        if (lastArg.quoted || replacement.indexOf(' ') !== -1 || replacement.indexOf('\n') !== -1) {
            var quote = lastArg.quoted || '"';

            // If the last argument was quoted, reconstruct the quotes around the potential
            // replacements
            replacement = util.format('%s%s%s', quote, replacement, quote);
        }

        // Add a space to the end of all replacements
        return util.format('%s ', replacement);
    });

    return callback(replacementsArray, toReplaceStr);
};

/*!
 * Parse the given command string, handling the scenario where there is an unstarted command at the
 * end and assigning it an index. This is a requirement specific for auto-complete, so it is not
 * done by the parser itself.
 */
function _parseForAutocomplete(fullCommandStr) {
    var fullCommandParsed = CommandParser.parse(fullCommandStr);
    var lastArg = _.last(fullCommandParsed.args);

    // If the last argument does not have an index, it means it's a cliff hanger (e.g., a space at
    // the end of the command string). Therefore, we'll assign it an index at the end of the input
    // string
    if (!_.isNumber(lastArg.i)) {
        lastArg.i = fullCommandStr.length;
    }

    return fullCommandParsed;
}

/*!
 * Clear empty arguments out of the arguments array except for the last one.
 *
 * When giving the args array to the caller, we need to indicate if the cursor position is beginning
 * a new argument, or if it is in progress on a current argument. The parser will strip that
 * information in its sanitized `str` representation of the arguments. For example:
 *
 *  `"--log-level"` will look example the same as `"--log-level "` (trailing space)
 *
 * ... but for doing auto-complete on either argument keys or argument values, it is an important
 * distinction to make. So if the state is the latter, we maintain the empty string at the end of
 * the args array.
 */
function _filterAutocompleteArguments(args) {
    args = _.filter(args, function(arg, i) {
        return (i === (args.length - 1) || arg.quote || arg.str !== '');
    });

    // If there is only one argument and its unintentially empty, don't bother including it
    if (args.length === 1 && !args[0].quote && args[0].str === '') {
        return [];
    } else {
        return args;
    }
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
