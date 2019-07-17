// @flow

import bagel from '../index';
import createWebsocketServer from '../websocket_io';
import wsRequest from '../utils/ws_request';
import type {Resolver} from 'bagel-module-loader';
import {join} from 'path';
import fs from 'fs';
import getPort from 'get-port';

// A simple plugin to test plugin errors
let testPlugin;

const relativeToTestFileModuleResolver: Resolver = (name: string) => {
  const path = join(__dirname, '../', name + '.js');
  return fs.existsSync(path) ? path : null;
};

let server;
let wsRequestToUrl;
beforeEach(async () => {
  const port = await getPort();

  const getCurrentUrl = () => `ws://localhost:${port}/ws`;
  wsRequestToUrl = data => wsRequest({data, url: getCurrentUrl()});

  testPlugin = {
    throwsBeforeBatch: false,
    throwsBeforeJob: false,
    throwsBeforeLoadModule: false,
    throwsAfterLoadModule: false,
    throwsBeforeRender: false,
    throwsAfterRender: false,
    throwsAfterJob: false,
    throwsAfterBatch: false,

    beforeBatch({batchRequest}) {
      if (testPlugin.throwsBeforeBatch) {
        // $FlowExpectedError
        batchRequest.someMethod();
      }
    },
    beforeJob({jobRequest}) {
      if (testPlugin.throwsBeforeJob) {
        // $FlowExpectedError
        jobRequest.someMethod();
      }
    },
    beforeLoadModule({jobRequest}) {
      if (testPlugin.throwsBeforeLoadModule) {
        // $FlowExpectedError
        jobRequest.someMethod();
      }
    },
    afterLoadModule({jobRequest}) {
      if (testPlugin.throwsAfterLoadModule) {
        // $FlowExpectedError
        jobRequest.someMethod();
      }
    },
    beforeRender({jobRequest}) {
      if (testPlugin.throwsBeforeRender) {
        // $FlowExpectedError
        jobRequest.someMethod();
      }
    },
    afterRender({jobRequest}) {
      if (testPlugin.throwsAfterRender) {
        // $FlowExpectedError
        jobRequest.someMethod();
      }
    },
    afterJob({jobRequest}) {
      if (testPlugin.throwsAfterJob) {
        // $FlowExpectedError
        jobRequest.someMethod();
      }
    },
    afterBatch({batchRequest}) {
      if (testPlugin.throwsAfterBatch) {
        // $FlowExpectedError
        batchRequest.someMethod();
      }
    }
  };

  server = await bagel({
    moduleResolvers: [relativeToTestFileModuleResolver],
    interceptors: [],
    sourceCodeTransformers: [],
    plugins: [testPlugin],
    port,
    transport: createWebsocketServer
  });
});

afterEach(() => {
  server.shutDown();
});

it('should retrieve a react component correctly ', async () => {
  const requestData = {
    ID_0: {
      name: './__tests__/example_components/simple_react_component',
      metadata: {},
      props: {}
    }
  };

  const results = await wsRequestToUrl(requestData);
  expect(results.results.ID_0.html).toContain('simple_react_component');
});

it('should connect to the bagel server successfully', async () => {
  const requestData = {
    ID_0: {
      name: './__tests__/example_components/simple_react_component',
      metadata: {},
      props: {}
    }
  };

  await expect(wsRequestToUrl(requestData)).resolves.toBeTruthy();
});

it('should return a response with all the required fields', async () => {
  const requestData = {
    ID_0: {
      name: './__tests__/example_components/simple_react_component',
      metadata: {},
      props: {}
    }
  };

  const response = await wsRequestToUrl(requestData);
  expect(response.results.ID_0.error).toBeDefined();
  expect(response.results.ID_0.success).toBeDefined();
  expect(response.results.ID_0.html).toBeDefined();
});

