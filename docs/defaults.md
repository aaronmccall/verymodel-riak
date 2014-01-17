```javascript
var _       = require('underscore');
var async = require('async');
var request = require('./request_helpers.js');

module.exports = {
```

### definition

```javascript
    definition: {
```

**id**: The "id" field is where we'll store the Riak key. By default it will just be an unvalidated, public field

```javascript
        id: {},
```

**indexes**: We'll need a way to retrieve all of the fields that should be indexed, so by default that will be all of the fields defined as indexes

```javascript
        indexes: {
            private: true, derive: function () {
                var self = this,
                    payload = [],
                    defs = this.__verymeta.model.definition;
```

Push key/value object onto payload array for every field
whose definition indicates that it's an index field

```javascript
                Object.keys(defs).forEach(function (field) {
                    var def = defs[field];
                    if (def.index) payload.push({
                        key: field + (def.integer ? '_int' : '_bin'),
                        value: self[field]
                    });
                });
                return payload;
            }
        },
```

**value**: By default, all non-private fields that aren't the id are expected to be the value payload

```javascript
        value: {
            private: true,
            derive: function () {
                var model = this.__verymeta.model;
                if (!model.options.values) model.options.values = _.compact(_.map(model.definition, function (def, key) {
```

By default we'll use all of the public fields except id

```javascript
                    return (def.private || key === 'id') ? false : key;
                }));
                return _.pick(this, model.options.values);
            }
        }
    },
```

### model methods

```javascript
    methods: {
```

**getAllKey**: Allows us to share a bucket between different model types

```javascript
        getAllKey: function () {
            var allKey;
            if (this.options.allKey === '$bucket') return (allKey = {key: this.options.allKey, def: {default: this.getBucket()}}), console.log('allKey:', allKey);
            var allKeyDef = this.options.allKey && this.definition[this.options.allKey],
```

default + required ensures that the allKey is always populated
private ensures it's not stored as part of the object's data
static ensures that the default value is not overwritten

```javascript
                allKeyIsValid = allKeyDef && (allKeyDef.default && allKeyDef.required &&
                                allKeyDef.private && allKeyDef.static);
            if (allKeyDef && allKeyIsValid) return { key: this.options.allKey + '_bin', def: allKeyDef};
        },
```

**getBucket**: Returns default bucket

```javascript
        getBucket: function () {
            if (this.options.bucket) return this.options.bucket;
            throw new Error('Please set a Riak bucket via options.bucket');
        },

```

**getRequest**: Builds Riak request objects. Signature varies according to type and developer preference. Supported request types are: del, get, index, mapreduce, and search.
  - Build request to get a single object by its key:
    - type and key: `model.getRequest('get', 'my-riak-key')` or
    - type and object: `model.getRequest('get', {key: 'my-riak-key'})`
  - Build request to get a list of keys for an index exact match:
    - type, index, key: `model.getRequest('index', 'my_index_bin', 'foo')` or
    - type and object: `model.getRequest('index', {index: 'my_index_bin', key: 'foo'})`
  - Build request to get a list of keys via an index range search:
    - type, index, min, max: `model.getRequest('index', 'my_index_bin', 'bar', 'foo')` or 
    - type and object: `model.getRequest('index', {index: 'my_index_bin', range_min: 'bar', range_max: 'foo'})`
  - Build request for mapreduce:
    - type, index, key, query array: `model.getRequest('mapreduce', 'my_index', 'my_key', […map/reduce phases…])` or
    - type and object: `model.getRequest('mapreduce', {inputs: …my inputs…, query: […map/reduce phases…]})` or
    - type, inputs array, query array: `model.getRequest('mapreduce', […my inputs…], […map/reduce phases…])`
  - Build request to search:
    - type, index, q: `model.getRequest('search', 'my_index', 'name:Bill')` or
    - type and object: `model.getRequest('search', {index: 'my_index', q: 'name:Bill'})`
  - Finally, any type of request can be created according to the following format:
    - `model.getRequest({ type: 'index', options: {index: 'my_index_bin', key: 'foo'}})`
      where type is any one of the types listed and options

```javascript
        getRequest: function (type) {
            if (_.isObject(type) && type.type && type.options) {
                return request[type.type](this, type.options);
            }
            return request[type](this, _.rest(arguments));
        },

```

