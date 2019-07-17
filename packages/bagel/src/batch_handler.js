// @flow
import type {BatchHandler, JobHandler, JobResponse} from './types';
import logger from './utils/logger';

const createBatchHandler = (jobHandler: JobHandler): BatchHandler => ({
  batchRequest,
  batchResponseMetadata
}) =>
  new Promise(resolve => {
    const {stopwatch} = batchRequest.context;
    const {jobs} = batchRequest;
    const jobKeys = Object.keys(jobs);

    const stopwatchDescriptor = {
      name: stopwatch.getBatchEventName(),
      async: true
    };

    stopwatch.start(stopwatchDescriptor);

    // construct an array of promises for each job
    const jobResponsePromises = jobKeys.map(id =>
      jobHandler({
        jobRequest: jobs[id],
        parentBatchRequest: batchRequest,
        jobResponseMetadata: {},
        batchResponseMetadata
      })
        .catch(e => {
          logger.error(`${e.message} ${e.stack}`);
          return {
            jobResponse: {
              renderDonePromise: Promise.reject(e),
              htmlStream: null,
              metadata: {}
            }
          };
        })
        .then(({jobResponse}) => ({id, jobResponse}))
    );

    Promise.all(jobResponsePromises).then(jobResponses => {
      const renderPromises = jobResponses.map(response => {
        const jobResponse: JobResponse = response.jobResponse;
        return jobResponse.renderDonePromise;
      });

      Promise.all(renderPromises)
        .catch(e => logger.error(`${e.message} ${e.stack}`))
        .then(() => stopwatch.stop(stopwatchDescriptor));

      resolve({
        batchResponse: {
          jobs: jobResponses.reduce(
            (acc, response) => ({
              ...acc,
              [response.id]: response.jobResponse
            }),
            {}
          ),
          metadata: {}
        },
        batchRequest,
        batchResponseMetadata
      });
    });
  });

export default createBatchHandler;
