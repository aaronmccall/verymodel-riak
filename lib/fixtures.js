var data =      [{
                    id:         'foobarbizbaz',
                    first_name: 'Bill',
                    last_name:  'Jones',
                    age:        40,
                    gender:     'm',
                    city:       'Atlanta',
                    state:      'GA',
                    zip:        30303
                },
                {
                    id:         'bizbazbarfoo',
                    first_name: 'Linda',
                    last_name:  'Smith',
                    age:        29,
                    gender:     'f',
                    city:       'Coeur d\'Alene',
                    state:      'ID',
                    zip:        83816
                }];
var riak_data = [{
                    key:        data[0].id,
                    vclock:     [2,3,4,5,6],
                    content:    [{
                                    indexes: [
                                        {key: 'last_name_bin', value: data[0].last_name},
                                        {key: 'age_int', value: data[0].age},
                                        {key: 'gender_bin', value: data[0].gender},
                                        {key: 'state_bin', value: data[0].state},
                                        {key: 'zip_int', value: data[0].zip},
                                        {key: 'model_bin', value: 'person'}
                                    ],
                                    value: {
                                        first_name: data[0].first_name,
                                        last_name: data[0].last_name,
                                        city: data[0].city,
                                        state: data[0].state,
                                        zip: data[0].zip
                                    },
                                    last_mod:   234567891,
                                    last_mod_usecs: 1234
                                },{
                                    indexes: [
                                        {key: 'last_name_bin', value: data[0].last_name},
                                        {key: 'age_int', value: data[0].age},
                                        {key: 'gender_bin', value: data[0].gender},
                                        {key: 'state_bin', value: 'WA'},
                                        {key: 'zip_int', value: 99352},
                                        {key: 'model_bin', value: 'person'}
                                    ],
                                    value: {
                                        first_name: data[0].first_name,
                                        last_name: data[0].last_name,
                                        city: 'Richland',
                                        state: 'WA',
                                        zip: 99352
                                    },
                                    last_mod:   123456789,
                                    last_mod_usecs: 1234
                                }]
                },
                {
                    key:        data[1].id,
                    vclock:     [5,4,3,2,1],
                    content:    [{
                                    indexes: [
                                        {key: 'last_name_bin', value: data[1].last_name},
                                        {key: 'age_int', value: data[1].age},
                                        {key: 'gender_bin', value: data[1].gender},
                                        {key: 'state_bin', value: data[1].state},
                                        {key: 'zip_int', value: data[1].zip},
                                        {key: 'model_bin', value: 'person'}
                                    ],
                                    value: {
                                        first_name: data[1].first_name,
                                        last_name: data[1].last_name,
                                        city: data[1].city,
                                        state: data[1].state,
                                        zip: data[1].zip
                                    }
                                }],
                    last_mod:   234567890,
                    last_mod_usecs: 1234
                }];

module.exports = {
    opts:       {
                    indexes:    [['last_name', false, false], ['age', true], 'gender'],
                    allKey:     'model',
                    bucket:     "test:bucket"
                },
    def:        {
                    first_name: {},
                    name: {
                        private: true,
                        derive: function () { return this.first_name + ' ' + this.last_name; }
                    },
                    city:       {},
                    state:      {index: true},
                    zip:        {index: true, integer: true},
                    model:      {default: 'person', required: true, private: true, static: true}
                },
    data:       data,
    riak:       {
                    data: riak_data
                }
};