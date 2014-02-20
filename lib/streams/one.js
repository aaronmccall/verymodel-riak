var stream  = require('stream');
var util    = require('util');

function StreamOne() {
    stream.Readable.call(this, {objectMode: true});
}
util.inherits(StreamOne, stream.Readable);

StreamOne.prototype._read = function () {};

Object.defineProperty(StreamOne.prototype, 'cb', {
    get: function () {
        return function (err, reply) {
            if (this._readableState.ended) return;
            if (err) {
                this.push(null);
                this.emit('error', err);
                return;
            }
            if (reply) {
                this.push(reply);
            }
            this.push(null);
        }.bind(this);
    }
});

module.exports = StreamOne;