var _ = require('underscore');
var printf = require('util').format;
var RiakQuery = require('../lib/query');
var riak = require('../lib/fakeriak');
var fixtures = require('../lib/fixtures');
var client = riak.init(fixtures.riak);
var bucket = 'foo';
var methods = ['del', 'get', 'index', 'mapreduce', 'put', 'search'];
var baseReq;
module.exports = {
    setUp: function (cb) {
        this.query = new RiakQuery(bucket, client);
        baseReq = this.query._req._defaults(this.query);
        cb();
    },
    tearDown: function (cb) {
        client.resetCalls();
        cb();
    },
    "bucket and client are set properly when passed as args": function (test) {
        test.equal(this.query.bucket, bucket, "bucket is set properly");
        test.equal(this.query.client, client, "client is set properly");
        test.done();
    },
    "by default query type is undefined": function (test) {
        test.strictEqual(this.query.type, undefined, "query type is undefined: " + this.query.type);
        test.done();
    },
    "all methods return query": function (test) {
        var self = this;
        test.expect(methods.length);
        methods.forEach(function (method) {
            test.strictEqual(self.query[method](), self.query, method + ' returns query');
        });
        test.done();
    },
    "all methods set type": function (test) {
        var self = this;
        test.expect(methods.length);
        methods.forEach(function (method) {
            self.query[method]();
            test.strictEqual(self.query.type, method, method + ' sets type to ' + method);
            self.query.type = undefined;
        });
        test.done();
    },
    "#get, #put, and #del set key": function (test) {
        var key = 'bar',
            methods = ['del', 'get', 'put'];
        this.query.payload = {};
        methods.forEach(function (method) {
            var q = this.query[method](key);
            test.equal(q.key, key);
        }, this);
        test.done();
    },
    "#index (two arg) and #search set index and key": function (test) {
        var methods = ['index', 'search'],
            index = 'bar',
            key = 'baz';
        methods.forEach(function (method) {
            var q = this.query[method](index, key);
            test.equal(q.index, 'bar', method + ' set index properly');
            test.equal(q.key, 'baz', method + ' set key properly');
        }, this);
        test.done();
    },
    "#index (three arg) sets index, range_min, range_max": function (test) {
        var index = 'foo', min = 1, max = 10, q =this.query.index(index, min, max);
        test.equal(q.index, index, 'index as expected');
        test.equal(q.range_min, min, 'range_min set correctly');
        test.equal(q.range_max, max, 'range_max set correctly');
        test.done();
    },
    "#mapreduce sets inputs, and query": function (test) {
        var inputs = {}, query = [];
        this.query.mapreduce(inputs, query);
        test.equal(this.query.inputs, inputs, 'inputs set correctly');
        test.equal(this.query.query, query, 'query set correctly');
        test.done();
    },
    "#_req.defaults adds bucket, key, content_type, and return_body": function (test) {
        var request = this.query._req._defaults(this.query);
        test.equal(request.content_type, 'application/json');
        test.equal(request.bucket, this.query.bucket);
        test.equal(request.key, this.query.key);
        test.done();
    },
    "#_req.get adds key to base request": function (test) {
        test.equal(this.query.key, undefined, 'key starts as undefined');
        var req = this.query.get('bar')._req.key.call(this.query);
        test.equal(this.query.key, 'bar', 'key should be \'bar\'');
        test.done();
    },
    "#_req.put adds bucket, key, and content to base request": function (test) {
        var payload = {value: {baz: 'biz'}},
            req = this.query.put('bar').setPayload(payload)._req.key.call(this.query, 'put'),
            expected = _.extend({}, baseReq, {bucket: req.bucket, key: req.key, content: req.content });
        test.ok(_.isEqual(expected, req), JSON.stringify({expected: expected, actual: req}));
        test.done();
    }
    
    /*
    ,
    "": function (test) {
        
        test.done();
    }
    */
};