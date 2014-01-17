var _ = require('underscore');

function build_get_request(obj, args) {
    var payload = { bucket: obj.getBucket() };
    if (args && typeof args[0] === 'string') {
        payload.key = args[0];
    } else if (typeof args[0] === 'object') {
        _.extend(payload, args[0]);
    }
    return payload;
}

function build_index_request(obj, args) {
    var argLen  = args.length,
        payload = { bucket: obj.getBucket(), qtype: 0 };

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
    } else if (argLen === 0) {
        var allKey  = obj.getAllKey();
        payload.index = allKey.key;
        payload.key = allKey.def.default;
    }
    _.extend(payload, (_.isObject(args[0]) ? args[0] : {}));
    if (payload.range_min && payload.qtype === 0) payload.qtype = 1;
    return payload;
}

function build_search_request(obj, args) {
    var argLen  = args.length,
        payload = { bucket: obj.getBucket() };

    if (argLen > 1) {
        payload.index = args[0];
        payload.q = args[1];
    }
    _.extend(payload, (_.isObject(args[0]) ? args[0] : {}));
    return payload;
}

function build_mapreduce_request(obj, args) {
    var arg0isArray = (args[0] && Array.isArray(args[0])),
        payload = {};
    if (args.length === 3 || arg0isArray) {

        payload.inputs = arg0isArray ? args[0] : {
            bucket: obj.getBucket(),
            index: args[0],
            key: args[1]
        };
        payload.query = arg0isArray ? args[1] : args[2];
    }
    _.extend(payload, (_.isObject(args[0]) ? args[0] : {}));
    if (payload.inputs && payload.inputs.index && !payload.inputs.bucket) {
        payload.inputs.bucket = obj.getBucket();
    }
    return payload;
}

// function (type) {
//         if (_.isObject(type) && type.type && type.options) {
//             return this.getRequest(type.type, type.options);
//         }
//         var args    = _.rest(arguments),
//             argLen  = args.length,
//             arg0isArray = (args[0] && Array.isArray(args[0])),
//             bucket  = (args[0] && args[0].bucket) || this.getBucket(),
//             allKey  = this.getAllKey(),
//             payload = {};
//         if (type !== 'mapreduce') payload.bucket = bucket;
//         if (type === 'index') payload.qtype = 0;
//         if (['search', 'index'].indexOf(type)>-1) {
//             if (argLen > 1) {
//                 payload.index = args[0];
//                 if (argLen === 2) payload[type==='index' ? 'key' : 'q'] = args[1];
//                 if (argLen === 3) {
//                     payload.qtype = 1;
//                     payload.range_min = args[1];
//                     payload.range_max = args[2];
//                     payload.qtype = 1;
//                 }
//             }
//             if (type === 'index' && argLen <1 ) {
//                 payload.index = allKey.key;
//                 payload.key = allKey.def.default;
//             }
//         } else if (['get', 'del'].indexOf(type)>-1 && typeof args[0] === 'string') {
//             payload.key = args[0];
//         } else if (type === 'mapreduce' && (argLen === 3 || arg0isArray)) {

//             payload.inputs = arg0isArray ? args[0] : {
//                 bucket: bucket,
//                 index: args[0],
//                 key: args[1]
//             };
//             payload.query = arg0isArray ? args[1] : args[2];
//         }
//         payload = _.extend(payload, (_.isObject(args[0]) ? args[0] : {}));
//         if (payload.range_min && payload.qtype === 0) payload.qtype = 1;
//         return payload;
//     }

module.exports = {
    get: build_get_request,
    index: build_index_request,
    search: build_search_request,
    mapreduce: build_mapreduce_request,
    del: build_get_request
};