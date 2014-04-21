
var readcommand = require('../index');

readcommand.read({'history': ['1', '2', '3', '4', '5']}, function(args) {
    console.log('args: %s', JSON.stringify(args));
});