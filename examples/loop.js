
var readcommand = require('../index');

var sigints = 0;

readcommand.loop(null, function(err, args, str, next) {
    if (err && err.code !== 'SIGINT') {
        throw err;
    } else if (err) {
        if (sigints === 1) {
            process.exit(0);
        } else {
            sigints++;
            console.log('Press ^C again to exit.');
            return next();
        }
    } else {
        sigints = 0;
    }

    console.log('Received args: %s', JSON.stringify(args));
    return next();
});
