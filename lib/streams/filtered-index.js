var stream           = require('stream');
var util             = require('util');
var shared           = require('./shared');
var KeyToValueStream = require('./key-value');

util.inherits(FilteredIndexStream, stream.Readable);

function FilteredIndexStream(options) {
    shared.modelize.call(this, options);
    stream.Readable.call(this, {objectMode: true});
    this._limit = options.limit || this._model.options.max_results || 10;
    this._pushed = 0;
    this._filter = options.filter;
    this._search = options.search||[];
}

FilteredIndexStream.prototype._read = function() {
    // Filter and stop at limit
    if (!this._allStream) {
        this._initDataStream();
    }
};

FilteredIndexStream.prototype._initDataStream = function () {
    this._allStream = this._model._indexQuery.apply(this._model, this._search)
                          .pipe(new KeyToValueStream({model: this._model}));
    this._allStream.on('data', this._onData.bind(this));
    this._allStream.on('end', this._onEnd.bind(this));
};

FilteredIndexStream.prototype._onData = function (instanceData) {
    if (this._filter(instanceData)) {
        instanceData.filtered = true;
        this.push(instanceData);
        this._pushed++;
    }
    if (this._pushed === this._limit) {
        this.push(null);
    }
};

FilteredIndexStream.prototype._onEnd = function () {
    if ((this._pushed < this._limit) && this._model.continuation) {
        return this._initDataStream();
    }
    this.push(null);
};

module.exports = FilteredIndexStream;
