var _ = require('underscore');

module.exports = {
    _defaults: function (self, keys) {
        var pickKeys = ['bucket', 'key'],
            defaults = {content_type: 'application/json'};
        if (Array.isArray(keys)) pickKeys = pickKeys.concat(keys);
        if (typeof keys === 'string') {
            if (keys !== 'return_body') {
                pickKeys.push(keys);
            } else {
                defaults.return_body = true;
            }
        }
        return _(self).chain().pick(pickKeys).defaults(defaults).value();
    },

    key: function (type) {
        var request = this._req._defaults(this);
        if (type=='put') {
            _.extend(request, this._req._prepContent(this.payload));
        }
        return request;
    },
    index_exact: function () {
        var payload = this._req._defaults(this, 'index');
        payload.qtype = 0;
        return payload;
    },
    index_range: function () {
        var keys = ['index', 'range_min', 'range_max'],
            payload = this._req._defaults(this, keys).omit('key').value();
        payload.qtype = 1;
        return payload;
    },
    mapreduce: function () {
        return {
            request: JSON.stringify({inputs: this.inputs, query: this.query}),
            content_type: 'application/json'
        };
    },
    search: function () {
        var payload = this._req.index_exact.call(this);
        payload.q = payload.key;
        return _.omit(payload, 'key', 'qtype', 'bucket');
    },
    _prepContent: function (payload) {
        if (!payload) throw new Error('RiakQuery#put requires a payload to be specified.');
        var content = _.pick(payload, 'value', 'indexes');
        if (typeof content.value === 'object') {
            content.value = JSON.stringify(content.value);
        }
        return {content: content};
    }
};