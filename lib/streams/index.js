var async   = require('async');
var stream  = require('stream');
var util    = require('util');

var FilteredIndexStream = require('./filtered-index');
var InstanceStream      = require('./instance');
var JSONStream          = require('./json-stream');
var KeyToValueStream    = require('./key-value');
var ModelStream         = require('./shared').ModelStream;

module.exports = {
    ModelStream             : ModelStream,
    InstanceStream          : InstanceStream,
    KeyToValueStream        : KeyToValueStream,
    FilteredIndexStream     : FilteredIndexStream,
    JSONStream              : JSONStream,
    filteredInstanceStream  : function (options) {
        options = options||{};
        var filterOptions = {
            model: options.model,
            search: options.search,
            filter: options.filter
        };
        if (options.limit) {
            filterOptions.limit = options.limit;
        }
        var instanceStream = new InstanceStream({model: options.model, callback: options.callback});
        var fiStream = new FilteredIndexStream(filterOptions);
        return fiStream.pipe(instanceStream);
    }
};
