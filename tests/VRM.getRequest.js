var _           = require('underscore');
var veryriak    = require('../');
var fixtures    = require('../lib/fixtures');
var def         = fixtures.def,
    options     = fixtures.options;

var request_helpers = require('../lib/request_helpers');
var calls = {};
var helpers = _.object(_.map(request_helpers, function (fn, name) {
    calls[name] = [];
    var wrapped = function () {
        calls[name].push(_.rest(arguments, 0));
        fn.apply(request_helpers, arguments);
    };
    wrapped.original = fn;
    return [name, wrapped];
}));

module.exports = {
    setUp: function (cb) {
        this.model = new veryriak.VeryRiakModel(def, options);
        Object.keys(helpers).forEach(function (key) {
            request_helpers[key] = helpers[key];
        });
        cb();
    },
    tearDown: function (cb) {
        Object.keys(helpers).forEach(function (key) {
            request_helpers[key] = helpers[key].original;
            calls[key] = [];
        });
        cb();
    },
    "object-only get calls are translated properly": function (test) {
        var key = 'foobarbazbiz';
        this.model.getRequest('get', {key: key});
        this.model.getRequest({type: 'get', options: {key: key}});
        test.equal(calls.get.length, 2);
        test.ok(_.isEqual(calls.get[0], calls.get[1]));
        test.done();
    },
    "object-only index exact match calls are translated properly": function (test) {
        var index = 'foobar',
            key = 'bazbiz';
        this.model.getRequest('index', {index: index, key: key});
        this.model.getRequest({type: 'index', options: {index: index, key: key}});
        test.ok(_.isEqual(calls.index[0], calls.index[1]));
        test.done();
    },
    "object-only index range calls are translated properly": function (test) {
        var index = 'foobar',
            min = 'bazbiz',
            max = 'zibzab';
        this.model.getRequest('index', {index: index, range_min: min, range_max: max});
        this.model.getRequest({type: 'index', options: {index: index, range_min: min, range_max: max}});
        test.equal(calls.index.length, 2);
        test.ok(_.isEqual(calls.index[0], calls.index[1]));
        test.done();
    },
    "object-only search calls are translated properly": function (test) {
        var index = 'foobar',
            q = 'name:bazbiz';
        this.model.getRequest('search', {index: index, q: q});
        this.model.getRequest({type: 'search', options: {index: index, q: q}});
        test.equal(calls.search.length, 2);
        test.ok(_.isEqual(calls.search[0], calls.search[1]));
        test.done();
    },
    "object-only mapreduce calls are translated properly": function (test) {
        var index = 'foobar',
            key = 'bazbiz',
            query = [];
        this.model.getRequest('mapreduce', { inputs: { index: index, key: key}, query: query});
        this.model.getRequest({
                type: 'mapreduce',
                options: {
                    inputs: {index: index, key: key},
                    query: query
                }
            });
        test.equal(calls.mapreduce.length, 2);
        test.ok(_.isEqual(calls.mapreduce[0], calls.mapreduce[1]));
        test.done();
    },
    "object-only del calls are translated properly": function (test) {
        var id = 'foobarbazbiz';
        this.model.getRequest('del', {key: id});
        this.model.getRequest({type: 'del', options: {key: id}});
        test.equal(calls.del.length, 2);
        test.ok(_.isEqual(calls.del[0], calls.del[1]));
        test.done();
    }
};