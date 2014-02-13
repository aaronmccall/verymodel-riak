var _ = require('underscore');

function ensureBucket(payload, obj) {
    if (payload && !payload.bucket) {
        payload.bucket = obj.getBucket();
    }
    return payload;
}

function build_get_request(obj, args) {
    var payload = {};
    if (args && typeof args[0] === 'string') {
        payload.key = args[0];
    } else if (typeof args[0] === 'object') {
        _.extend(payload, args[0]);
    }
    if (args[1]) payload.bucket = args[1];
    return ensureBucket(payload, obj);
}

function build_index_request(obj, args) {
    var argLen  = args.length,
        payload = { qtype: 0 };
    // handle _getIndex('my_index', 'my_key') and 
    // _getIndex('my_index', 'range_min', 'range_max')
    if (argLen > 1) {
        payload.index = args[0];
        if (argLen === 3) {
            payload.qtype = 1;
            payload.range_min = args[1];
            payload.range_max = args[2];
            payload.qtype = 1;
        } else {
            payload.key = args[1];
        }
    }
    // handle _getIndex({myOpts})
    if (_.isObject(args[0])) {
        _.extend(payload, args[0]);
    }
    // handle passing of opts without index/key
    if (!payload.index && !payload.key) {
        var allKey  = obj.getAllKey();
        payload.index = allKey.key;
        payload.key = allKey.def.default;
    }
    if (payload.range_min && payload.qtype === 0) payload.qtype = 1;
    if (obj.options.paginate && obj.options.max_results) {
        if (obj.continuation) payload.continuation = obj.continuation;
        payload.max_results = obj.options.max_results;
    }

    return ensureBucket(payload, obj);
}

function build_search_request(obj, args) {
    var argLen  = args.length,
        payload = {};

    if (argLen > 1) {
        payload.index = args[0];
        payload.q = args[1];
    }
    _.extend(payload, (_.isObject(args[0]) ? args[0] : {}));
    if (obj.options.paginate && obj.options.max_results && obj.next) {
        payload.start = obj.next;
        payload.rows = obj.options.max_results;
    }
    return ensureBucket(payload, obj);
}

function build_mapreduce_request(obj, args) {
    var arg0isArray = (args[0] && Array.isArray(args[0])),
        payload = {};
    if (args.length === 3 || arg0isArray) {

        payload.inputs = arg0isArray ? args[0] : {
            index: args[0],
            key: args[1]
        };
        payload.query = arg0isArray ? args[1] : args[2];
    }
    _.extend(payload, (_.isObject(args[0]) ? args[0] : {}));
    if (payload.inputs && payload.inputs.index && !payload.inputs.bucket) {
        payload.inputs = ensureBucket(payload.inputs, obj);
    }
    return payload;
}

module.exports = {
    get: build_get_request,
    index: build_index_request,
    search: build_search_request,
    mapreduce: build_mapreduce_request,
    del: build_get_request
};