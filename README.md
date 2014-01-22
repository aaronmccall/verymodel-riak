# verymodel-riak

Riak extensions for VeryModel

- Author: Aaron McCall <aaron@andyet.net>
- Version: 0.6.0
- License: MIT

## Examples

### Using only default functionality

```javascript
var VeryRiakModel = require('verymodel-riak').VeryRiakModel;
```

**Define our fields**

```javascript
var MyDef = {
    first_name: {},
    name: {
        private: true,
        derive: function () { return this.first_name + ' ' + this.last_name; }
    },
    city:           {},
    state:          {index: true},
    zip:            {index: true, integer: true},
    model:          {default: 'person', required: true, private: true, static: true},
    favorite_foods: {index: true, isArray: true }
};
```

**Define our indexes**

```javascript
var MyOptions = {
    indexes:    [['last_name', false, false], ['age', true], 'gender'],
    allKey:     'model',
    bucket:     "test:bucket"
};

```

**Init our model factory**

```javascript
var MyModel = new VeryRiakModel(MyDef, MyOptions);

```

**Create a model instance**

```javascript
var myInstance = MyModel.create({
    first_name:     'Bill',
    last_name:      'Jones',
    age:            40,
    gender:         'm',
    city:           'Atlanta',
    state:          'GA',
    zip:            30303,
    favorite_foods: ['pizza', 'fried chicken', 'applesauce', 'cake']
});

```

myInstance.indexes will return:
```javascript
[
    {key: 'last_name_bin', value: 'Jones'},
    {key: 'age_int', value: 40},
    {key: 'gender_bin', value: 40},
    {key: 'state_bin', value: 'GA'},
    {key: 'zip_int', value: 30303},
    {key: 'model_bin', value: 'person'}
    {key: 'favorite_foods_bin', value: 'pizza'}
    {key: 'favorite_foods_bin', value: 'fried chicken'}
    {key: 'favorite_foods_bin', value: 'applesauce'}
    {key: 'favorite_foods_bin', value: 'cake'}
]

```

myInstance.value will return:
```javascript
{
    first_name: data[0].first_name,
    last_name: 'Jones',
    city: 'Atlanta',
    state: 'GA',
    zip: 30303
}

```

## Defaults

```javascript
var _       = require('underscore');
var async = require('async');
var EventEmitter = require('events').EventEmitter;
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
                    if (def.index) {
                        if (!def.isArray) {
                            payload.push({
                                key: field + (def.integer ? '_int' : '_bin'),
                                value: self[field]
                            });
                        } else {
                            (Array.isArray(self[field]) && self[field] || self[field].split(',')).forEach(function (value) {
                                payload.push({
                                    key: field + (def.integer ? '_int' : '_bin'),
                                    value: (typeof value === 'string') ? value.trim() : value
                                });
                            });
                        }
                    }
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
                    return (def.private || key === model.options.keyField) ? false : key;
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
            if (this.options.allKey === '$bucket') {
                return {key: this.options.allKey, def: {default: this.getBucket()}};
            }
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
                return request[type.type](this, [type.options]);
            }
            return request[type](this, _.rest(arguments));
        },

```

**all**: Returns all instances of this model that are stored in Riak
The only required argument is a callback (or true, if you want a stream). Any additional arguments
will be passed to getRequest.

```javascript
        all: function () {
            var self = this,
                args = _.rest(arguments, 0),
                streaming = typeof args[0] !== 'function',
                cb = !streaming ? args[0] : null,
                allKey = this.getAllKey(),
                requestArgs = ['index'],
                request = this.getRequest.apply(this, requestArgs.concat(_.rest(args, (streaming ? 0 : 1)))),
                proxy = new EventEmitter(),
                instances = [], loading, riakDone;
```

If we're streaming, this will return the readable stream

```javascript
            var stream = this.getClient().getIndex(request, true);

            stream.on('data', function dataHandler(reply) {
                loading = true;
                if (reply && reply.continuation) self.continuation = reply.continuation;
                async.each(reply.keys, function (key, done) {
                    self.load(key, function (err, instance) {
                        if (!streaming) {
                            instances.push(instance);
                            return done();
                        }
                        proxy.emit('data', instances);
                        instances = [];
                        done();
                    });
                }, function (err) {
                    loading = false;
                    if (riakDone) {
                        if (cb) return cb(null, instances);
                        proxy.emit('end');
                    }
                });
                
            });
            stream.on('error', function errorHandler(err) {
                if (!streaming) return cb(err, instances);
                proxy.emit('error', err);
            });
            stream.on('end', function endHandler () {
                riakDone = true;
                if (!streaming && !loading) return cb(null, instances), cb = null;
            });

            return proxy;
        },
```

**find**: Simplifies index lookups and can be called with the values or options object signatures.
- values: find('index', 'key_or_min', ['max',] [function (err, instances) {}])
- options object (shown with range query—-substitute key for range_min/range_max for exact match):
  find({index: 'index', range_min: 'min', range_max: 'max'}, [function (err, instance)])

```javascript
        find: function () {
            var args = _.rest(arguments, 0),
                hasCb = typeof _.last(args) === 'function',
                cb = hasCb && args.pop();
            if (cb) args.unshift(cb);
            return this.all.apply(this, args);
        },

```

**find**: searches for matching 
**indexesToData**: Reformats indexes from Riak so that they can be applied to model instances

```javascript
        indexesToData: function (indexes) {
            var self = this,
                payload = {};
            if (!indexes) return payload;
            indexes.forEach(function (index) {
                if (index.key !== self.getAllKey().key) {
                    var field = index.key.replace(/(_bin|_int)$/, ''),
                        def = self.definition[field];
```

If it isn't an array field, just pass the value through

```javascript
                    if (!def || !def.isArray) {
                        payload[field] = index.value;
                    } else {
```

Put the values back into a single field as an array

```javascript
                        if (!payload[field]) payload[field] = [];
                        payload[field].push(index.value);
                    }
                }
            });
            return payload;
        },
```

**replyToData**: Reformats riak reply into the appropriate format to feed into an instance's loadData method

```javascript
        replyToData: function (reply) {
            if (!reply || !reply.content) return {};
            var content = (reply.content.length > 1) ? this.options.resolveSiblings(reply.content) : reply.content[0];
```

reformat our data for VeryModel

```javascript
            var indexes = this.indexesToData(content.indexes);
            var data = _.extend(content.value, indexes);
            if (reply.key) data[this.options.keyField] = reply.key;
            if (reply.vclock) data.vclock = reply.vclock;
            return data;
        },
```

**load**: Load an object's data from Riak and creates a model instance from it.

```javascript
        load: function (id, cb) {
            var self = this;
            this.getClient().get(this.getRequest('get', id), function (err, reply) {
                if (err) return cb(err);
```

Resolve siblings, if necessary, or just grab our content

```javascript
                var data = self.replyToData(reply);
                data[self.options.keyField] = id;
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

- Default allKey is Riak's magic 'give me all the keys' index

```javascript
        allKey: '$bucket',
```

- Default key field is id

```javascript
        keyField: 'id',
```

- pagination is on by default to prevent overloading the server

```javascript
        max_results: 10,
        paginate: true,
```

- Default sibling handler is "last one wins"

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

## Acknowledgements

    - First and foremost, thanks to @fritzy for making VeryModel without which verymodel-riak would be non-existent or pointless.

    - Contributors: