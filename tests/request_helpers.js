var _ = require('underscore');
var fixtures = require('../lib/fixtures');
var veryriak    = require('../');
var helpers = require('../lib/request_helpers');

module.exports = {
    setUp: function (cb) {
        this.model = new veryriak.VeryRiakModel(fixtures.def, fixtures.options);
        cb();
    },
    'equivalent get calls return properly': function (test) {
        var key = 'foobarbazbiz',
            strings = helpers.get(this.model, [key]),
            str_and_obj = helpers.get(this.model, [{key: key}]);
        test.ok(_.isEqual(strings, str_and_obj), 'strings and str_and_obj are NOT the same' + JSON.stringify([strings, str_and_obj], null, 2));
        test.done();
    },
    "equivalent index exact match calls return properly": function (test) {
        var index = 'foobar',
            key = 'bazbiz',
            strings = helpers.index(this.model, [index, key]),
            str_and_obj = helpers.index(this.model, [{index: index, key: key}]);
        test.ok(_.isEqual(strings, str_and_obj), 'strings and str_and_obj are NOT the same');
        test.done();
    },
    "equivalent index range calls return properly": function (test) {
        var index = 'foobar',
            min = 'bazbiz',
            max = 'zibzab',
            strings = helpers.index(this.model, [index, min, max]),
            str_and_obj = helpers.index(this.model, [{index: index, range_min: min, range_max: max}]);
        test.ok(_.isEqual(strings, str_and_obj), 'strings and str_and_obj are NOT the same');
        test.done();
    },
    "equivalent search calls return properly": function (test) {
        var index = 'foobar',
            q = 'name:bazbiz',
            strings = helpers.search(this.model, [index, q]),
            str_and_obj = helpers.search(this.model, [{index: index, q: q}]);
        test.ok(_.isEqual(strings, str_and_obj), 'strings and str_and_obj are NOT the same');
        test.done();
    },
    "equivalent mapreduce calls return properly": function (test) {
        var index = 'foobar',
            key = 'bazbiz',
            query = [],
            strings = helpers.mapreduce(this.model, [index, key, query]),
            str_and_obj = helpers.mapreduce(this.model, [{ inputs: { index: index, key: key}, query: query}]);
        test.ok(_.isEqual(strings, str_and_obj), 'strings and str_and_obj are NOT the same');
        test.done();
    },
    "equivalent del calls return properly": function (test) {
        var key = 'foobarbazbiz',
            strings = helpers.del(this.model, [key]),
            str_and_obj = helpers.del(this.model, [{key: key}]);
        test.ok(_.isEqual(strings, str_and_obj), 'strings and str_and_obj are NOT the same' + JSON.stringify([strings, str_and_obj], null, 2));
        test.done();
    }
};