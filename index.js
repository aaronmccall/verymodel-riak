var async = require('async');
var VeryModel = require('verymodel').VeryModel;
var _ = require('underscore');

function VeryRiakModel(def, opts) {
    def = def||{};
    opts = opts||{};
    VeryModel.call(this, def, opts);

    riakifyModel(this);
}

function riakifyModel(model) {

    // Setup default index field definitions, if not defined in definition.
    if (Array.isArray(model.opts.indexes)) {
        var indexDefs = {};
        opts.indexes.forEach(function (index) {
            if (!model.definition[index]) {
                var isInt = false;
                if (Array.isArray(index)) {
                    index = index.shift();
                    if (index.length > 1) isInt = index.shift();
                }
                indexDefs[index] = { private: true, index: true, integer: isInt };
            } else {
                if (!model.definition[index].index) model.definition[index].index = true;
            }
        });
        // Add any field definitions we've just defined.
        if (!_.isEmpty(indexDefs)) model.addDefinition(indexDefs);
    }

    // Setup default indexes getter, if not defined in definition.
    if (!model.definition.indexes) {
        model.addDefinition({indexes: {
            private: true, derive: function () {
                var self = this,
                    payload = [],
                    def = this.__verymeta.model.definition;
                Object.keys(def).forEach(function (field) {
                    if (def[field].index) payload.push({
                        key: index + (def[field].integer ? '_int' : '_bin'),
                        value: self[field]
                    });
                });
            }
        }});
    }

    // Setup default value getter, if not defined in definition.
    if (!model.definition.value) {
        // Set model's 'value' proxy property to be an object containing
        // all fields whose names are listed in model.opts.values or,
        // if that option doesn't exist, a list of fields that are not
        // marked as private (caching the list at model.opts.values).
        model.addDefinition({value: {
            private: true,
            derive: function () {
                if (!model.opts.values) model.opts.values = _.compact(_.map(model.definition, function (def, key) {
                    return (def.private) ? false : key;
                }));
                _.pick(this.toJSON(), model.opts.values);
            }
        }});
    }

    // Setup default sibling handler, if not defined in opts.
    if (!model.opts.resolveSiblings) {
        // Default sibling handler is "last one wins."
        model.opts.resolveSiblings = function (reply) {
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

    // Returns all instances of this model
    model.all = model.opts.all || function (cb) {
        var self = this,
            hasAllIndex = (this.opts.allKey || (this.definition.model && this.definition.model.default)),
            // If we don't have an index to get keys by, we'll use getKeys (this is bad).
            method =  hasAllIndex ? 'getIndex' : 'getKeys',
                request = hasAllIndex ? {
                bucket: self.bucket,
                index: 'model_bin',
                key: this.definition.model.default,
                qtype: 0
            } : { bucket: self.bucket },
            client = this.getClient();
        client[method](request, function (err, reply) {
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
        
    };

    // Reformats indexes from Riak so that they can be applied to model instances
    model.indexesToData = model.opts.indexesToData || function (indexes) {
        var payload = {};
        indexes.forEach(function (index) {
            payload[index.key.replace(/(_bin|_int)$/, '')] = index.value;
        });
        return payload;
    };

    // Load an object's data from Riak and creates a model instance from it.
    model.load = model.opts.load || function (id, cb) {
        var self = this,
            request = {bucket: self.bucket, key: id};
        this.getClient().get(request, function (err, reply) {
            if (err) return cb(err);
            // Resolve siblings, if necessary, or just grab our content
            var content = (reply.content.length > 1) ? self.opts.resolveSiblings(reply.content) : reply.content[0];
            // reformat our data for VeryModel
            var indexes = self.indexesToData(content.indexes);
            var data = _.extend(content.value, indexes);
            data[self.opts.keyField||'id'] = id;
            if (reply.vclock) data.vclock = reply.vclock;
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
                bucket: this.bucket || this.__verymeta.model.bucket,
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
