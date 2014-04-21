
var events = require('events');
var stream = require('stream');
var util = require('util');

var InOut = module.exports = function() {
    var self = this;

    self._input = new stream.PassThrough();
    self._output = new stream.PassThrough();

    // Pipe output to the consumer
    self._output.on('data', function(data) {
        self.emit('data', data);
    });
};
util.inherits(InOut, events.EventEmitter);

InOut.prototype.input = function() {
    return this._input;
};

InOut.prototype.output = function() {
    return this._output;
};

InOut.prototype.write = function(data) {
    this._input.write(data);
};
