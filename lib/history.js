
var CommandHistory = module.exports = function(history) {
    this._history = history || [];
    this._index = -1;
};

CommandHistory.prototype.prev = function() {
    if (this._index === this._history.length - 1) {
        return null;
    }

    this._index++;
    return this._history[this._history.length - this._index - 1];
};

CommandHistory.prototype.next = function() {
    if (this._index === 0) {
        this._index--;
        return '';
    } else if (this._index === -1) {
        return null;
    }

    this._index--;
    return this._history[this._history.length - this._index - 1];
};
