var _       = require('underscore');
var riak    = require('./lib/fakeriak');
var veryriak     = require('./');
var fixtures = require('./lib/fixtures');
var def = fixtures.def,
    opts = fixtures.opts,
    data = fixtures.data,
    riak_data = fixtures.riak.data;

var client = opts.client = riak.init(fixtures.riak);

module.exports = {
    indexes: {
        setUp: function (cb) {
            this.model = new veryriak.VeryRiakModel(def, opts);
            this.instance = this.model.create(data[0]);
            cb();
        },
        autocreate_fields_from_indexes_option: function (test) {
            var self = this;
            test.expect(opts.indexes.length);
            opts.indexes.forEach(function (index) {
                index = Array.isArray(index) ? index[0] : index;
                var def = self.model.definition[index];
                test.ok(def.index);
            });
            test.done();
        },
        autocreated_fields_are_private_by_default: function (test) {
            var self = this,
                indexes = _.compact(_.map(opts.indexes, function (index) {
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
        array_options_with_false_third_member_are_public: function (test) {
            var self = this,
                indexes = _.compact(_.map(opts.indexes, function (index) {
                    return Array.isArray(index) ? ((index[2]===false) && index[0]) : false;
                }));
            test.expect(indexes.length);
            indexes.forEach(function (index) {
                var def = self.model.definition[index];
                test.ok(!def.private);
            });
            test.done();
        },
        array_options_can_specify_integer_as_second_member: function (test) {
            var self = this,
                isInts = _.compact(_.map(opts.indexes, function (index) {
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
        can_be_specified_via_index_property_in_definition: function (test) {
            test.expect(this.instance.indexes.length);
            this.instance.indexes.forEach(function (index) {
                var match = _.findWhere(riak_data[0].content[0].indexes, index);
                test.ok(match);
            });
            test.done();
        },
        riak_index_keys_are_suffixed_with_int_if_integer_is_truthy: function (test) {
            var indexes = _.compact(_.map(this.model.definition, function (def, key) {
                return (def.index && def.integer) && key || false;
            })), riak_indexes = this.instance.indexes;
            test.expect(indexes.length);
            indexes.forEach(function (index) {
                test.ok(_.findWhere(riak_indexes, {key: index + '_int'}));
            });
            test.done();
        },
        riak_index_keys_are_suffixed_with_bin_if_integer_isnt_truthy: function (test) {
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
    _: {
        '_ - _ - _ - _ - _ - _ -': function (test) { test.done(); }
    },
    ORM: {
        model:      {
                        setUp: function (cb) {
                            this.model = new veryriak.VeryRiakModel(def, opts);
                            this.instance = this.model.create(data[0]);
                            client.resetCalls();
                            cb();
                        },
                        "#all_calls_riak.getIndex_if_allKey_is_valid": function (test) {
                            test.ok(this.model.getAllKey(), 'model does not have a valid allKey');
                            this.model.all(function (err, list) {
                                test.ok(client.getCalls('getIndex').length, 'getIndex was not called');
                            });
                            test.done();
                        },
                        "#all_calls_riak.getKeys_if_allKey_is_invalid": function (test) {
                            var oldAllKey = this.model.opts.allKey,
                                self = this;
                            this.model.opts.allKey = undefined;
                            test.ok(!this.model.getAllKey(), 'model has a valid allKey');
                            this.model.all(function (err, list) {
                                test.ok(client.getCalls('getKeys').length, 'getKeys was not called');
                                self.model.opts.allKey = oldAllKey;
                                test.done();
                            });
                        },
                        "#all_returns_an_array": function (test) {
                            this.model.all(function (err, instances) {
                                test.ok(Array.isArray(instances));
                                test.done();
                            });
                        },
                        "#all_calls_riak.get_once_for_each_instance": function (test) {
                            this.model.all(function (err, instances) {
                                test.ok(Array.isArray(instances));
                                test.equal(client.getCalls('get').length, instances.length);
                                test.done();
                            });
                        },
                        "#load_calls_riak.get": function (test) {
                            this.model.load('foobarbazbiz', function () {
                                test.ok(client.getCalls('get').length);
                                test.done();
                            });
                        },
                        "#remove_calls": function (test) {
                            this.model.remove('foobarbazbiz', function () {
                                test.ok(client.getCalls('del').length);
                                test.done();
                            });
                        }
                    },
        instance:   {
                        setUp: function (cb) {
                            this.model = new veryriak.VeryRiakModel(def, opts);
                            this.instance = this.model.create(data[0]);
                            client.resetCalls();
                            cb();
                        },
                        "#save_calls_riak.put_twice_when_there_are_siblings": function (test) {
                            this.instance.save(function () {
                                setTimeout(function () {
                                    test.ok(client.getCalls('put').length===2, 'put was called ' + client.getCalls('put').length);
                                    test.done();
                                }, 25);
                            });
                        }
                    }
    }
};
/*
function (test) {

            test.done();
        }
*/