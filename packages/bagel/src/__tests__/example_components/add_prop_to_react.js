'use strict';

const React = require('react');

const AddPropToReact = props => {
  React.count = React.count ? React.count + 1 : 1;
  return React.createElement('div', props, `react_count_${React.count}`);
};

module.exports = AddPropToReact;
