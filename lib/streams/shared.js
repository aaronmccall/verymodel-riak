var stream  = require('stream');
var util    = require('util');

function ModelStream(options) {
    if (!options || !options.model) {
        throw new Error('ModelStream requires a model.');
    }
    stream.Transform.call(this, {objectMode: true});
    modelize.call(this, options);
}

util.inherits(ModelStream, stream.Transform);

ModelStream.prototype._flush = function (done) {
    if (this._callback) {
        this._callback(null, this._instances);
    }
    done();
};

ModelStream.prototype.continuate   = continuate;
ModelStream.prototype.seen         = seen;

function modelize(options) {
    this._keys = options.keys || {};
    this._model = options.model;
    this._bucket = options.bucket || null;
    if (options.callback) {
        this._callback = options.callback;
        this._instances = [];
    }
}

function continuate(reply) {
    if (reply && reply.continuation) {
        this._model.continuation = reply.continuation;
    } else {
        this._model.continuation = null;
    }
}

function seen(key) {
    return this._keys[key];
}

module.exports = {
    ModelStream : ModelStream,
    continuate  : continuate,
    modelize    : modelize,
    seen        : seen
};