**all**: Returns all instances of this model

```javascript
        all: function (cb, opts) {
            var self = this,
                allKey = this.getAllKey(),
```

If we don't have an allKey, we'll use getKeys.
Don't do this in production!

```javascript
                request = this.getRequest.apply(this, ((opts && opts.type)? [opts] : ['index', opts]));

            this.getClient().getIndex(this.getRequest('index'), function (err, reply) {
                var all = [];
                if (err || !reply.keys || !reply.keys.length) return cb(err, all);
                async.each(reply.keys, function (key, done) {
                    self.load(key, function (err, instance) {
                        all.push(instance);
                        done();
                    });
                }, function (err) {
                    cb(err, all);
                });
                
            });
        },
```

**indexesToData**: Reformats indexes from Riak so that they can be applied to model instances

```javascript
        indexesToData: function (indexes) {
            var self = this,
                payload = {};
            if (!indexes) return payload;
            indexes.forEach(function (index) {
                if (index.key !== self.getAllKey().key) {
                    payload[index.key.replace(/(_bin|_int)$/, '')] = index.value;
                }
            });
            return payload;
        },
```

**replyToData**: Reformats riak reply into the appropriate format to feed an instance's loadData method

```javascript
        replyToData: function (reply) {
            if (!reply || !reply.content) return {};
            var content = (reply.content.length > 1) ? this.options.resolveSiblings(reply.content) : reply.content[0];
```

reformat our data for VeryModel

```javascript
            var indexes = this.indexesToData(content.indexes);
            var data = _.extend(content.value, indexes);
            data[this.options.keyField||'id'] = reply.key;
            if (reply.vclock) data.vclock = reply.vclock;
            return data;
        },
```

**load**: Load an object's data from Riak and creates a model instance from it.

```javascript
        load: function (id, cb) {
            var self = this,
                request = {bucket: self.bucket, key: id};
            this.getClient().get(this.getRequest('get', id), function (err, reply) {
                if (err) return cb(err);
```

Resolve siblings, if necessary, or just grab our content

```javascript
                var data = self.replyToData(reply);
                var instance = self.create(data);
                self.last = instance;
```

Override default toJSON method to make more Hapi compatible

```javascript
                if (typeof cb === 'function') cb(null, instance);
            });
        },
```

**remove**: Remove an instance from Riak

```javascript
        remove: function (id, cb) {
            this.getClient().del(this.getRequest('del', id), function (err, reply) {
                cb(err);
            });
        }
    },
```

### options

```javascript
    options: {
```

Default allKey is Riak's magic 'give me all the keys' index

```javascript
        allKey: '$bucket',
```

Default sibling handler is "last one wins"

```javascript
        resolveSiblings: function (siblings) {
            return _.max(siblings, function (sibling) {
                return parseFloat(sibling.last_mod + '.' + sibling.last_mod_usecs);
            });
        }
    },
```

### instanceMethods

```javascript
    instanceMethods: {
```

**prepare**: Prepare a Riak request object from this instance.

```javascript
        prepare: function () {
            var payload = {
                bucket: this.bucket || this.__verymeta.model.getBucket(),
                content: {
                    indexes: this.indexes,
                    value: JSON.stringify(this.value),
                    content_type: 'application/json'
                },
                return_body: true
            };
            if (this.id) payload.key = this.id;
            if (this.vclock) payload.vclock = this.vclock;
            return payload;
        },
```

**save**: Put this instance to Riak.

```javascript
        save: function (cb) {
            this.getClient().put(this.prepare(), function (err, reply) {
                if (!err) {
                    if (!this.id && reply.key)  this.id = reply.key;
                    if (reply.vclock) this.vclock = reply.vclock;
                }
                if (reply.content.length > 1 && typeof cb !== 'boolean') {
                    this.loadData(this.__verymeta.model.replyToData(reply));
```

The boolean arg prevents a race condition when
reply.content.length continues to be > 1

```javascript
                    this.save(true);
                }
                if (typeof cb === 'function') cb(err);
            }.bind(this));
        },
```

**getClient**: Proxy method to get the Riak client from model

```javascript
        getClient: function () { return this.__verymeta.model.getClient(); }
    }
};
```

