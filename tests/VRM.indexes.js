var _           = require('underscore');
var veryriak    = require('../');
var fixtures    = require('../lib/fixtures');
var def         = fixtures.def,
    options     = fixtures.options,
    data        = fixtures.data,
    riak_data   = fixtures.riak.data;

module.exports = {
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
    "riak index keys are suffixed with bin if integer isn't truthy": function (test) {
        var indexes = _.compact(_.map(this.model.definition, function (def, key) {
            return (def.index && !def.integer) && key || false;
        })), riak_indexes = this.instance.indexes;
        test.expect(indexes.length);
        indexes.forEach(function (index) {
            test.ok(_.findWhere(riak_indexes, {key: index + '_bin'}));
        });
        test.done();
    }
};