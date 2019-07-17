// @flow

import bagel, {
  type Plugin,
  type TransportType,
  httpTransport,
  websocketTransport
} from '../index';
import getPort from 'get-port';
import http from 'http';
import fs from 'fs';
import {join} from 'path';
import type {Resolver, Interceptor, Transformer} from 'bagel-module-loader';

const relativeToTestFileModuleResolver: Resolver = name => {
  const path = join(__dirname, '../', name + '.js');
  return fs.existsSync(path) ? path : null;
};

const noopInterceptor: Interceptor = ({moduleID, next}) => next(moduleID);
const noopTransformer: Transformer = ({source}) => ({
  errors: [],
  transformedSource: source
});

const defaultTransport: TransportType = httpTransport || websocketTransport;

const noopPlugin: Plugin = {};

let bagelServer;
let port = getPort();

const fullMarkupRequestOptions = {
  path: '/batch',
  method: 'POST',
  host: 'localhost',
  headers: {'Content-Type': 'application/json'}
};

// /////////////////////////////////////////////////////////////////////////
// ////// Create the bagel server, and configure it with the options you want.
// ///////////////////////////////////////////////////////////////////////

const baseBagelOptions = {
  // /////////////////////////////////////////////////////
  // /////////// module loading configuration ////////////
  // /////////////////////////////////////////////////////

  // An array of module resolvers. Each will have the opportunity to handle a module import string. If the first doesn't know how to handle it, responsability is passed to the second, and so on.
  // See the 'Resolver' type imported above
  moduleResolvers: [relativeToTestFileModuleResolver],

  // Middleware for module loading. Interceptors have an opportunity to handle every module import the your applications dependency graph
  // before the real 'require' function is called, as well as the opportunity to modify its response.
  // See the 'Interceptor' type imported above
  interceptors: [noopInterceptor],

  // Want to modify the source code you're loading? Hook in to the module loader's source code loading here.
  // See the 'Transformer' type imported above
  sourceCodeTransformers: [noopTransformer],

  // ///////////////////////////////////////////////////////
  // /////////// Renderer service configuration ////////////
  // ///////////////////////////////////////////////////////

  // An array of plugin objects. Plugins can implement whichever lifecycle methods they want. Bagel will call them at the appropriate time.
  // See the 'Plugin' type imported above
  plugins: [noopPlugin],

  // The port you want bagel to listen on
  port,

  // You can configure how you want Bagel to communicate. It uses http by default. At Wayfair, we use websockets (see websocketTransport imported above) rather
  // than simple http. This allows us to communicate back and for with the originating php process.
  transport: defaultTransport
};

describe('fulfilling an http request', () => {
  beforeEach(async () => {
    port = await getPort();
  });

  afterEach(() => {
    bagelServer.unref();
  });

  afterAll(() => {
    bagelServer.close();
  });

  it('responds with html when a successful request is made', async () => {
    bagelServer = await bagel({
      ...baseBagelOptions,
      port
    });
    const jobResponse = await new Promise(resolve => {
      const request = http.request({...fullMarkupRequestOptions, port}, res => {
        res.on('data', data => {
          resolve(JSON.parse(data.toString()));
        });
      });
      request.write(
        JSON.stringify({
          ID_0: {
            name: './__tests__/example_components/simple_react_component',
            metadata: {},
            props: {}
          }
        })
      );
      request.end();
    });

    expect(jobResponse.results.ID_0.html).toContain('simple_react_component');
  });

  it('returns an error in the job when the component throws an error', async () => {
    bagelServer = await bagel({
      ...baseBagelOptions,
      port
    });

    const jobResponse = await new Promise(resolve => {
      const request = http.request({...fullMarkupRequestOptions, port}, res => {
        res.on('data', data => {
          resolve(JSON.parse(data.toString()));
          request.connection && request.connection.unref();
        });
      });
      request.write(
        JSON.stringify({
          ID_0: {
            name: './__tests__/example_components/react_component_throws',
            metadata: {},
            props: {}
          }
        })
      );
      request.end();
    });

    expect(jobResponse.results.ID_0.error).toBeTruthy();
  });

  it('responds with an error and error code 500 when the batch fails', async () => {
    bagelServer = await bagel({
      ...baseBagelOptions,
      port,
      plugins: [
        {
          afterBatch() {
            throw new Error('This error should wind up in the response');
          }
        }
      ]
    });
    const jobResponse = await new Promise((resolve, reject) => {
      const request = http.request({...fullMarkupRequestOptions, port}, res => {
        expect(res.statusCode).toBe(500);
        res.on('data', data => {
          resolve(JSON.parse(data.toString()));
          request.connection && request.connection.unref();
        });
      });
      request.write(
        JSON.stringify({
          ID_0: {
            name: './__tests__/example_components/react_component_throws',
            metadata: {},
            props: {}
          }
        })
      );
      request.end();

      request.on('error', e => {
        request.end();
        reject(e);
      });
    });

    expect(jobResponse.error.message).toContain(
      'This error should wind up in the response'
    );
  });
});
