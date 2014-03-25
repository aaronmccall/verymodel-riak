
function getName(field, def) {
    if (!def) return field;
    var idxName;
    if (typeof def.index === 'string') {
        idxName = def.index;
    }
    if (typeof def.index === 'object' && def.index.name) {
        idxName = def.index.name;
    }
    idxName = idxName || field;

    if (idxName.match(/_(int|bin)$/)) return idxName;
    return idxName + (def.index.integer ? '_int' : '_bin');
}
exports.getName = getName;

function getValue(model, def, value) {
    var transform;
    if (typeof def.index === 'function') transform = def.index;
    if (def.index.transform) transform = def.index.transform;
    // If there's a transdform function, use it to derive an index value
    return transform ? transform.call(model, value) : value;
}

function deriveIndexes() {
    var self = this,
        payload = [],
        defs = this.__verymeta.model.definition;
    // Push key/value object onto payload array for every field
    // whose definition indicates that it's an index field
    Object.keys(defs).forEach(function (field) {
        var def = defs[field];
        if (!def || !def.index) return;

        var value = getValue(self, def, self[field]);
        if (typeof value === 'undefined') return;

        var idxName = getName(field, def);

        // If we aren't expecting a multiple values, set a single key/value pair
        if (!def.index.isArray) {
            return payload.push({ key: idxName, value: value });
        }

        // If we are expecting multiple values, add them all to the index
        if (Array.isArray(value)) {
            payload.push.apply(payload, value.map(function (value) {
                return { key: idxName, value: value };
            }));
        }
    });
    return payload;
}
exports.derive = deriveIndexes;

function rehydrateIndexes(indexes) {
    var self = this,
        payload = {},
        allKey = self.getAllKey();
    if (!indexes) return payload;
    indexes.forEach(function (index) {
        var field,
            stripped = index.key.replace(/(_bin|_int)$/, '');
        if (self.options.indexes_to_fields[index.key]) {
            field = self.options.indexes_to_fields[index.key];
        }
        if (!field && self.options.indexes_to_fields[stripped]) {
            field = self.options.indexes_to_fields[stripped];
        }
        if (!field) field = stripped;

        var notAllKey = !allKey || index.key !== allKey.key;
        var shouldConvert = (!self.options.values || !~self.options.values.indexOf(field));
        if (notAllKey && shouldConvert) {
            var def = self.definition[field];
            // If it isn't an array field, just pass the value through
            if (!def || !def.isArray) {
                payload[field] = index.value;
            } else {
                // Put the values back into a single field as an array
                if (!payload[field]) payload[field] = [];
                payload[field].push(def.integer ? parseInt(index.value, 10) : index.value);
            }
        }
    });
    return payload;
}
exports.rehydrate = rehydrateIndexes;

function mapIndexes(model) {
    Object.keys(model.definition).forEach(function (field) {
        var def = model.definition[field];
        if (!def || !def.index) return;

        var indexes_to_fields = model.options.indexes_to_fields;
        if (!indexes_to_fields) indexes_to_fields = (model.options.indexes_to_fields = {});

        var idxName = getName(field, def);
        if (idxName && idxName !== field) {
            indexes_to_fields[idxName||field] = field;
        }
    });
}
exports.makeMap = mapIndexes;