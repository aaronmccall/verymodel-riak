var _           = require('underscore');
var riak        = require('../lib/fakeriak');
var veryriak    = require('../');
var fixtures    = require('../lib/fixtures');
var def         = fixtures.def,
    options     = fixtures.options,
    data        = fixtures.data,
    riak_data   = fixtures.riak.data;

var client = options.client = riak.init(fixtures.riak);

function setup(cb) {
    this.model = new veryriak.VeryRiakModel(def, options);
    this.instance = this.model.create(data[0]);
    client.resetCalls();
    cb();
}

module.exports = {
    model: {
        setUp: setup,
        "#all calls riak.getIndex": function (test) {
            test.expect(2);
            test.ok(this.model.getAllKey(), 'model does not have a valid allKey');
            this.model.all(function () {
                test.ok(client.getCalls('getIndex').length, 'getIndex was not called');
                test.done();
            });
        },
        "#all sends an array": function (test) {
            test.expect(1);
            this.model.all(function (err, instances) {
                test.ok(Array.isArray(instances));
                test.done();
            });
        },
        "#all calls riak.get once for each instance": function (test) {
            test.expect(2);
            this.model.all(function (err, instances) {
                test.ok(Array.isArray(instances));
                test.equal(client.getCalls('get').length, instances.length);
                test.done();
            });
        },
        "#all passes additional args to getRequest": function (test) {
            var oldGetRequest = this.model.getRequest,
                self = this;
            test.expect(3);
            this.model.getRequest = function () {
                test.equal(arguments.length, 3);
                var request = oldGetRequest.apply(this, arguments);
                test.equal(request.index, arguments[1]);
                test.equal(request.key, arguments[2]);
                return request;
            };
            this.model.all(function () {
                test.done();
                self.model.getRequest = oldGetRequest;
            }, 'foo', 'bar');
        },
        "#all paginates by default": function (test) {
            var model = this.model;
            test.expect(2);
            model.all(function () {
                var riakCall = client.getCalls('getIndex')[0];
                test.ok(riakCall.max_results);
                test.ok(model.continuation);
                test.done();
            });
        },
        "#all returns a readable Stream": function (test) {
            var Readable = require('stream').Readable;
            test.ok(this.model.all() instanceof Readable);
            test.ok(this.model.all(function () {}) instanceof Readable);
            test.done();
        },
        "#find calls all with cb moved to front of args": function (test) {
            var oldAll = this.model.all,
                fn = function () {},
                findArgs = ['index', 'key', fn];
            this.model.all = function () {
                var args = _.rest(arguments);
                test.equal(arguments[0], findArgs.pop());
                test.ok(_.isEqual(args, findArgs));
                this.all = oldAll;
                test.done();
            };
            this.model.find.apply(this.model, findArgs);
        },
        "#find simply proxies #all when no callback is supplied": function (test) {
            var oldAll = this.model.all,
                findArgs = ['index', 'key'];
            this.model.all = function () {
                var args = _.rest(arguments, 0);
                test.ok(_.isEqual(args, findArgs));
                this.all = oldAll;
                test.done();
            };
            this.model.find.apply(this.model, findArgs);
        },
        "#getAllKey returns $bucket as key when custom allKey isn't defined": function (test) {
            var myModel = new veryriak.VeryRiakModel({}, {bucket: 'foobar'});
            test.ok(_.isEqual(myModel.getAllKey(), {key: '$bucket', def: { default: 'foobar'}}));
            test.done();
        },
        "#getBucket throws when options.bucket isn't set": function (test) {
            test.throws(function () {
                (new veryriak.VeryRiakModel()).getBucket();
            }, Error);
            test.done();
        },
        "#getBucket returns options.bucket by default": function (test) {
            test.equal(this.model.getBucket(), this.model.options.bucket);
            test.done();
        },
        "#indexesToData translates reply.content.indexes properly": function (test) {
            var translated = this.model.indexesToData(riak_data[0].content.indexes);
            test.expect(Object.keys(translated).length);
            _.each(translated, function (val, key) {
                test.equal(this.instance[key], val, 'instance["' + key + '"] is not ' + val);
            });
            test.done();
        },
        "#load calls riak.get": function (test) {
            test.expect(1);
            this.model.load(this.instance.id, function () {
                test.ok(client.getCalls('get').length);
                test.done();
            });
        },
        "#remove calls riak.del": function (test) {
            test.expect(1);
            this.model.remove(this.instance.id, function () {
                test.ok(client.getCalls('del').length);
                test.done();
            });
        },
        "#replyToData translates reply.content as expected": function (test) {
            test.ok(_.isEqual(data[0], _.omit(this.model.replyToData(riak_data[0]), 'vclock')));
            test.done();
        }
    },
    instance: {
        setUp: setup,
        "#save calls riak.put twice when there are siblings": function (test) {
            test.expect(1);
            this.instance.save(function () {
                setTimeout(function () {
                    test.ok(client.getCalls('put').length===2, 'put was called ' + client.getCalls('put').length);
                    test.done();
                }, 25);
            });
        },
        "#value contains all public fields except options.keyField by default": function (test) {
            var self = this;
            var valueKeys = Object.keys(this.instance.value);
            var publicKeys = _.compact(_.map(this.model.definition, function (def, key) {
                if (!def.private && (key !== self.model.options.keyField)) {
                    return key;
                }
            }));
            test.equal(valueKeys.length, publicKeys.length, [valueKeys.join('|'), publicKeys.join('|')]);
            test.ok(_.isEqual(valueKeys, publicKeys));
            test.done();
        },
    }
};
/*
function (test) {

            test.done();
        }
*/