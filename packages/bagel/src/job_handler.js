// @flow
import type {LoadModuleHandler, RenderHandler, JobHandler} from './types';

const createJobHandler = (
  renderHandler: RenderHandler,
  loadModule: LoadModuleHandler
): JobHandler => ({
  jobRequest,
  parentBatchRequest,
  jobResponseMetadata,
  batchResponseMetadata
}) => {
  const {stopwatch} = parentBatchRequest.context;

  // create "job" stopwatch event name
  const jobEventName = stopwatch.getJobEventName(jobRequest.name);

  const stopwatchDescriptor = {
    id: jobRequest.metadata.jobId,
    name: jobEventName,
    module: jobRequest.name,
    async: true
  };

  stopwatch.start(stopwatchDescriptor);

  const jobHandler = loadModule({
    jobRequest,
    parentBatchRequest,
    jobResponseMetadata,
    batchResponseMetadata
  })
    .then(renderHandler)
    /**
     * @NOTE renderHandler never fails. This only catches failed loadModule
     * The renderDonePromise may fail, but that is caught where
     * renderDonePromise is handled.
     */
    .catch(error => ({
      jobRequest,
      jobResponse: {
        metadata: {name: jobRequest.name},
        renderDonePromise: Promise.reject(error),
        htmlStream: null
      },
      parentBatchRequest,
      batchResponseMetadata
    }));

  jobHandler.then(response =>
    response.jobResponse.renderDonePromise
      .catch(() => '')
      .then(() => stopwatch.stop(stopwatchDescriptor))
  );

  return jobHandler;
};

export default createJobHandler;
