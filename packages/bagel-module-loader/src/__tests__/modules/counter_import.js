const counter = require('./internal_counter');
require('./counter_import2');

counter.increment();
module.exports.counter = counter.count;
