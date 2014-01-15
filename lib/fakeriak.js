var _ = require('underscore'),
    calls = {},
    opts = {};


function getIndexes(riak_data) {
    return _.reduce(riak_data, function (indexes, data) {
        _.each(data.content, function (content) {
            _.each(content.indexes, function (idx) {
                var index = indexes[idx.key];
                if (!index) {
                    index = (indexes[idx.key] = {});
                }
                var index_list = index[idx.value] || (index[idx.value] = []);
                if (index_list.indexOf(data.key) === -1) index_list.push(data.key);
            });
        });
        return indexes;
    }, {/*our indexes object*/});
}

module.exports = {
    init: function (options) {
        _.extend(opts, options);
        opts.indexes = (opts.data && getIndexes(opts.data));
        var self = this;
        Object.keys(this).forEach(function (key) {
            if ((['init', 'resetCalls', 'getCalls'].indexOf(key) < 0) && self.hasOwnProperty(key)) {
                calls[key] = [];
            }
        });
        return module.exports;
    },
    resetCalls: function () {
        Object.keys(calls).forEach(function (key) {
            calls[key] = [];
        });
    },
    getCalls: function (method) {
        return calls[method]||'';
    },
    getKeys: function (req, cb) {
        calls.getKeys.push(req);
        cb(null, {keys: _.pluck(opts.data, 'key')});
    },
    getIndex: function (req, cb) {
        calls.getIndex.push(req);
        var index = opts.indexes[req.index],
            list =  (index && index[req.key]) || [];
        cb(null, {keys: list});
    },
    get: function (req, cb) {
        calls.get.push(req);
        var content = _.findWhere(opts.data, {key: req.key});
        cb(null, content);
    },
    put: function (req, cb) {
        calls.put.push(req);
        cb(null, _.findWhere(opts.data, {key: req.key}));
    },
    del: function (req, cb) {
        calls.del.push(req);
        cb(null);
    }
};