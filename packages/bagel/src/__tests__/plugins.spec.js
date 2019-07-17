// @flow

import bagel from '../index';
import createWebsocketServer from '../websocket_io';
import wsRequest from '../utils/ws_request';
import type {Resolver} from 'bagel-module-loader';
import {join} from 'path';
import fs from 'fs';
import getPort from 'get-port';

const relativeToTestFileModuleResolver: Resolver = (name: string) => {
  const path = join(__dirname, '../', name + '.js');
  return fs.existsSync(path) ? path : null;
};

let server;
let wsRequestToUrl;

const startBagelWithPlugins = async (plugins = []) => {
  const port = await getPort();

  const getCurrentUrl = () => `ws://localhost:${port}/ws`;
  wsRequestToUrl = data => wsRequest({data, url: getCurrentUrl()});

  server = await bagel({
    moduleResolvers: [relativeToTestFileModuleResolver],
    interceptors: [],
    sourceCodeTransformers: [],
    plugins,
    port,
    transport: createWebsocketServer
  });
};

afterEach(() => {
  server.shutDown();
});

const counterPlugin = {
  beforeBatch({batchRequest}) {
    expect(batchRequest.context.counter).toBeUndefined();
    batchRequest.context.counter = 1;
  },
  beforeJob({jobRequest, parentBatchRequest}) {
    expect(jobRequest.metadata.counter).toBeUndefined();
    jobRequest.metadata.counter = 1;
    expect(parentBatchRequest.context.counter).toBe(1);
    parentBatchRequest.context.counter++;
  },
  beforeLoadModule({jobRequest, parentBatchRequest}) {
    expect(jobRequest.metadata.counter).toBe(1);
    jobRequest.metadata.counter++;
    expect(parentBatchRequest.context.counter).toBe(2);
    parentBatchRequest.context.counter++;
  },
  afterLoadModule({jobRequest, parentBatchRequest}) {
    expect(jobRequest.metadata.counter).toBe(2);
    expect(parentBatchRequest.context.counter).toBe(3);
    return new Promise(resolve => {
      setTimeout(() => {
        jobRequest.metadata.counter++;
        parentBatchRequest.context.counter++;
        resolve();
      }, 1);
    });
  },
  beforeRender({jobRequest, parentBatchRequest}) {
    expect(jobRequest.metadata.counter).toBe(3);
    expect(parentBatchRequest.context.counter).toBe(4);
    return new Promise(resolve => {
      setTimeout(() => {
        jobRequest.metadata.counter++;
        parentBatchRequest.context.counter++;
        resolve();
      }, 1);
    });
  },
  afterRender({jobRequest, parentBatchRequest}) {
    expect(jobRequest.metadata.counter).toBe(4);
    jobRequest.metadata.counter++;
    expect(parentBatchRequest.context.counter).toBe(5);
    parentBatchRequest.context.counter++;
  },
  afterJob({jobRequest, parentBatchRequest}) {
    expect(jobRequest.metadata.counter).toBe(5);
    jobRequest.metadata.counter++;
    expect(parentBatchRequest.context.counter).toBe(6);
    parentBatchRequest.context.counter++;
  },
  afterBatch({batchRequest}) {
    batchRequest.context.counter++;
    expect(batchRequest.context.counter).toBe(8);
  }
};

// Kicks off Batch counter
const batchCounterInitializerPlugin = {
  beforeBatch({batchRequest}) {
    batchRequest.context.counter = 0;
  }
};

const batchRefCounterPlugin = {
  beforeBatch({batchRequest}) {
    batchRequest.context.counter++;
  },
  beforeJob({parentBatchRequest}) {
    parentBatchRequest.context.counter++;
  },
  beforeLoadModule({parentBatchRequest}) {
    parentBatchRequest.context.counter++;
  },
  afterLoadModule({parentBatchRequest}) {
    parentBatchRequest.context.counter++;
  },
  beforeRender({parentBatchRequest}) {
    parentBatchRequest.context.counter++;
  },
  afterRender({parentBatchRequest}) {
    parentBatchRequest.context.counter++;
  },
  afterJob({parentBatchRequest}) {
    parentBatchRequest.context.counter++;
  },
  afterBatch({batchRequest}) {
    batchRequest.context.counter++;
  }
};

