var async   = require('async');
var stream  = require('stream');
var util    = require('util');
var shared  = require('./shared');

util.inherits(KeyToValueStream, stream.Transform);

function KeyToValueStream(options) {
    if (!options || !options.model) throw new Error('KeyToValueStream requires a model.');
    stream.Transform.call(this, {objectMode: true});
    shared.modelize.call(this, options);
}

KeyToValueStream.prototype._transform = function(reply, encoding, next) {
    if (!reply.keys && !reply.continuation) return next();
    var self = this;
    this.continuate(reply);
    async.each(reply.keys||[], function (key, done) {
        // De-dupe logic returns early, if we've already seen this key
        if (self.seen(key)) return done();
        // Record that we've seen this key
        self._keys[key] = 1;
        self._model._getQuery(key, function (err, instance) {
            var data = self._model.replyToData(instance);
            data.id = key;
            self.push(data);
            if (self._callback) self._instances.push(data);
            done();
        });
    }, function (err) {
        next();
    });
};

KeyToValueStream.prototype._flush = function (done) {
    if (this._callback) this._callback(null, this._instances);
    done();
};

KeyToValueStream.prototype.continuate   = shared.continuate;
KeyToValueStream.prototype.seen         = shared.seen;

module.exports = KeyToValueStream;
