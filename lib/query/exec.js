module.exports = {
    key: function (type) {
        var once = new StreamOne(),
            request = this._req.key.call(this, type);
        this.client[type](request, once.cb);
        if (this.callback) {
            once.on('data', _.partial(this.callback, null));
            once.on('error', this.callback);
        }
        return once;
    },
    index: function () {
        var self = this,
            request, payload, push;
        if (this.range_min) {
            request = this._req.index_range.call(this);
        } else {
            request = this._req.index_exact.call(this);
        }
        var indexStream = this.client.getIndex(request);
        if (this.callback) {
            payload = [];
            // push(array) is the equivalent of calling payload.push.apply(payload, array);
            push = payload.push.apply.bind(payload.push, payload);
            indexStream.on('error', this.callback);
            indexStream.on('data', function (reply) {
                if (reply.continuation) self.continuation = reply.continuation;
                if (reply.keys) push(reply.keys);
            });
            indexStream.on('end', function () {
                var cbPayload = {keys: payload};
                if (self.continuation) cbPayload.continuation = self.continuation;
                self.callback(null, cbPayload);
            }.bind(this));
        }
        return indexStream;
    },
    search: function () {
        var once = new StreamOne(),
            request = this._req.search.call(this);
        this.client.search(request, once.cb);
        if (this.callback) {
            once.on('data', _.partial(this.callback, null));
            once.on('error', this.callback);
        }
        return once;
    },
    mapreduce: function () {
        var request = this._req.mapreduce.call(this),
            readStream = this.client.mapred(request),
            payload;
        if (this.callback) {
            payload = [];
            pusher = payload.push.apply.bind(payload.push, payload);
            readStream.on('error', this.callback);
            readStream.on('data', function (data) { payload = payload.concat(data); });
            readStream.on('end', function () { this.callback(null, payload); });
        }
        return readStream;
    },
    mapreduce_index: function (cb) {
        var type = (this.range_min) ? 'range' : 'exact';
        this.inputs = _.omit(this._req['index_'+type].call(this), 'content_type', 'return_body');
        return this._exec.mapreduce.call(this);
    },
    mapreduce_search: function (cb) {
        this.inputs = _.omit(this._req.search.call(this), 'content_type', 'return_body');
        return this._exec.mapreduce.call(this);
    }
};