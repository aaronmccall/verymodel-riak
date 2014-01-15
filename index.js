var async = require('async');
var VeryModel = require('verymodel').VeryModel;
var _ = require('underscore');

function VeryRiakModel(def, opts) {
    def = def||{};
    opts = opts||{};
    VeryModel.call(this, def, opts);
    riakifyModel(this);
}

VeryRiakModel.prototype = Object.create(VeryModel.prototype);

// Add Riak extensions to model factory
function riakifyModel(model) {
    // Setup index definitions
    if (Array.isArray(model.opts.indexes)) {
        var indexDefs = {};
        model.opts.indexes.forEach(function (index) {
            var isInt = false,
            indexDef = model.definition[(typeof index === 'string') ? index : index[0]],
            indexName, keepPrivate;
            if (Array.isArray(index)) {
                indexName = index[0];
                isInt = index[1]||false;
                keepPrivate = (typeof index[2] === 'boolean') ? index[2] : true;
            }
            if (keepPrivate !== false) keepPrivate = true;
            if (!indexDef) {
                // Setup default index field definitions, if not defined in definition.
                indexDefs[indexName||index] = { private: keepPrivate, index: true, integer: isInt };
            } else {
                // If the field is defined in definitions—-but doesn't have index metadata, add it.
                if (!indexDef.index) model.definition[index].index = true;
                if (!indexDef.integer && isInt) model.definition[index].integer = true;
            }
        });
        // Add any field definitions we've just defined.
        if (!_.isEmpty(indexDefs)) model.addDefinition(indexDefs);
    }

    if (!model.definition.id) {
        model.addDefinition({ id: {} });
    }

    // Setup default indexes getter, if not already defined.
    if (!model.definition.indexes) {
        model.addDefinition({indexes: {
            private: true, derive: function () {
                var self = this,
                    payload = [],
                    defs = this.__verymeta.model.definition;
                Object.keys(defs).forEach(function (field) {
                    var def = defs[field];
                    if (def.index) payload.push({
                        key: field + (def.integer ? '_int' : '_bin'),
                        value: self[field]
                    });
                });
                return payload;
            }
        }});
    }

    // Setup default value getter, if not already defined.
    if (!model.definition.value) {
        // Set model's 'value' proxy property to be an object containing
        // all fields whose names are listed in model.opts.values or,
        // if that option doesn't exist, a list of fields that are not
        // marked as private (caching the list at model.opts.values).
        model.addDefinition({value: {
            private: true,
            derive: function () {
                if (!model.opts.values) model.opts.values = _.compact(_.map(model.definition, function (def, key) {
                    // By default we'll use all of the public fields
                    return (def.private && key !== 'id') ? false : key;
                }));
                return _.pick(this, model.opts.values);
            }
        }});
    }

    // Setup default sibling handler, if not defined in opts.
    if (!model.opts.resolveSiblings) {
        // Default sibling handler is "last one wins."
        model.opts.resolveSiblings = function (siblings) {
            return _.max(siblings, function (sibling) {
                return parseFloat(sibling.last_mod + '.' + sibling.last_mod_usecs);
            });
        };
    }

    // Set an option value, requires a truthy override value to override
    // an existing option.
    model.setOption = function (name, value, override) {
        if (this.opts.name && !override) {
            throw new Error("Can't override existing option " + name + " without truthy override argument.");
        }
        this.opts[name] = value;
        return this;
    };

    // Set the Riak client
    model.setClient = function (client, override) {
        this.addOption('client', client, override);
        return this;
    };

    // Get the Riak client
    model.getClient = function () {
        if (this.opts.client) return this.opts.client;
        throw new Error('Please set a Riak client via setClient or opts.client');
    };

    model.getBucket = model.opts.getBucket || function () {
        if (this.opts.bucket) return this.opts.bucket;
        throw new Error('Please set a Riak bucket via opts.bucket');
    };

    model.getAllKey = model.opts.getAllKey || function () {
        var allKeyDef = this.opts.allKey && this.definition[this.opts.allKey],
            // default + required ensures that the allKey is always populated
            // private ensures it's not stored as part of the object's data
            // static ensures that the default value is not overwritten
            allKeyIsValid = allKeyDef && (allKeyDef.default && allKeyDef.required &&
                            allKeyDef.private && allKeyDef.static);
        if (allKeyDef && allKeyIsValid) return { key: this.opts.allKey, def: allKeyDef};
    };

    // Returns all instances of this model
    model.all = model.opts.all || function (cb) {
        var allKey = this.getAllKey(),
            // If we don't have an allKey, we'll use getKeys.
            // Don't do this in production!
            method =  allKey ? 'getIndex' : 'getKeys',
            getRequest = function () {
                if (allKey) {
                    return {
                        bucket: this.getBucket(),
                        index: allKey.key + '_bin',
                        key: allKey.def.default,
                        qtype: 0
                    };
                }
                return { bucket: this.getBucket() };
            }.bind(this),
            newFunc = function (cb) {
                var self = this,
                    client = self.getClient();
                client[method].call(client, getRequest(), function (err, reply) {
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
            }.bind(this);
        newFunc(cb);
        this.all = newFunc;
    };

    // Reformats indexes from Riak so that they can be applied to model instances
    model.indexesToData = model.opts.indexesToData || function (indexes) {
        var payload = {};
        if (!indexes) return payload;
        indexes.forEach(function (index) {
            payload[index.key.replace(/(_bin|_int)$/, '')] = index.value;
        });
        return payload;
    };

    model.replyToData = model.opts.replyToData || function (reply) {
        if (!reply || !reply.content) return {};
        var content = (reply.content.length > 1) ? this.opts.resolveSiblings(reply.content) : reply.content[0];
        // reformat our data for VeryModel
        var indexes = this.indexesToData(content.indexes);
        var data = _.extend(content.value, indexes);
        data[this.opts.keyField||'id'] = reply.key;
        if (reply.vclock) data.vclock = reply.vclock;
        var allKey = (this.getAllKey() && this.getAllKey().key)||'';
        data = _.omit(data, allKey);
        return data;
    };

    // Load an object's data from Riak and creates a model instance from it.
    model.load = model.opts.load || function (id, cb) {
        var self = this,
            request = {bucket: self.bucket, key: id};
        this.getClient().get(request, function (err, reply) {
            if (err) return cb(err);
            // Resolve siblings, if necessary, or just grab our content
            var data = self.replyToData(reply);
            var instance = self.create(data);
            self.last = instance;
            // Override default toJSON method to make more Hapi compatible
            if (typeof cb === 'function') cb(null, instance);
        });
    };

    model.remove = model.opts.remove || function (id, cb) {
        this.getClient().del({bucket: this.bucket, key: id}, function (err, reply) {
            cb(err);
        });
    };


    var instanceMethods = {
        // Prepare a Riak request object from this instance.
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
        // Save this instance.
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
                if (typeof cb === 'function') cb(err);
            }.bind(this));
        },
        // Proxy method to get the Riak client
        getClient: function () { return model.getClient(); }
    };

    // Finalize instanceMethods
    model.opts.instanceMethods = _.extend({}, instanceMethods, model.opts.instanceMethods||{});
    // and apply them
    model.extendModel(model.opts.instanceMethods);
}


module.exports = {
    VeryRiakModel: VeryRiakModel,
    riakifyModel: riakifyModel
};