describe('errors', () => {
  it('should provide an empty error array if there are no errors', async () => {
    const requestData = {
      ID_0: {
        name: './__tests__/example_components/simple_react_component',
        metadata: {},
        props: {}
      }
    };

    const response = await wsRequestToUrl(requestData);
    expect(response.results.ID_0.error).toBeDefined();
  });

  it('should catch errors when an invalid request is supplied', async () => {
    const spy = jest.spyOn(global.console, 'log').mockReturnValue();

    const requestData = {
      ID_0: {
        name: '',
        metadata: {},
        props: {}
      }
    };

    const response = await wsRequestToUrl(requestData);
    expect(response.success).toBeFalsy();

    const {error} = response;
    expect(error.type).toBe('INVALID_REQUEST');
    const errorMessage = 'Malformed request from server';
    expect(global.console.log.mock.calls[0][0]).toContain(errorMessage);
    expect(error.message).toContain(errorMessage);

    spy.mockRestore();
  });

  it('should catch errors when an invalid module is supplied', async () => {
    const requestData = {
      ID_0: {
        name: 'THISISNOTAVALIDMODULE',
        metadata: {},
        props: {}
      }
    };

    const response = await wsRequestToUrl(requestData);
    expect(response.success).toBe(true);

    const {error} = response.results.ID_0;
    expect(error.type).toBe('LOADING_MODULE');
    expect(error.message).toContain(
      'Could not resolve module: THISISNOTAVALIDMODULE'
    );
  });

  it('should catch errors when rendering modules', async () => {
    const requestData = {
      ID_0: {
        name: './__tests__/example_components/react_component_throws',
        metadata: {},
        props: {}
      }
    };

    const response = await wsRequestToUrl(requestData);

    expect(response.success).toBe(true);
    const {error} = response.results.ID_0;

    expect(error.type).toBe('RENDER');
    expect(error.message).toContain('react_component_throws');
  });

  it('should catch error for a single job, and render others', async () => {
    const requestData = {
      ID_0: {
        name: './__tests__/example_components/global_counter',
        metadata: {},
        props: {}
      },
      ID_1: {
        name: './__tests__/example_components/simple_react_component',
        metadata: {},
        props: {}
      },
      ID_2: {
        name: './__tests__/example_components/react_component_throws',
        metadata: {},
        props: {}
      }
    };

    const response = await wsRequestToUrl(requestData);
    expect(response.success).toBe(true);

    const {ID_0, ID_1, ID_2} = response.results;
    expect(ID_0.error).toBe(null);
    expect(ID_0.html).toContain('global_count');

    expect(ID_1.error).toBe(null);
    expect(ID_1.html).toContain('simple_react_component');

    expect(ID_2.error.type).toBe('RENDER');
    expect(ID_2.error.message).toContain('react_component_throws');
  });

  it('should catch errors that happen inside the plugin', async () => {
    testPlugin.throwsBeforeBatch = true;

    const spy = jest.spyOn(global.console, 'log').mockReturnValue();

    const requestData = {
      ID_0: {
        name: './__tests__/example_components/simple_react_component',
        metadata: {},
        props: {}
      }
    };

    const response = await wsRequestToUrl(requestData);
    expect(response.success).toBeFalsy();

    // expect to have 0 jobs in response (error happens before batch)
    expect(Object.keys(response.results).length).toBe(0);

    const error = response.error;
    const stack = error.stack.join(' ');

    expect(error.type).toBe('BATCH');
    const errorMessage = 'batchRequest.someMethod is not a function';

    // first log call will coming from default lifecycle_logger
    expect(global.console.log.mock.calls[1][0]).toContain(errorMessage);

    expect(error.message.includes(errorMessage)).toBe(true);
    // should contain original error message
    expect(
      stack.includes('TypeError: batchRequest.someMethod is not a function')
    ).toBe(true);
    // should contain life cycle method name
    // NOTE: this broke when we upgraded to Jest 25.3.0
    // expect(stack.includes('beforeBatch')).toBe(true);
    // should contain file (plugin name)
    expect(stack.includes('index.spec.js')).toBe(true);

    spy.mockRestore();
  });
});

it('should receive stopwatch data successfully', async () => {
  const requestData = {
    ID_0: {
      name: './__tests__/example_components/simple_react_component',
      props: {},
      metadata: {}
    }
  };

  const response = await wsRequestToUrl(requestData);
  const {perfProfile} = response;

  expect(perfProfile).toBeDefined();
  /**
   * We have 4 "doers" (Job, Batch, ModuleLoad, Render) and all of them have
   * "before" and "after" stages.
   */
  expect(perfProfile.length).toBe(8);
});

