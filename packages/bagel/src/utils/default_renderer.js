// @flow
import {createElement} from 'react';
import {renderToNodeStream, renderToString} from 'react-dom/server';
import type {RenderToStream, RenderToString} from './../types';

export const streamRenderer: RenderToStream = ({component, props}) =>
  renderToNodeStream(createElement(component, props));

export const stringRenderer: RenderToString = ({component, props}) =>
  renderToString(createElement(component, props));
