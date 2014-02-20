var _           = require('underscore');
var vmr         = require('../../');
var request     = require('./request');
var exec        = require('./exec');
var StreamOne   = require('../streams').StreamOne;

function mergeTypes() {
    return _.chain(_.toArray(arguments)).compact().uniq().value().join('_');
}

function RiakQuery(bucket, client) {
    if (!(this instanceof RiakQuery)) {
        return new RiakQuery(bucket, client);
    }
    if (typeof bucket === 'object' && bucket instanceof vmr.VeryModelRiak) {
        this.model = bucket;
        this.bucket = this._model.getBucket();
        this.client = client || this._model.getClient();
    } else {
        this.bucket = bucket;
        this.client = client;
    }
}

RiakQuery.prototype = {
    // This is the base method for all key-based requests: del, get, put
    _key: function (type, key) {
        this.type = type;
        this.key = key;
        return this;
    },
    index: function (index, key, max) {
        this.type = this.type === 'mapreduce' ? mergeTypes(this.type, 'index') : 'index';
        this.index = index;
        if (max) {
            this.range_min = key;
            this.range_max = max;
        } else {
            this.key = key;
        }
        
        return this;
    },
    search: function (index, query) {
        this.type = this.type === 'mapreduce' ? mergeTypes(this.type, 'search') : 'search';
        if (!query) {
            this.index = this.bucket;
            this.key = index;
            return this;
        }
        this.index = index;
        this.key = query;
        return this;
    },
    mapreduce: function (inputs, query) {
        this.type = mergeTypes('mapreduce', this.type);
        if (!query) {
            this.query = inputs;
            return this;
        }
        this.inputs = inputs;
        this.query = query;
        return this;
    },
    setPayload: function (payload) {
        this.payload = payload;
        return this;
    },
    execute: function (payload, cb) {
        if (!cb && typeof payload === 'function') {
            cb = payload;
            payload = null;
        }
        if (cb) this.callback = _.once(cb);
        if (payload) this.payload = payload;
        return this._exec[this.type].call(this);
    },
    _req: request,
    _exec: exec
};
['del', 'get', 'put'].forEach(function (method) {
    this[method] = _.partial(this._key, method);
    this._exec[method] = _.partial(this._exec.key, method);
}, RiakQuery.prototype);

module.exports = RiakQuery;