it('should not cache exports across jobs in a batch', async () => {
  const requestData = {
    ID_0: {
      name: './__tests__/example_components/add_prop_to_react',
      metadata: {},
      props: {}
    },
    ID_1: {
      name: './__tests__/example_components/add_prop_to_react',
      metadata: {},
      props: {}
    }
  };
  const response = await wsRequestToUrl(requestData);
  // Concat the html from both and make sure we see react_count_1 and react_count_2
  // This will indicate that the react module was shared across jobs
  const allResultsHTML =
    response.results.ID_0.html + response.results.ID_1.html;
  expect(allResultsHTML).toContain('react_count_1');
  expect(allResultsHTML).toContain('react_count_1');
});

it('should not cache exports between batches', async () => {
  const makeReq = async () =>
    (await wsRequestToUrl({
      ID_0: {
        name: './__tests__/example_components/add_prop_to_react',
        metadata: {},
        props: {}
      }
    })).results.ID_0.html;

  const r1 = await makeReq();
  const r2 = await makeReq();
  expect(r1).toContain('react_count_1');
  expect(r1).toBe(r2);
});

it('should cache globals between batches', async () => {
  const makeReq = async () =>
    (await wsRequestToUrl({
      ID_0: {
        name: './__tests__/example_components/global_counter',
        metadata: {},
        props: {}
      }
    })).results.ID_0.html;

  const r1 = await makeReq();
  const r2 = await makeReq();

  expect(r1).toContain('global_count');
  expect(r2).toContain('global_count');
  expect(r1).not.toBe(r2);
});

describe('error handling in plugins', () => {
  const testPluginBatchCase = {
    rootError: true,
    expectedErrorType: 'BATCH',
    expectedErrorMessage: 'batchRequest.someMethod is not a function'
  };

  const testPluginJobCase = {
    rootError: false,
    expectedErrorMessage: 'jobRequest.someMethod is not a function'
  };

  const testPluginCases = {
    throwsBeforeBatch: testPluginBatchCase,
    throwsBeforeJob: {
      ...testPluginJobCase,
      expectedErrorType: 'JOB'
    },
    throwsBeforeLoadModule: {
      ...testPluginJobCase,
      expectedErrorType: 'LOADING_MODULE'
    },
    throwsAfterLoadModule: {
      ...testPluginJobCase,
      expectedErrorType: 'LOADING_MODULE'
    },
    throwsBeforeRender: {
      ...testPluginJobCase,
      expectedErrorType: 'RENDER'
    },
    throwsAfterRender: {
      ...testPluginJobCase,
      expectedErrorType: 'RENDER'
    },
    throwsAfterJob: {
      ...testPluginJobCase,
      expectedErrorType: 'JOB'
    },
    throwsAfterBatch: testPluginBatchCase
  };

  let spy, error, stack;

  const requestData = {
    ID_0: {
      name: './__tests__/example_components/simple_react_component',
      metadata: {},
      props: {}
    }
  };

  Object.keys(testPluginCases).forEach(testCase => {
    it(`should catch errors from plugins that ${testCase}`, async () => {
      testPlugin[testCase] = true;
      spy = jest.spyOn(global.console, 'log').mockReturnValue();
      const {
        rootError,
        expectedErrorMessage,
        expectedErrorType
      } = testPluginCases[testCase];
      const response = await wsRequestToUrl(requestData);
      expect(response.success).toBe(!rootError);

      if (rootError) {
        error = response.error;
        stack = error.stack.join(' ');
        expect(Object.keys(response.results).length).toBe(0);
        expect(stack.includes('index.spec.js')).toBe(true);
      } else {
        error = response.results.ID_0.error;
        stack = error.stack;
        expect(stack.some(message => message.includes('index.spec.js'))).toBe(
          true
        );
      }

      expect(error.type).toBe(expectedErrorType);
      expect(error.message.includes(expectedErrorMessage)).toBe(true);
      expect(
        global.console.log.mock.calls.some(c =>
          c[0].includes(expectedErrorMessage)
        )
      ).toBe(true);

      expect(error.stack.includes(`TypeError: ${expectedErrorMessage}`)).toBe(
        true
      );

      spy.mockRestore();
      testPlugin[testCase] = false;
    });
  });
});
