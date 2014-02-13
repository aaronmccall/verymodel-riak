var veryriak            = require('../');
var _                   = require('underscore');
var riak                = require('../lib/fakeriak');
var request_helpers     = require('../lib/request_helpers');
var fixtures            = require('../lib/fixtures');
var options             = _.extend({client: riak.init(fixtures.riak)}, fixtures.options);

var calls = {};
var helpers = _.object(_.map(request_helpers, function (fn, name) {
    calls[name] = [];
    var wrapped = function () {
        calls[name].push(_.rest(arguments, 0));
        return fn.apply(request_helpers, arguments);
    };
    wrapped.original = fn;
    return [name, wrapped];
}));

module.exports = {
    setUp: function (cb) {
        this.model = new veryriak.VeryRiakModel(fixtures.def, options);
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
    "passing bucket to find/all changes bucket for streams too": function (test) {
        var test_opts = {index: 'model_bin', key: 'person', bucket: 'foo:bucket'};
        test.expect(2);
        test.equal(this.model.getBucket(), options.bucket);
        var stream = this.model.find(test_opts, function (err, res) {
        });
        test.equal(stream._bucket, test_opts.bucket);
        test.done();
    }
};