var _           = require('underscore');
var vmr         = require('../');
var helpers     = require('./request_helpers');
var StreamOne   = require('./streams').StreamOne;

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
    key: function (type, key) {
        this.type = type;
        this.key = key;
        return this;
    },
    find: function (index, key, max) {
        this.type = mergeTypes(this.type, 'index');
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
        this.type = mergeTypes(this.type, 'search');
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
    execute: function (payload, cb) {
        if (!cb && typeof payload === 'function') {
            cb = payload;
            payload = null;
        }
        if (cb) this.callback = _.once(cb);
        if (payload) this.payload = payload;
        return this._exec[this.type].call(this);
    },
    _req: {
        _defaults: function (self, keys) {
            var pickKeys = ['bucket', 'key'];
            if (Array.isArray(keys)) pickKeys = pickKeys.concat(keys);
            if (typeof keys === 'string') pickKeys.push(keys);
            return _(self).chain()
                   .pick(pickKeys)
                   .defaults({
                        return_body: true,
                        content_type: 'application/json'
                    });
        },

        key: function (type) {
            var request = this._req._defaults(this);
            if (type=='put') {
                request.extend(this._req._prepContent(this.payload));
            }
            return request.value();
        },
        index_exact: function () {
            var payload = this._req._defaults(this, 'index').value();
            payload.qtype = 0;
            return payload;
        },
        index_range: function () {
            var keys = ['index', 'range_min', 'range_max'],
                payload = this._req._defaults(this, keys).omit('key').value();
            payload.qtype = 1;
            return payload;
        },
        mapreduce: function () {
            return {
                request: JSON.stringify({inputs: this.inputs, query: this.query}),
                content_type: 'application/json'
            };
        },
        search: function () {
            var payload = this._req.index_exact.call(this);
            payload.q = payload.key;
            return _.omit(payload, 'key', 'qtype', 'bucket');
        },
        _prepContent: function (payload) {
            if (!payload) throw new Error('RiakQuery#put requires a payload to be specified.');
            var content = _.pick(payload, 'value', 'indexes');
            if (typeof content.value === 'object') {
                content.value = JSON.stringify(content.value);
            }
        }
    },
    _exec: {
        key: function (type) {
            var once = new StreamOne(),
                request = this._req.key.call(this, type);
            this.client[type](request, once.cb);
            if (this.callback) {
                once.on('data', _.partial(this.callback, null));
                once.on('error', this.callback);
            }
            return once;
        },
        index: function () {
            var self = this,
                request, payload, push;
            if (this.range_min) {
                request = this._req.index_range.call(this);
            } else {
                request = this._req.index_exact.call(this);
            }
            var indexStream = this.client.getIndex(request);
            if (this.callback) {
                payload = [];
                // push(array) is the equivalent of calling payload.push.apply(payload, array);
                push = payload.push.apply.bind(payload.push, payload);
                indexStream.on('error', this.callback);
                indexStream.on('data', function (reply) {
                    if (reply.continuation) self.continuation = reply.continuation;
                    if (reply.keys) push(reply.keys);
                });
                indexStream.on('end', function () {
                    var cbPayload = {keys: payload};
                    if (self.continuation) cbPayload.continuation = self.continuation;
                    self.callback(null, cbPayload);
                }.bind(this));
            }
            return indexStream;
        },
        search: function () {
            var once = new StreamOne(),
                request = this._req.search.call(this);
            this.client.search(request, once.cb);
            if (this.callback) {
                once.on('data', _.partial(this.callback, null));
                once.on('error', this.callback);
            }
            return once;
        },
        mapreduce: function () {
            var request = this._req.mapreduce.call(this),
                readStream = this.client.mapred(request),
                payload;
            if (this.callback) {
                payload = [];
                push = payload.push.apply.bind(payload.push, payload);
                readStream.on('error', this.callback);
                readStream.on('data', function (data) { payload = payload.concat(data); });
                readStream.on('end', function () { this.callback(null, payload); });
            }
            return readStream;
        },
        mapreduce_index: function (cb) {
            var type = (this.range_min) ? 'range' : 'exact';
            this.inputs = _.omit(this._req['index_'+type].call(this), 'content_type', 'return_body');
            return this._exec.mapreduce.call(this);
        },
        mapreduce_search: function (cb) {
            this.inputs = _.omit(this._req.search.call(this), 'content_type', 'return_body');
            return this._exec.mapreduce.call(this);
        }
    }
};
['del', 'get', 'put'].forEach(function (method) {
    this[method] = _.partial(this.key, method);
    this._exec[method] = _.partial(this._exec.key, method);
}, RiakQuery.prototype);

module.exports = RiakQuery;