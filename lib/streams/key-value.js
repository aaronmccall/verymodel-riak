var async   = require('async');
var util    = require('util');
var shared  = require('./shared');

util.inherits(KeyToValueStream, shared.ModelStream);

function KeyToValueStream(options) {
    shared.ModelStream.call(this, options);
}

KeyToValueStream.prototype._transform = function(reply, encoding, next) {
    if (!reply.keys && !reply.continuation) {
        return next();
    }
    var self = this;
    this.continuate(reply);
    async.each(reply.keys||[], function (key, done) {
        // De-dupe logic returns early, if we've already seen this key
        if (self.seen(key)) { return done(); }
        // Record that we've seen this key
        self._keys[key] = 1;
        self._model._getQuery(key, this._bucket, function (err, instance) {
            if (err) { return done(err); }
            var data = self._model.replyToData(instance);
            data.id = key;
            self.push(data);
            if (self._callback) self._instances.push(data);
            done();
        });
    }, function () {
        next();
    });
};

module.exports = KeyToValueStream;
