'use strict';

global.counter = global.counter || 1;

const React = require('react');

const GlobalCounter = props => {
  return React.createElement('div', props, `global_count_${global.counter++}`);
};

module.exports = GlobalCounter;
