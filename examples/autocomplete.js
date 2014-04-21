
var readcommand = require('../index');

readcommand.read({'autocomplete': _autocomplete}, function(err, args, str) {
    console.log('args: %s', JSON.stringify(args));
    console.log('str: %s', JSON.stringify(str));
});

function _autocomplete(rl, line, callback) {
    if ('good work!'.indexOf(line) === 0) {
        return callback(null, [['good work!'], line]);
    } else {
        console.log('autocompleting: %s (type "goo" then TAB to get an autocomplete)', line);
        return callback();
    }
}