const batchAsyncRefCounterPlugin = {
  beforeBatch({batchRequest}) {
    return new Promise(resolve => {
      setTimeout(() => {
        batchRequest.context.counter++;
        resolve();
      }, 1);
    });
  },
  beforeJob({parentBatchRequest}) {
    return new Promise(resolve => {
      setTimeout(() => {
        parentBatchRequest.context.counter++;
        resolve();
      }, 1);
    });
  },
  beforeLoadModule({parentBatchRequest}) {
    return new Promise(resolve => {
      setTimeout(() => {
        parentBatchRequest.context.counter++;
        resolve();
      }, 1);
    });
  },
  afterLoadModule({parentBatchRequest}) {
    return new Promise(resolve => {
      setTimeout(() => {
        parentBatchRequest.context.counter++;
        resolve();
      }, 1);
    });
  },
  beforeRender({parentBatchRequest}) {
    return new Promise(resolve => {
      setTimeout(() => {
        parentBatchRequest.context.counter++;
        resolve();
      }, 1);
    });
  },
  afterRender({parentBatchRequest}) {
    return new Promise(resolve => {
      setTimeout(() => {
        parentBatchRequest.context.counter++;
        resolve();
      }, 1);
    });
  },
  afterJob({parentBatchRequest}) {
    return new Promise(resolve => {
      setTimeout(() => {
        parentBatchRequest.context.counter++;
        resolve();
      }, 1);
    });
  },
  afterBatch({batchRequest}) {
    return new Promise(resolve => {
      setTimeout(() => {
        batchRequest.context.counter++;
        resolve();
      }, 1);
    });
  }
};

const batchCounterExpectPlugin = {
  afterBatch({batchRequest}) {
    expect(batchRequest.context.counter).toBe(14);
  }
};

const attachResponseMetadataPlugin = {
  beforeBatch({batchResponseMetadata}) {
    batchResponseMetadata.foo = 'bar';
  },
  beforeJob({jobResponseMetadata}) {
    jobResponseMetadata.bar = 'baz';
  },
  beforeLoadModule({jobResponseMetadata}) {
    jobResponseMetadata.luigi = 'mario';
  },
  beforeRender({jobResponseMetadata}) {
    jobResponseMetadata.vegtable = 'squash';
  }
};

it('should retrieve a react component correctly - without plugins', async () => {
  await startBagelWithPlugins();
  const requestData = {
    ID_0: {
      name: './__tests__/example_components/simple_react_component',
      metadata: {
        jobID: 'ID_0'
      },
      props: {}
    }
  };

  const results = await wsRequestToUrl(requestData);
  expect(results.results.ID_0.html).toContain('simple_react_component');
});

it('pass all expect checks inside counterPlugin', async () => {
  await startBagelWithPlugins([counterPlugin]);
  const requestData = {
    ID_0: {
      name: './__tests__/example_components/simple_react_component',
      metadata: {
        jobId: 'ID_0'
      },
      props: {}
    }
  };

  const results = await wsRequestToUrl(requestData);
  expect(results.results.ID_0.html).toContain('simple_react_component');
});

it('pass all expect checks inside batchCounterExpectPlugin - passed by ref', async () => {
  await startBagelWithPlugins([
    batchCounterInitializerPlugin,
    batchRefCounterPlugin,
    batchCounterExpectPlugin
  ]);
  const requestData = {
    ID_0: {
      name: './__tests__/example_components/simple_react_component',
      metadata: {
        jobId: 'ID_0'
      },
      props: {}
    },
    ID_1: {
      name: './__tests__/example_components/simple_react_component',
      metadata: {
        jobId: 'ID_1'
      },
      props: {}
    }
  };

  const results = await wsRequestToUrl(requestData);
  expect(results.results.ID_0.html).toContain('simple_react_component');
});

it('pass all expect checks inside batchCounterExpectPlugin - new objects', async () => {
  await startBagelWithPlugins([
    batchCounterInitializerPlugin,
    batchAsyncRefCounterPlugin,
    batchCounterExpectPlugin
  ]);
  const requestData = {
    ID_0: {
      name: './__tests__/example_components/simple_react_component',
      metadata: {
        jobId: 'ID_0'
      },
      props: {}
    },
    ID_1: {
      name: './__tests__/example_components/simple_react_component',
      metadata: {
        jobId: 'ID_1'
      },
      props: {}
    }
  };

  const results = await wsRequestToUrl(requestData);
  expect(results.results.ID_0.html).toContain('simple_react_component');
});

it('attaches metadata in "pre job response" lifecycles', async () => {
  await startBagelWithPlugins([attachResponseMetadataPlugin]);
  const requestData = {
    ID_0: {
      name: './__tests__/example_components/simple_react_component',
      metadata: {
        jobId: 'ID_0'
      },
      props: {}
    }
  };

  const results = await wsRequestToUrl(requestData);
  const {
    results: {
      ID_0: {meta}
    },
    metadata: batchResponseMetadata
  } = results;
  expect(meta.bar).toBe('baz');
  expect(meta.luigi).toBe('mario');
  expect(meta.vegtable).toBe('squash');
  expect(batchResponseMetadata.foo).toBe('bar');
});
