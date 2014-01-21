var _ = require('underscore');
var veryriak = require('../');

module.exports = {
    setUp: function (cb) {
        this.model = new veryriak.VeryRiakModel({});
        cb();
    },
    "model definition is defaults.definition by default": function (test) {
        var model = this.model,
            definition = Object.keys(veryriak.defaults.definition);
        test.expect(definition.length);
        definition.forEach(function (name) {
            test.ok(_.isEqual(model.definition[name], veryriak.defaults.definition[name]));
        });
        test.done();
    },
    "model options are defaults.options by default": function (test) {
        var model = this.model,
            options = Object.keys(veryriak.defaults.options);
        test.expect(options.length);
        options.forEach(function (name) {
            test.strictEqual(model.options[name], veryriak.defaults.options[name]);
        });
        test.done();
    },
    "methods are defaults.methods by default": function (test) {
        var model = this.model,
            methods = Object.keys(veryriak.defaults.methods);
        test.expect(methods.length);
        methods.forEach(function (name) {
            test.strictEqual(model[name], veryriak.defaults.methods[name]);
        });
        test.done();
    },
    "instance methods are defaults.instanceMethods by default": function (test) {
        var model = this.model,
            instance = model.create(),
            instanceMethods = Object.keys(veryriak.defaults.instanceMethods);
        test.expect(instanceMethods.length);
        instanceMethods.forEach(function (name) {
            test.strictEqual(instance[name], veryriak.defaults.instanceMethods[name]);
        });
        test.done();
    }
};