
var readcommand = require('../index');

readcommand.read({'history': ['cd', 'ls', 'curl', 'ps -aux | grep node', 'netstat -r']}, function(err, args, str) {
    console.log('args: %s', JSON.stringify(args));
    console.log('str: %s', JSON.stringify(str));
});
