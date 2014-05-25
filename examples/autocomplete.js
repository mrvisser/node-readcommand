
var _ = require('underscore');
var readcommand = require('../index');

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
