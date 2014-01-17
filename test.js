var _           = require('underscore');
var riak        = require('./lib/fakeriak');
var veryriak    = require('./');
var fixtures    = require('./lib/fixtures');
var def         = fixtures.def,
    options     = fixtures.options,
    data        = fixtures.data,
    riak_data   = fixtures.riak.data;

var client = options.client = riak.init(fixtures.riak);

module.exports = {
    getRequest: {
        setUp: function (cb) {
            this.model = new veryriak.VeryRiakModel(def, options);
            cb();
        },
        'all equivalent get calls return properly': function (test) {
            var key = 'foobarbazbiz',
                strings = this.model.getRequest('get', key),
                str_and_obj = this.model.getRequest('get', {key: key}),
                obj_only = this.model.getRequest({type: 'get', options: {key: key}});
            test.ok(_.isEqual(strings, str_and_obj), 'strings and str_and_obj are NOT the same');
            test.ok(_.isEqual(str_and_obj, obj_only), 'str_and_obj and obj_only are NOT the same');
            test.done();
        },
        "all equivalent index exact match calls return properly": function (test) {
            var index = 'foobar',
                key = 'bazbiz',
                strings = this.model.getRequest('index', index, key),
                str_and_obj = this.model.getRequest('index', {index: index, key: key}),
                obj_only = this.model.getRequest({type: 'index', options: {index: index, key: key}});
            test.ok(_.isEqual(strings, str_and_obj), 'strings and str_and_obj are NOT the same');
            test.ok(_.isEqual(str_and_obj, obj_only), 'str_and_obj and obj_only are NOT the same');
            test.done();
        },
        "all equivalent index range calls return properly": function (test) {
            var index = 'foobar',
                min = 'bazbiz',
                max = 'zibzab',
                strings = this.model.getRequest('index', index, min, max),
                str_and_obj = this.model.getRequest('index', {index: index, range_min: min, range_max: max}),
                obj_only = this.model.getRequest({type: 'index', options: {index: index, range_min: min, range_max: max}});
            test.ok(_.isEqual(strings, str_and_obj), 'strings and str_and_obj are NOT the same: ' + JSON.stringify([strings, str_and_obj], null, 2));
            test.ok(_.isEqual(str_and_obj, obj_only), 'str_and_obj and obj_only are NOT the same');
            test.done();
        },
        "all equivalent search calls return properly": function (test) {
            var index = 'foobar',
                q = 'name:bazbiz',
                strings = this.model.getRequest('search', index, q),
                str_and_obj = this.model.getRequest('search', {index: index, q: q}),
                obj_only = this.model.getRequest({type: 'search', options: {index: index, q: q}});
            test.ok(_.isEqual(strings, str_and_obj), 'strings and str_and_obj are NOT the same');
            test.ok(_.isEqual(str_and_obj, obj_only), 'str_and_obj and obj_only are NOT the same');
            test.done();
        },
        "all equivalent mapreduce calls return properly": function (test) {
            var index = 'foobar',
                key = 'bazbiz',
                query = [],
                strings = this.model.getRequest('mapreduce', index, key, query),
                str_and_obj = this.model.getRequest('mapreduce', { inputs: { index: index, key: key}, query: query}),
                obj_only = this.model.getRequest({
                    type: 'mapreduce',
                    options: {
                        inputs: {index: index, key: key},
                        query: query
                    }
                });
            test.ok(_.isEqual(strings, str_and_obj), 'strings and str_and_obj are NOT the same: ' + JSON.stringify([strings, str_and_obj], null, 2));
            test.ok(_.isEqual(str_and_obj, obj_only), 'str_and_obj and obj_only are NOT the same');
            test.done();
        },
        "* all equivalent del calls return properly": function (test) {
            test.done();
        }
    },

    indexes: {
        setUp: function (cb) {
            this.model = new veryriak.VeryRiakModel(def, options);
            this.instance = this.model.create(data[0]);
            cb();
        },
        "autocreate fields from indexes option": function (test) {
            var self = this;
            test.expect(options.indexes.length);
            options.indexes.forEach(function (index) {
                index = Array.isArray(index) ? index[0] : index;
                var def = self.model.definition[index];
                test.ok(def.index);
            });
            test.done();
        },
        "autocreated fields are private by default": function (test) {
            var self = this,
                indexes = _.compact(_.map(options.indexes, function (index) {
                    // return index options that are NOT specified as private: false
                    return Array.isArray(index) ? (index[2]!==false && index[0]) : false;
                }));
            test.expect(indexes.length);
            indexes.forEach(function (index) {
                var def = self.model.definition[index];
                test.ok(def.private);
            });
            test.done();
        },
        "array options with false third member are public": function (test) {
            var self = this,
                indexes = _.compact(_.map(options.indexes, function (index) {
                    return Array.isArray(index) ? ((index[2]===false) && index[0]) : false;
                }));
            test.expect(indexes.length);
            indexes.forEach(function (index) {
                var def = self.model.definition[index];
                test.ok(!def.private);
            });
            test.done();
        },
        "array options can specify integer as second member": function (test) {
            var self = this,
                isInts = _.compact(_.map(options.indexes, function (index) {
                    if (Array.isArray(index)) {
                        return (index[1]) ? index[0] : false;
                    }
                }));
                test.expect(isInts.length);
                isInts.forEach(function (name) {
                    var def = self.model.definition[name];
                    test.ok(def.integer, 'def.integer for ' + name + ' is ' + def.integer);
                });
            test.done();
        },
        "can be specified via index property in definition": function (test) {
            test.expect(this.instance.indexes.length);
            this.instance.indexes.forEach(function (index) {
                var match =  _.findWhere(riak_data[0].content[0].indexes, index);
                test.ok(match);
            });
            test.done();
        },
        "riak index keys are suffixed with int if integer is truthy": function (test) {
            var indexes = _.compact(_.map(this.model.definition, function (def, key) {
                return (def.index && def.integer) && key || false;
            })), riak_indexes = this.instance.indexes;
            test.expect(indexes.length);
            indexes.forEach(function (index) {
                test.ok(_.findWhere(riak_indexes, {key: index + '_int'}));
            });
            test.done();
        },
        "riak index keys are suffixed with bin if integer isnt truthy": function (test) {
            var indexes = _.compact(_.map(this.model.definition, function (def, key) {
                return (def.index && !def.integer) && key || false;
            })), riak_indexes = this.instance.indexes;
            test.expect(indexes.length);
            indexes.forEach(function (index) {
                test.ok(_.findWhere(riak_indexes, {key: index + '_bin'}));
            });
            test.done();
        }
    },

    ORM: {
        model:      {
                        setUp: function (cb) {
                            this.model = new veryriak.VeryRiakModel(def, options);
                            this.instance = this.model.create(data[0]);
                            client.resetCalls();
                            cb();
                        },
                        "#all calls riak.getIndex if allKey is valid": function (test) {
                            test.expect(2);
                            test.ok(this.model.getAllKey(), 'model does not have a valid allKey');
                            this.model.all(function (err, list) {
                                test.ok(client.getCalls('getIndex').length, 'getIndex was not called');
                            });
                            test.done();
                        },
                        "#all returns an array": function (test) {
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
                        }
                    },
        instance:   {
                        setUp: function (cb) {
                            this.model = new veryriak.VeryRiakModel(def, options);
                            this.instance = this.model.create(data[0]);
                            client.resetCalls();
                            cb();
                        },
                        "#save calls riak.put twice when there are siblings": function (test) {
                            test.expect(1);
                            this.instance.save(function () {
                                setTimeout(function () {
                                    test.ok(client.getCalls('put').length===2, 'put was called ' + client.getCalls('put').length);
                                    test.done();
                                }, 25);
                            });
                        },
                        "#value doesn't contain id field by default": function (test) {
                            test.ok(!this.instance.value.id);
                            test.done();
                        }
                    }
    }
};
/*
function (test) {

            test.done();
        }
*/