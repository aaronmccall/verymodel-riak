// ### Using only default functionality
var VeryRiakModel = require('verymodel-riak').VeryRiakModel;
// **Define our fields**
var MyDef = {
    first_name: {},
    name: {
        private: true,
        derive: function () { return this.first_name + ' ' + this.last_name; }
    },
    city:           {},
    state:          {index: true},
    zip:            {index: true, integer: true},
    model:          {default: 'person', required: true, private: true, static: true},
    favorite_foods: {index: true, isArray: true }
};
// **Define our indexes**
var MyOptions = {
    indexes:    [['last_name', false, false], ['age', true], 'gender'],
    allKey:     'model',
    bucket:     "test:bucket"
};

// **Init our model factory**
var MyModel = new VeryRiakModel(MyDef, MyOptions);

// **Create a model instance**
var myInstance = MyModel.create({
    first_name:     'Bill',
    last_name:      'Jones',
    age:            40,
    gender:         'm',
    city:           'Atlanta',
    state:          'GA',
    zip:            30303,
    favorite_foods: ['pizza', 'fried chicken', 'applesauce', 'cake']
});

/*
myInstance.indexes will return:
```javascript
[
    {key: 'last_name_bin', value: 'Jones'},
    {key: 'age_int', value: 40},
    {key: 'gender_bin', value: 40},
    {key: 'state_bin', value: 'GA'},
    {key: 'zip_int', value: 30303},
    {key: 'model_bin', value: 'person'}
    {key: 'favorite_foods_bin', value: 'pizza'}
    {key: 'favorite_foods_bin', value: 'fried chicken'}
    {key: 'favorite_foods_bin', value: 'applesauce'}
    {key: 'favorite_foods_bin', value: 'cake'}
]

```

myInstance.value will return:
```javascript
{
    first_name: data[0].first_name,
    last_name: 'Jones',
    city: 'Atlanta',
    state: 'GA',
    zip: 30303
}

```

*/