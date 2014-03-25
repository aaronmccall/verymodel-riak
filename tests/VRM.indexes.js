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
    "can be specified via index property in definition": function (test) {
        test.expect(this.instance.indexes.length);
        this.instance.indexes.forEach(function (index) {
            var match =  _.findWhere(riak_data[0].content[0].indexes, index);
            test.ok(match);
        });
        test.done();
    },
    "can be created with an index transform function": function (test) {
        var model = new veryriak.VeryRiakModel({
            complex: {index: function (complex) { complex.unshift('foo'); return complex.join(':'); }}
        });
        var instance = model.create({ complex: ['bar','baz']});
        var indexes = instance.indexes;
        test.ok(indexes.length);
        test.ok(_.findWhere(indexes, {key: 'complex_bin'}));
        test.ok(_.isEqual(_.findWhere(indexes, {key: 'complex_bin'}), {key: 'complex_bin', value: 'foo:bar:baz'}));
        test.done();
    },
    "index in definition can be a string index name": function (test) {
        this.model.addDefinition({ foo: {index: 'bar', required: true, default: 'baz'}});
        var instance = this.model.create(),
            indexes = instance.indexes,
            indexesToData = this.model.indexesToData(instance.indexes);
        test.ok(_(indexes).findWhere({key: 'bar_bin', value: 'baz'}));
        test.ok(_(indexesToData).has('foo'));
        test.equal(indexesToData.foo, 'baz');
        test.done();
    },
    "multi-value indexes can be specified via isArray": function (test) {
        var model = new veryriak.VeryRiakModel({
            arr: {index: true, isArray: true}
        });
        var instance = model.create({ arr: ['bar','baz'] });
        var indexes = instance.indexes;
        test.ok(indexes.length);
        test.equal(_.where(indexes, {key: 'arr_bin'}).length, instance.arr.length);
        test.ok(_.findWhere(indexes, {key: 'arr_bin', value: 'bar'}));
        test.ok(_.findWhere(indexes, {key: 'arr_bin', value: 'baz'}));
        test.done();
    },
    "complex, multi-value indexes can be created with isArray and an index function": function (test) {
        var model = new veryriak.VeryRiakModel({
            comp_multi: {
                index: function (comp_multi) {
                    return _.chain(comp_multi).map(function (values, key) {
                        return _.map(values, function (value) {
                            // for each property in the comp_multi object
                            // each value in its values array namespaced by the
                            // property's name
                            return [key, value].join(':');
                        });
                    // flatten the resulting array of arrays to a single level
                    }).flatten().value();
                    // given an object: { foo: [1,2], bar: [3,4] }
                    // the map results in: [["foo:1", "foo:2"], ["bar:3", "bar:4"]]
                    // and after flatten it becomes: ["foo:1", "foo:2", "bar:3", "bar:4"]
                },
                isArray: true
            }
        });
        var instance = model.create({ comp_multi: { foo: [1,2], bar: [3,4] }});
        var indexes = _.where(instance.indexes, {key: 'comp_multi_bin'});
        test.expect(indexes.length + 1);
        test.equal(indexes.length, instance.comp_multi.foo.length + instance.comp_multi.bar.length);
        _.each(instance.comp_multi, function (values, key) {
            values.forEach(function (value) {
                test.ok(_.findWhere(indexes, {key: 'comp_multi_bin', value: [key, value].join(':')}));
            });
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