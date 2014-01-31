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
        var key = 'foobarbazbiz';
        test.ok(
            _.isEqual(helpers.get(this.model, [key]), helpers.get(this.model, [{key: key}])),
            'strings and str_and_obj are NOT the same'
        );
        test.done();
    },
    "equivalent index exact match calls return properly": function (test) {
        var index = 'subject',
            key = 'math:algebra';
        test.ok(
            _.isEqual(
                helpers.index(this.model, [index, key]),
                helpers.index(this.model, [{index: index, key: key}])
            ),
            'strings and str_and_obj are NOT the same'
        );
        test.done();
    },
    "equivalent index range calls return properly": function (test) {
        var index = 'grade_level',
            min = 1,
            max = 5;
        test.ok(
            _.isEqual(
                helpers.index(this.model, [index, min, max]),
                helpers.index(this.model, [{index: index, range_min: min, range_max: max}])
            ),
            'strings and str_and_obj are NOT the same'
        );
        test.done();
    },
    "equivalent search calls return properly": function (test) {
        var index = 'foobar',
            q = 'name:bazbiz';
        test.ok(
            _.isEqual(
                helpers.search(this.model, [index, q]),
                helpers.search(this.model, [{index: index, q: q}])
            ),
            'strings and str_and_obj are NOT the same'
        );
        test.done();
    },
    "equivalent mapreduce calls return properly": function (test) {
        var index = 'foobar',
            key = 'bazbiz',
            query = [];
        test.ok(
            _.isEqual(
                helpers.mapreduce(this.model, [index, key, query]),
                helpers.mapreduce(this.model, [{ inputs: { index: index, key: key}, query: query}])
            ),
            'strings and str_and_obj are NOT the same'
        );
        test.done();
    },
    "equivalent del calls return properly": function (test) {
        var key = 'foobarbazbiz';
        test.ok(
            _.isEqual(
                helpers.del(this.model, [key]),
                helpers.del(this.model, [{key: key}])
            ),
            'strings and str_and_obj are NOT the same'
        );
        test.done();
    }
};