
var readcommand = require('../index');

readcommand.read({'history': ['1', '2', '3', '4', '5']}, function(err, args, str) {
    console.log('args: %s', JSON.stringify(args));
    console.log('str: %s', JSON.stringify(str));
});