var _ = require('underscore');
var fixtures = require('../lib/fixtures');
var veryriak    = require('../');
var helpers = require('../lib/request_helpers');

function keyTest(type, test) {
    var key = 'foobarbazbiz';
    test.ok(_.isEqual(
        helpers[type](this.model, [key]),
        helpers[type](this.model, [{key: key}])
    ));
    test.done();
}

function twoArgTest(type, first, second, test) {
    var keyName = (type==='index') ? 'key' : 'q',
        options = {index: first};
    options[keyName] = second;
    test.ok(_.isEqual(
        helpers[type](this.model, [first, second]),
        helpers[type](this.model, [options])
    ));
    test.done();
}

function threeArgTest(type, one, two, three, test) {
    var lastKey = (type==='index') ? 'range_max' : 'query',
        options = {};
    if (type==='index') {
        options.index = one;
        options.range_min = two;
    } else {
        options.inputs = {};
        options.inputs.index = one;
        options.inputs.key = two;
    }
    options[lastKey] = three;
    test.ok(_.isEqual(
        helpers[type](this.model, [one, two, three]),
        helpers[type](this.model, [options])
    ));
    test.done();
}

module.exports = {
    setUp: function (cb) {
        this.model = new veryriak.VeryRiakModel(fixtures.def, fixtures.options);
        cb();
    },
    'equivalent get calls return properly': _.partial(keyTest, 'get'),
    'get can take an optional bucket argument': function (test) {
        var result = helpers.get(this.model, ['fibfab', 'jibberjabber']);
        test.equal(result.bucket, 'jibberjabber');
        test.done();
    },
    "equivalent index exact match calls return properly": _.partial(twoArgTest, 'index', 'subjects', 'math:algebra'),
    "equivalent index range calls return properly": _.partial(threeArgTest, 'index', 'grade_level', 1, 5),
    "equivalent search calls return properly": _.partial(twoArgTest, 'search', 'subjects', 'science:biology'),
    "equivalent mapreduce calls return properly": _.partial(threeArgTest, 'mapreduce', 'foobar', 'bazbiz', []),
    "equivalent del calls return properly": _.partial(keyTest, 'del')
};