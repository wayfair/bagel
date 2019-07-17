import bagel from '../index';
import getPort from 'get-port';
import createHTTPServer from '../http_io';
import http from 'http';
import fs from 'fs';
import {join} from 'path';
import {streamRenderer} from '../utils/default_renderer';

const relativeToTestFileModuleResolver = name => {
  const path = join(__dirname, '../', name + '.js');
  return fs.existsSync(path) ? path : null;
};

let bagelServer;
let port;

const fullMarkupRequestOptions = {
  path: '/batch',
  method: 'POST',
  host: 'localhost',
  headers: {'Content-Type': 'application/json'}
};

const streamedMarkupRequestOptions = {
  path: '/batchStreaming',
  method: 'POST',
  host: 'localhost',
  headers: {'Content-Type': 'gzip', 'Transfer-Encoding': 'chunked'}
};

const baseBagelOptions = {
  moduleResolvers: [relativeToTestFileModuleResolver],
  interceptors: [],
  sourceCodeTransformers: [],
  plugins: [],
  transport: createHTTPServer
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
          request.connection.unref();
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
          afterBatch({afterBatch}) {
            afterBatch.someMethod();
          }
        }
      ]
    });
    const jobResponse = await new Promise((resolve, reject) => {
      const request = http.request({...fullMarkupRequestOptions, port}, res => {
        expect(res.statusCode).toBe(500);
        res.on('data', data => {
          resolve(JSON.parse(data.toString()));
          request.connection.unref();
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
      "Cannot read property 'someMethod' of undefined"
    );
  });
});

describe('http streaming', () => {
  beforeEach(async () => {
    port = await getPort();
  });

  afterEach(() => {
    bagelServer.unref();
  });

  it('successfully decodes and sends chunks', async () => {
    bagelServer = await bagel({
      ...baseBagelOptions,
      renderer: streamRenderer,
      port
    });

    const jobResponse = await new Promise(resolve => {
      const streamRequest = http.request(
        {...streamedMarkupRequestOptions, port},
        res => {
          let htmlResponse = '';
          res.on('data', data => {
            htmlResponse += data;
          });

          res.on('end', () => {
            streamRequest.end();
            resolve(htmlResponse);
          });
        }
      );

      streamRequest.write(
        JSON.stringify({
          ID_0: {
            name: './__tests__/example_components/simple_react_component',
            metadata: {},
            props: {}
          }
        })
      );
    });

    expect(jobResponse).toBe(
      '<div data-reactroot="">simple_react_component</div>'
    );
  });

  it('includes an error object when an error occurs', async () => {
    bagelServer = await bagel({
      ...baseBagelOptions,
      renderer: streamRenderer,
      port
    });

    const jobResponse = await new Promise(resolve => {
      const streamRequest = http.request(
        {...streamedMarkupRequestOptions, port},
        res => {
          let htmlResponse = '';
          res.on('data', data => {
            htmlResponse += data;
          });

          res.on('end', () => {
            streamRequest.end();
            if (res.statusCode === 500) {
              resolve(JSON.parse(htmlResponse));
            }
            resolve(htmlResponse);
          });
        }
      );

      streamRequest.write(
        JSON.stringify({
          ID_0: {
            name: './__tests__/example_components/react_component_throws',
            metadata: {},
            props: {}
          }
        })
      );
    });

    expect(jobResponse.success).toBe(false);
    expect(jobResponse.error.type).toBe('RENDER');
  });
});
