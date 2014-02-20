var RiakQuery = require('../lib/query');
var riak = require('../lib/fakeriak');
var fixtures = require('../lib/fixtures');
var client = riak.init(fixtures.riak);
var bucket = 'foo';

module.exports = {
    setUp: function (cb) {
        this.query = new RiakQuery(bucket, client);
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
    "#_req.defaults adds content_type and return_body": function (test) {
        var request = this.query._req._defaults(this.query).value();
        test.equal(request.content_type, 'application/json');
        test.equal(request.return_body, true);
        test.done();
    },
    "#get, #find, #search, and #mapreduce return query": function (test) {
        var methods = ['get', 'find', 'search', 'mapreduce'],
            self = this;
        test.expect(methods.length);
        methods.forEach(function (method) {
            test.strictEqual(self.query[method](), self.query, method + ' returns query');
        });
        test.done();
    },
    "#get, #put, and #del set type and key": function (test) {
        var key = 'bar',
            methods = ['del', 'get', 'put'];
        this.query.payload = {};
        methods.forEach(function (method) {
            var q = this.query[method](key);
            test.equal(q.type, method);
            test.equal(q.key, key);
        }, this);
        test.done();
    },
    "#find and #search set type, index, and key": function (test) {
        var methods = ['find', 'search'],
            index = 'bar',
            key = 'baz';
        methods.forEach(function (method) {
            var q = this.query.find(index, key);
            test.equal(q.index, 'bar');
            test.equal(q.key, 'baz');
            test.equal(q.type, 'index');
        }, this);
        test.done();
    },
    "#mapreduce sets type, inputs, and query": function (test) {
        
        test.done();
    }
    
    /*
    ,
    "": function (test) {
        
        test.done();
    }
    */
};