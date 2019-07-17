// @flow
import type {LoadModuleHandler, JobHandlerRequest} from '../types';
// import the type of the module handler we are adapting
import type {LoadModule} from 'bagel-module-loader';

const loadModuleHandlerAdapter = (
  loadModule: LoadModule
): LoadModuleHandler => ({
  jobRequest,
  parentBatchRequest,
  jobResponseMetadata,
  batchResponseMetadata
}) => {
  const {stopwatch} = parentBatchRequest.context;

  // create "module load" stopwatch event name
  const loadEventName = stopwatch.getLoadEventName(jobRequest.name);

  const stopwatchDescriptor = {
    id: jobRequest.metadata.jobId,
    name: loadEventName,
    module: jobRequest.name
  };

  stopwatch.start(stopwatchDescriptor);

  const response = Promise.resolve({
    jobRequest,
    module: loadModule(
      jobRequest.name,
      __dirname,
      ({
        jobRequest,
        parentBatchRequest,
        jobResponseMetadata,
        batchResponseMetadata
      }: JobHandlerRequest)
    ),
    parentBatchRequest,
    jobResponseMetadata,
    batchResponseMetadata
  });

  stopwatch.stop(stopwatchDescriptor);
  return response;
};

export default loadModuleHandlerAdapter;
