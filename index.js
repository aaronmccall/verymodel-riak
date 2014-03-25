var VeryModel   = require('verymodel').VeryModel;
var _           = require('underscore');
var defaults    = require('./lib/defaults');
var indexes     = require('./lib/indexes');
var streams     = require('./lib/streams');

function VeryRiakModel(definition, options) {
    VeryModel.call(this, _.defaults(definition, defaults.definition), options);
    riakifyModel(this);
}

VeryRiakModel.prototype = Object.create(VeryModel.prototype);

var oldAddDefinition = VeryModel.prototype.addDefinition;
function addDefinition(definition) {
    oldAddDefinition.call(this, definition);
    indexes.makeMap(this);
}
VeryRiakModel.prototype.addDefinition = addDefinition;

// Add Riak extensions to model factory
function riakifyModel(model) {
    // Extend options with any default options that aren't already defined
    _.defaults(model.options, defaults.options);

    var opts = model.options;

    if (!opts.client && opts.riak) {
        opts.client = require('riakpbc').createClient(opts.riak);
    }

    if (!opts.logger && opts.loggerConfig) {
        opts.logger = require('bucker').createLogger(opts.loggerConfig);
    }

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

    
    model.options.methods = _.defaults(model.options.methods||{}, defaults.methods);
    // Extend model with user supplied methods and/or with default methods
    // where a method of the same name is not already defined.
    _.extend(model, model.options.methods);
    

    // Compose instanceMethods
    model.options.instanceMethods = _.defaults(model.options.instanceMethods||{}, defaults.instanceMethods);
    // and apply them
    model.extendModel(model.options.instanceMethods);
}



module.exports = {
    VeryRiakModel   : VeryRiakModel,
    riakifyModel    : riakifyModel,
    defaults        : defaults,
    streams         : streams
};
