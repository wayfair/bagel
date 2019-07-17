// @flow
import type {RenderHandler, Renderer} from './types';
import {renderError} from './utils/serialize_error';

const createRenderDonePromise = ({
  renderer,
  component,
  props,
  jobRequest,
  parentBatchRequest,
  jobResponseMetadata,
  batchResponseMetadata
}) => {
  const handleError = error =>
    renderError({
      error,
      metadata: jobRequest.metadata,
      name: jobRequest.name
    });

  try {
    const renderResult = renderer({
      component,
      props,
      jobRequest,
      parentBatchRequest,
      jobResponseMetadata,
      batchResponseMetadata
    });

    if (typeof renderResult === 'string') {
      return {promise: Promise.resolve(renderResult), stream: null};
    }

    return {
      promise: new Promise((resolve, reject) => {
        let jobHTML = '';
        renderResult.on('data', (data: string) => (jobHTML += data));
        // finish and end for http and web socket respectively
        renderResult.on('finish', () => resolve(jobHTML));
        renderResult.on('end', () => resolve(jobHTML));
        renderResult.on('error', e => reject(handleError(e)));
      }),
      stream: renderResult
    };
  } catch (e) {
    return {promise: Promise.reject(handleError(e)), stream: null};
  }
};

const createRenderHandler = (renderer: Renderer): RenderHandler => ({
  // aliasing to '_module' since 'module' is a reserved keyword
  module: _module,
  jobRequest,
  parentBatchRequest,
  jobResponseMetadata,
  batchResponseMetadata
}) => {
  const {stopwatch} = parentBatchRequest.context;

  // create "render" stopwatch event name
  const renderEventName = stopwatch.getRenderEventName(jobRequest.name);

  const stopwatchDescriptor = {
    id: jobRequest.metadata.jobId,
    name: renderEventName,
    module: jobRequest.name
  };

  stopwatch.start(stopwatchDescriptor);

  const {
    promise: renderDonePromise,
    stream: htmlStream
  } = createRenderDonePromise({
    renderer,
    component: _module,
    props: jobRequest.props,
    jobRequest,
    parentBatchRequest,
    jobResponseMetadata,
    batchResponseMetadata
  });

  renderDonePromise
    .catch(() => '')
    .then(() => {
      stopwatch.stop(stopwatchDescriptor);
    });

  return Promise.resolve({
    jobRequest,
    jobResponse: {
      metadata: {name: jobRequest.name, ...jobResponseMetadata},
      renderDonePromise,
      htmlStream
    },
    parentBatchRequest,
    batchResponseMetadata
  });
};

export default createRenderHandler;
