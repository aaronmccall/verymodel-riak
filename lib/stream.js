var async   = require('async');
var stream  = require('stream');
var util    = require('util');
util.inherits(AllStream, stream.Transform);

function AllStream(options) {
    if (!options || !options.model) throw new Error('AllStream requires a model.');
    stream.Transform.call(this, {objectMode: true});
    this._keys = {};
    this._model = options.model;
    if (options.callback) {
        this._callback = options.callback;
        this._instances = [];
    }
}

AllStream.prototype._transform = function(reply, encoding, next) {
    var self = this;
    // loading = true;
    if (reply && reply.continuation) {
        this._model.continuation = reply.continuation;
    }
    async.each(reply.keys, function (key, done) {
        if (self._keys[key]) return done();
        self._keys[key] = 1;
        self._model.load(key, function (err, instance) {
            self.push(instance);
            if (self._callback) self._instances.push(instance);
            done();
        });
    }, function (err) { next(); });
};

AllStream.prototype._flush = function (done) {
    if (this._callback) this._callback(null, this._instances);
    done();
};

module.exports = {
    AllStream: AllStream
};