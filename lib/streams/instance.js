var async   = require('async');
var stream  = require('stream');
var util    = require('util');
var shared  = require('./shared');

util.inherits(InstanceStream, shared.ModelStream);

function InstanceStream(options) {
    shared.ModelStream.call(this, options);
}

InstanceStream.prototype._transform = function(instanceData, encoding, next) {
    // If we don't have any data, don't make an instance
    if (typeof instanceData !== 'object') {
        return next();
    }
    this._model.getLogger().debug('InstanceStream processing instanceData');
    var instance = this._model.create(instanceData);
    if (this._bucket && !instance.bucket) instance.bucket = this._bucket;
    // Send the instance down the pipe.
    this.push(instance);
    // If we are in callback-mode, store instance for when we call back
    if (this._callback) { this._instances.push(instance); }
    next();
};

module.exports = InstanceStream;
