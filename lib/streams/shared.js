

function modelize(options) {
    this._keys = {};
    this._model = options.model;
    if (options.callback) {
        this._callback = options.callback;
        this._instances = [];
    }
}

function continuate(reply) {
    if (reply && reply.continuation) {
        this._model.continuation = reply.continuation;
    } else {
        this._model.continuation = null;
    }
}

function seen(key) {
    return this._keys[key];
}

module.exports = {
    continuate  : continuate,
    modelize    : modelize,
    seen        : seen
};