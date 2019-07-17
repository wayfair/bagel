'use strict';

const React = require('react');

const Nested = () => {
  throw new Error('Error in render of react_component_throws');
};

const SimpleComponent = () => {
  return React.createElement(Nested, null);
};

module.exports = SimpleComponent;
