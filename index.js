var VeryModel = require('verymodel').VeryModel;
var _ = require('underscore');
var defaults = require('./lib/defaults.js');

function VeryRiakModel(definition, options) {
    VeryModel.call(this, definition, options);
    riakifyModel(this);
}

VeryRiakModel.prototype = Object.create(VeryModel.prototype);

// Add Riak extensions to model factory
function riakifyModel(model) {
    // Extend options with any default options that aren't already defined
    _.defaults(model.options, defaults.options);

    // Setup index definitions based on options.indexes
    var indexDefs = {};
    if (Array.isArray(model.options.indexes)) {
        model.options.indexes.forEach(function (index) {
            var isInt = false,
                isArray = Array.isArray(index),
                indexName = isArray ? index[0] : index,
                indexDef = model.definition[indexName],
                keepPrivate;
            if (isArray) {
                isInt = index[1]||false;
                keepPrivate = (typeof index[2] === 'boolean') ? index[2] : true;
            }
            if (keepPrivate !== false) keepPrivate = true;
            if (!indexDef) {
                // Setup default index field definitions, if not defined in definition.
                indexDefs[indexName] = { private: keepPrivate, index: true, integer: isInt };
            } else {
                // If the field is defined in definitions—-but doesn't have index metadata, add it.
                if (!indexDef.index) model.definition[index].index = true;
                if (!indexDef.integer && isInt) model.definition[index].integer = true;
            }
        });
    }

    // Extend model definition with any index definions defined above AND any default
    // provided the field is not already defined in the existing definition
    model.addDefinition(_.omit(_.defaults(indexDefs, defaults.definition), Object.keys(model.definition)));

    // Set the Riak client
    model.setClient = function (client, override) {
        this.addOption('client', client, override);
        return this;
    };

    // Get the Riak client
    model.getClient = function () {
        if (this.options.client) return this.options.client;
        throw new Error('Please set a Riak client via setClient or options.client');
    };

    model.options.methods = model.options.methods||{};
    // Extend model with user supplied methods.
    _.extend(model, model.options.methods);
    // Extend model with default methods where a method of the same name
    // is not already defined.
    _.defaults(model, defaults.methods);

    // Compose instanceMethods
    model.options.instanceMethods = _.defaults(model.options.instanceMethods||{}, defaults.instanceMethods);
    // and apply them
    model.extendModel(model.options.instanceMethods);
}


module.exports = {
    VeryRiakModel: VeryRiakModel,
    riakifyModel: riakifyModel,
    defaults: defaults
};
