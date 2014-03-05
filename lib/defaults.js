var _       = require('underscore');
var request = require('./request_helpers.js');
var streams = require('./streams');

module.exports = {
    // ### definition
    definition: {
        // **id**: The "id" field is where we'll store the Riak key. By default it will just be an unvalidated, public field
        id: {},
        // **indexes**: We'll need a way to retrieve all of the fields that should be indexed, so by default that will be all of the fields defined as indexes
        indexes: {
            private: true, derive: function () {
                var self = this,
                    payload = [],
                    defs = this.__verymeta.model.definition;
                // Push key/value object onto payload array for every field
                // whose definition indicates that it's an index field
                Object.keys(defs).forEach(function (field) {
                    var def = defs[field];
                    if (!def || !def.index) {
                        return;
                    }
                    // If def.index is a function, use it to derive an index value
                    var value = (typeof def.index === 'function') ? def.index.call(self, self[field]) : self[field];
                    if (typeof value === 'undefined') {
                        return;
                    }
                    // If we aren't expecting a multiple values, set a single key/value pair
                    if (!def.isArray) return payload.push({
                        key: field + (def.integer ? '_int' : '_bin'),
                        value: value
                    });
                    // If we are expecting multiple values, set them, also splitting
                    // CSV strings when appropriate
                    ((Array.isArray(value) && value) || (''+value).split(',')).forEach(function (value) {
                        payload.push({
                            key: field + (def.integer ? '_int' : '_bin'),
                            value: (typeof value === 'string') ? value.trim() : value
                        });
                    });
                });
                return payload;
            }
        },
        // **value**: By default, all non-private fields that aren't the id are expected to be the value payload
        value: {
            private: true,
            derive: function () {
                var model = this.__verymeta.model;
                if (!model.options.values) model.options.values = _.compact(_.map(model.definition, function (def, key) {
                    // By default we'll use all of the public fields except id
                    return (def.private || key === model.options.keyField) ? false : key;
                }));
                return _.pick(this, model.options.values);
            }
        }
    },
    // ### model methods
    methods: {
        // **getAllKey**: Allows us to share a bucket between different model types
        getAllKey: function () {
            if (this.options.allKey === '$bucket') {
                return {key: this.options.allKey, def: {default: this.getBucket()}};
            }
            var allKeyDef = this.options.allKey && this.definition[this.options.allKey],
                // default + required ensures that the allKey is always populated
                // private ensures it's not stored as part of the object's data
                // static ensures that the default value is not overwritten
                allKeyIsValid = allKeyDef && (allKeyDef.default &&
                                allKeyDef.required && allKeyDef.static);
            if (allKeyDef && allKeyIsValid) {
                return { key: this.options.allKey + '_bin', def: allKeyDef};
            }
        },
        // **getBucket**: Returns default bucket optionally appending an additional namespace
        getBucket: function (append) {
            var bucket = this.options.bucket;
            if (bucket && !append) return bucket;
            if (bucket && append) return [bucket, append].join(this.options.namespaceSeparator||"::");
            throw new Error('Please set a Riak bucket via options.bucket');
        },

        // **getRequest**: Builds Riak request objects. Signature varies according to type and developer preference. Supported request types are: del, get, index, mapreduce, and search.
        //   - Build request to get a single object by its key:
        //     - type and key: `model.getRequest('get', 'my-riak-key')` or
        //     - type and object: `model.getRequest('get', {key: 'my-riak-key'})`
        //   - Build request to get a list of keys for an index exact match:
        //     - type, index, key: `model.getRequest('index', 'my_index_bin', 'foo')` or
        //     - type and object: `model.getRequest('index', {index: 'my_index_bin', key: 'foo'})`
        //   - Build request to get a list of keys via an index range search:
        //     - type, index, min, max: `model.getRequest('index', 'my_index_bin', 'bar', 'foo')` or 
        //     - type and object: `model.getRequest('index', {index: 'my_index_bin', range_min: 'bar', range_max: 'foo'})`
        //   - Build request for mapreduce:
        //     - type, index, key, query array: `model.getRequest('mapreduce', 'my_index', 'my_key', […map/reduce phases…])` or
        //     - type and object: `model.getRequest('mapreduce', {inputs: …my inputs…, query: […map/reduce phases…]})` or
        //     - type, inputs array, query array: `model.getRequest('mapreduce', […my inputs…], […map/reduce phases…])`
        //   - Build request to search:
        //     - type, index, q: `model.getRequest('search', 'my_index', 'name:Bill')` or
        //     - type and object: `model.getRequest('search', {index: 'my_index', q: 'name:Bill'})`
        //   - Finally, any type of request can be created according to the following format:
        //     - `model.getRequest({ type: 'index', options: {index: 'my_index_bin', key: 'foo'}})`
        //       where type is any one of the types listed and options
        getRequest: function (type) {
            if (_.isObject(type) && type.type && type.options) {
                return request[type.type](this, [type.options]);
            }
            return request[type](this, _.rest(arguments));
        },
        // **_indexQuery**: Index query wrapper that returns a stream
        _indexQuery: function () {
            var args = _.rest(arguments, 0);
            args.unshift('index');
            var request = this.getRequest.apply(this, args);
            // Return the readable stream
            return this.getClient().getIndex(request);
        },
        // **all**: Streams or calls back with all instances of this model that are stored in Riak
        // or an index-filtered set of them, depending on whether filtering args are passed.
        // If the first argument is a function, it will be called with the result.
        all: function () {
            var args = _.rest(arguments, 0),
                streaming = typeof args[0] !== 'function',
                cb = !streaming ? args[0] : null,
                requestArgs = _.rest(args, (streaming ? 0 : 1)),
                bucket;
            if (args.length > 1 && typeof args[1] === 'object') {
                bucket = args[1].bucket;
            }
            // All stream handling is done via a Transform stream that
            // receives our key stream and transmits instances
            var stream = this._indexQuery.apply(this, requestArgs),
                streamOpts = {model: this, bucket: bucket};
            return stream.pipe(new streams.KeyToValueStream(_.defaults({}, streamOpts)))
                         .pipe(new streams.InstanceStream(_.defaults({callback: cb}, streamOpts)));
        },
        // **find**: Simplifies index lookups and can be called with the values or options object signatures.
        // - values: find('index', 'key_or_min', ['max',] [function (err, instances) {}])
        // - options object (shown with range query—-substitute key for range_min/range_max for exact match):
        //   find({index: 'index', range_min: 'min', range_max: 'max'}, [function (err, instance)])
        find: function () {
            var args = _.rest(arguments, 0),
                hasCb = typeof _.last(args) === 'function',
                cb = hasCb && args.pop();
            if (cb) {
                args.unshift(cb);
            }
            return this.all.apply(this, args);
        },

        // **find**: searches for matching 
        // **indexesToData**: Reformats indexes from Riak so that they can be applied to model instances
        indexesToData: function (indexes) {
            var self = this,
                payload = {},
                allKey = self.getAllKey();
            if (!indexes) return payload;
            indexes.forEach(function (index) {
                var field = index.key.replace(/(_bin|_int)$/, '');
                var notAllKey = !allKey || index.key !== allKey.key;
                var shouldConvert = (!self.options.values || !~self.options.values.indexOf(field));
                if (notAllKey && shouldConvert) {
                    var def = self.definition[field];
                    // If it isn't an array field, just pass the value through
                    if (!def || !def.isArray) {
                        payload[field] = index.value;
                    } else {
                        // Put the values back into a single field as an array
                        if (!payload[field]) payload[field] = [];
                        payload[field].push(def.integer ? parseInt(index.value, 10) : index.value);
                    }
                }
            });
            return payload;
        },
        // **replyToData**: Reformats riak reply into the appropriate format to feed into an instance's loadData method
        replyToData: function (reply) {
            if (!reply || !reply.content) {
                return {};
            }
            var content = (reply.content.length > 1) ? this.options.resolveSiblings(reply.content) : reply.content[0];
            // reformat our data for VeryModel
            var indexes = {};
            indexes = this.indexesToData(content.indexes);
            var data = _.extend(content.value, indexes);
            if (reply.key) {
                data[this.options.keyField] = reply.key;
            }
            if (reply.vclock) {
                data.vclock = reply.vclock;
            }
            return data;
        },
        _getQuery: function (id, bucket, cb) {
            var reqArgs = ['get', id];
            if (typeof bucket === 'function' && typeof cb === 'undefined') {
                cb = bucket;
                bucket = undefined;
            }
            if (bucket) reqArgs.push(bucket);
            this.getClient().get(this.getRequest.apply(this, reqArgs), cb);
        },
        _getInstance: function (id, reply, bucket) {
            // Resolve siblings, if necessary, or just grab our content
            var data = this.replyToData(reply);
            data[this.options.keyField] = id;
            if (bucket && this.definition.bucket) data.bucket = bucket;
            var instance = this.create(data);
            if (bucket && !instance.bucket) instance.bucket = bucket;
            return instance;
        },
        // **load**: Load an object's data from Riak and creates a model instance from it.
        load: function (id, bucket, cb) {
            var self = this;
            if (typeof bucket === 'function' && typeof cb === 'undefined') {
                cb = bucket;
                bucket = undefined;
            }
            this._getQuery(id, bucket, function (err, reply) {
                if (err||_.isEmpty(reply)) return cb(err||new Error('No matching key found.'));
                self._last = self._getInstance(id, reply, bucket);
                // Override default toJSON method to make more Hapi compatible
                if (typeof cb === 'function') {
                    cb(null, self._last);
                }
            });
        },
        // **remove**: Remove an instance from Riak
        remove: function (id, bucket, cb) {
            if (typeof bucket === 'function' && typeof cb === 'undefined') {
                cb = bucket;
                bucket = undefined;
            }
            this.getClient().del(this.getRequest('del', id, bucket), function (err) {
                cb(err);
            });
        }
    },
    // ### options
    options: {
        // - Default allKey is Riak's magic 'give me all the keys' index
        allKey: '$bucket',
        // - Default key field is id
        keyField: 'id',
        // - pagination is on by default to prevent overloading the server
        max_results: 10,
        paginate: true,
        // - Default sibling handler is "last one wins"
        resolveSiblings: function (siblings) {
            return _.max(siblings, function (sibling) {
                return parseFloat(sibling.last_mod + '.' + sibling.last_mod_usecs);
            });
        }
    },
    // ### instanceMethods
    instanceMethods: {
        // **prepare**: Prepare a Riak request object from this instance.
        prepare: function () {
            var payload = {
                bucket: this.getBucket(),
                content: {
                    indexes: this.indexes,
                    value: JSON.stringify(this.value),
                    content_type: 'application/json'
                },
                return_body: true
            };
            if (this.id) {
                payload.key = this.id;
            }
            if (this.vclock) {
                payload.vclock = this.vclock;
            }
            return payload;
        },
        // **save**: Put this instance to Riak.
        save: function (cb) {
            this.getClient().put(this.prepare(), function (err, reply) {
                if (!err) {
                    if (!this.id && reply.key)  this.id = reply.key;
                    if (reply.vclock) this.vclock = reply.vclock;
                }
                if (reply.content.length > 1 && typeof cb !== 'boolean') {
                    this.loadData(this.__verymeta.model.replyToData(reply));
                    // The boolean arg prevents a race condition when
                    // reply.content.length continues to be > 1
                    this.save(true);
                }
                if (typeof cb === 'function') {
                    cb(err);
                }
            }.bind(this));
        },
        // **getClient**: Proxy method to get the Riak client from model
        getClient: function () { return this.__verymeta.model.getClient(); },

        // **getBucket**: return instance-level bucket property or fall back to model's getBucket
        getBucket: function () {
            return (typeof this.bucket !== 'undefined') ? this.bucket : this.__verymeta.model.getBucket();
        }
    }
};