var async   = require('async');
var stream  = require('stream');
var util    = require('util');
var shared  = require('./shared');

util.inherits(InstanceStream, stream.Transform);

function InstanceStream(options) {
    if (!options || !options.model) throw new Error('InstanceStream requires a model.');
    stream.Transform.call(this, {objectMode: true});
    shared.modelize.call(this, options);
}

InstanceStream.prototype._transform = function(instanceData, encoding, next) {
    if (typeof instanceData !== 'object') return next();
    var instance = this._model.create(instanceData);
    this.push(instance);
    if (this._callback) this._instances.push(instance);
    next();
};

InstanceStream.prototype._flush = function (done) {
    if (this._callback) {
        this._callback(null, this._instances);
    }
    done();
};

module.exports = InstanceStream;
