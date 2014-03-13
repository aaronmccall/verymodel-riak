# verymodel-riak

## Riak extensions for VeryModel

- Author: Aaron McCall <aaron@andyet.net>
- Version: 0.10.0
- License: MIT

[![Code Climate](https://codeclimate.com/github/aaronmccall/verymodel-riak.png)](https://codeclimate.com/github/aaronmccall/verymodel-riak)

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


myInstance.save(); // stores the instance's data to Riak

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
var request = require('./request_helpers.js');
var streams = require('./streams');

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
                    if (!def || !def.index) {
                        return;
                    }
```

If def.index is a function, use it to derive an index value

```javascript
                    var value = (typeof def.index === 'function') ? def.index.call(self, self[field]) : self[field];
                    var idxName = (typeof def.index === 'string') ? def.index : field;
                    if (typeof value === 'undefined') {
                        return;
                    }
```

If we aren't expecting a multiple values, set a single key/value pair

```javascript
                    if (!def.isArray) return payload.push({
                        key: (idxName.match(/(_int|_bin)$/) && idxName) || idxName + (def.integer ? '_int' : '_bin'),
                        value: value
                    });
```

If we are expecting multiple values, set them, also splitting
CSV strings when appropriate

```javascript
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
```

**value**: By default, all non-private fields that aren't the id are expected to be the value payload

```javascript
        value: {
            private: true,
            derive: function () {
                var model = this.__verymeta.model;
                if (!model.options.values) model.options.values = _.compact(_.map(model.definition, function (def, key) {
                    var isKeyField = key === model.options.keyField;
                    var isAllKey = key === model.options.allKey;
```

By default we'll use all of the public fields except id

```javascript
                    return (def.private || isKeyField || isAllKey) ? false : key;
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
                allKeyIsValid = allKeyDef && (allKeyDef.default &&
                                allKeyDef.required && allKeyDef.static);
            if (allKeyDef && allKeyIsValid) {
                return { key: this.options.allKey + '_bin', def: allKeyDef};
            }
        },
```

**getBucket**: Returns default bucket optionally appending an additional namespace

```javascript
        getBucket: function (append) {
            var bucket = this.options.bucket;
            if (!bucket && this.options.riak) bucket = this.options.riak.bucket;
            if (bucket && !append) return bucket;
            if (bucket && append) return [bucket, append].join(this.options.namespaceSeparator||"::");
            throw new Error('Please set a Riak bucket via options.bucket');
        },

```

**getLogger**: Returns specified logger if defined or creates one and returns it

```javascript
        getLogger: function _logger() {
            return this.options.logger || (this.options.logger = require('bucker').createNullLogger());
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

**_indexQuery**: Index query wrapper that returns a stream

```javascript
        _indexQuery: function () {
            var args = _.rest(arguments, 0);
            args.unshift('index');
            var request = this.getRequest.apply(this, args);
```

Return the readable stream

```javascript
            return this.getClient().getIndex(request);
        },
```

**all**: Streams or calls back with all instances of this model that are stored in Riak
or an index-filtered set of them, depending on whether filtering args are passed.
If the first argument is a function, it will be called with the result.

```javascript
        all: function () {
            var args = _.rest(arguments, 0),
                streaming = typeof args[0] !== 'function',
                cb = !streaming ? args[0] : null,
                requestArgs = _.rest(args, (streaming ? 0 : 1)),
                bucket;
            if (args.length > 1 && typeof args[1] === 'object') {
                bucket = args[1].bucket;
            }
            var logger = this.getLogger();
            logger.debug('query prepared: %j, streaming: %s', requestArgs, streaming);
```

All stream handling is done via a Transform stream that
receives our key stream and transmits instances

```javascript
            var stream = this._indexQuery.apply(this, requestArgs),
                streamOpts = {model: this, bucket: bucket};

            return stream.pipe(new streams.KeyToValueStream(_.defaults({}, streamOpts)))
                         .pipe(new streams.InstanceStream(_.defaults({callback: cb}, streamOpts)));
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
            if (cb) {
                args.unshift(cb);
            }
            return this.all.apply(this, args);
        },

```

**find**: searches for matching 
**indexesToData**: Reformats indexes from Riak so that they can be applied to model instances

```javascript
        indexesToData: function (indexes) {
            var self = this,
                payload = {},
                allKey = self.getAllKey();
            if (!indexes) return payload;
            indexes.forEach(function (index) {
                var field,
                    stripped = index.key.replace(/(_bin|_int)$/, '');
                if (self.options.indexes_to_fields[index.key]) {
                    field = self.options.indexes_to_fields[index.key];
                }
                if (!field && self.options.indexes_to_fields[stripped]) {
                    field = self.options.indexes_to_fields[stripped];
                }
                if (!field) field = stripped;

                var notAllKey = !allKey || index.key !== allKey.key;
                var shouldConvert = (!self.options.values || !~self.options.values.indexOf(field));
                if (notAllKey && shouldConvert) {
                    var def = self.definition[field];
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
                        payload[field].push(def.integer ? parseInt(index.value, 10) : index.value);
                    }
                }
            });
            return payload;
        },
```

**replyToData**: Reformats riak reply into the appropriate format to feed into an instance's loadData method

```javascript
        replyToData: function (reply) {
            if (!reply || !reply.content) {
                return {};
            }
            var content = (reply.content.length > 1) ? this.options.resolveSiblings(reply.content) : reply.content[0];
```

reformat our data for VeryModel

```javascript
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
```

Resolve siblings, if necessary, or just grab our content

```javascript
            var data = this.replyToData(reply);
            data[this.options.keyField] = id;
            if (bucket && this.definition.bucket) data.bucket = bucket;
            var instance = this.create(data);
            if (bucket && !instance.bucket) instance.bucket = bucket;
            return instance;
        },
```

**load**: Load an object's data from Riak and creates a model instance from it.

```javascript
        load: function (id, bucket, cb) {
            var self = this;
            if (typeof bucket === 'function' && typeof cb === 'undefined') {
                cb = bucket;
                bucket = undefined;
            }
            this._getQuery(id, bucket, function (err, reply) {
                if (err||_.isEmpty(reply)) return cb(err||new Error('No matching key found.'));
                self._last = self._getInstance(id, reply, bucket);
```

Override default toJSON method to make more Hapi compatible

```javascript
                if (typeof cb === 'function') {
                    cb(null, self._last);
                }
            });
        },
```

**remove**: Remove an instance from Riak

```javascript
        remove: function (id, bucket, cb) {
            var self = this;
            if (typeof bucket === 'function' && typeof cb === 'undefined') {
                cb = bucket;
                bucket = undefined;
            }
            this.getLogger().debug('request to delete account(%s)', id);
            this.getClient().del(this.getRequest('del', id, bucket), function (err) {
                if (err) return cb(err);
                self.getLogger().debug('successfully deleted account');
                cb();
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
        max_results: 100,
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
            var content = {
                value: JSON.stringify(this.value),
                content_type: 'application/json'
            };
            var indexes = this.indexes;
            if (indexes.length) content.indexes = indexes;
            var payload = {
                content: content,
                bucket: this.getBucket(),
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
```

**save**: Put this instance to Riak.

```javascript
        save: function (cb) {
            var self = this;
            var logger = this.getLogger();
            var payload = this.prepare();
            logger.debug('save payload: %j', payload);
            this.getClient().put(payload, function (err, reply) {
                logger.debug('riak put %s', (err == null ? 'succeeded' : ('failed: ' + err)));
                if (!err) {
                    if (!self.id && reply.key)  self.id = reply.key;
                    if (reply.vclock) self.vclock = reply.vclock;
                }
                if (reply.content.length > 1 && typeof cb !== 'boolean') {
                    self.loadData(self.__verymeta.model.replyToData(reply));
```

The boolean arg prevents a race condition when
reply.content.length continues to be > 1

```javascript
                    self.save(true);
                }
                if (typeof cb === 'function') {
                    cb(err, self);
                }
            });
        },
```

**getClient**: Proxy method to get the Riak client from model

```javascript
        getClient: function () { return this.__verymeta.model.getClient(); },

```

**getBucket**: return instance-level bucket property or fall back to model's getBucket

```javascript
        getBucket: function () {
            return (typeof this.bucket !== 'undefined') ? this.bucket : this.__verymeta.model.getBucket();
        },
```

**getLogger**: return this instance's logger (if defined) or fall back to model's getLogger

```javascript
        getLogger: function () {
            return (typeof this.logger !== 'undefined') ? this.logger : this.__verymeta.model.getLogger();
        }
    }
};

```

Add some logging

```javascript
var logify = function (obj, name) {
    if (typeof obj[name] !== 'function') return;
    var method = obj[name];
    obj[name] = _.wrap(method, function (method) {
        this.getLogger().debug('Function [%s]', name);
        return method.apply(this, _.rest(_.toArray(arguments)));
    });
};
['load', 'remove', 'find', 'all'].forEach(_.partial(logify, module.exports.methods));
logify(module.exports.instanceMethods, 'save');
logify(module.exports.instanceMethods, 'prepare');


```

## Acknowledgements

    - First and foremost, thanks to @fritzy for making VeryModel without which verymodel-riak would be non-existent or pointless.

    - Contributors: