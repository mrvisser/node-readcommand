
require('../index').read(function(err, args) {
    console.log('Arguments: %s', JSON.stringify(args))
});
