
var _ = require('underscore');
var readcommand = require('../index');

readcommand.loop({'autocomplete': _autocomplete}, function(err, args, str, next) {
    if (err) {
        return;
    }

    console.log('final: %s', JSON.stringify(args));
    return next();
});

function _autocomplete(rl, args, callback) {
    if (_.last(args) === 'options') {
        return callback(null, ['optionsfirst', 'optionssecond', 'optionsthird']);
    } else if (_.last(args) === 'complete') {
        return callback(null, ['completeiswhatidid']);
    }

    return callback();
}
