// @flow
import logger from './logger';
import {invalidRequestError} from './serialize_error';
import type {
  BatchRequest,
  BatchResponse,
  ClientRequest,
  JobResponse,
  ServerJobData,
  ErrorResponse
} from '../types';

import createStopwatch, {type Stopwatch} from './stopwatch';

type ConstructedRequest = {
  error: ErrorResponse | null,
  batchRequest: BatchRequest | null
};

export const getResponseError = (error: ErrorResponse) => ({
  success: false,
  perfProfile: [],
  results: {},
  error
});

const validateRequest = requestData => {
  let requestDataError;
  const jobIds = Object.keys(requestData);

  for (let i = 0; i < jobIds.length; i++) {
    const jobId = jobIds[i];
    const jobData = requestData[jobId];

    if (!jobData.name) {
      requestDataError = invalidRequestError({
        error: {
          message: `Malformed request from server. Request data: ${JSON.stringify(
            requestData
          )}`,
          stack: new Error().stack
        },
        metadata: {jobId},
        name: 'unknown module name'
      });
      break;
    }
  }

  return requestDataError
    ? {ok: false, error: requestDataError}
    : {ok: true, error: null};
};

export const constructServerError = (err: ErrorResponse) => {
  const response = getResponseError(err);
  let stackTrace;

  if (err.stack) {
    if (Array.isArray(err.stack)) {
      stackTrace = err.stack.join(' ');
    } else {
      stackTrace = err.stack;
    }
  } else {
    stackTrace = 'unknown stack trace';
  }

  logger.error(
    `Caught error:\nJob Id: ${err.jobId || 'BATCH'}${
      err.name ? '\nRoot Module: ' + err.name : ''
    }\nMessage: ${err.message}\nStack trace: ${stackTrace}`
  );

  return response;
};

export const constructClientRequest = (message: string): ConstructedRequest => {
  const parsedRequest: ClientRequest = JSON.parse(message);
  const validationStatus = validateRequest(parsedRequest);

  if (!validationStatus.ok) {
    return {
      error: validationStatus.error,
      batchRequest: null
    };
  }

  // construct batchRequest object
  return {
    error: null,
    batchRequest: Object.keys(parsedRequest).reduce(
      (acc, jobId) => ({
        ...acc,
        jobs: {
          [jobId]: {
            name: parsedRequest[jobId].name,
            metadata: {...parsedRequest[jobId].metadata, ...{jobId}},
            props: parsedRequest[jobId].data
          },
          ...acc.jobs
        }
      }),
      {context: {stopwatch: createStopwatch()}, jobs: {}}
    )
  };
};

export const constructJobResponse = ({
  id,
  name,
  jobHTML,
  jobError,
  jobResponse,
  renderToStringTime,
  finalPropsFetchTime,
  duration
}: {
  id: string,
  name: string,
  jobHTML: string | null,
  jobError: ErrorResponse | null,
  jobResponse: JobResponse,
  renderToStringTime: number,
  finalPropsFetchTime: number,
  duration: number
}): ServerJobData => ({
  name,
  html: jobHTML,
  meta: {
    renderToStringTime,
    finalPropsFetchTime,
    lazytimes: jobResponse.metadata.lazytimes,
    preload: jobResponse.metadata.preload,
    ...jobResponse.metadata
  },
  duration,
  success: !jobError,
  error: jobError,
  jobId: id
});

const getMetaTimingMetrics = ({
  stopwatch,
  moduleName
}: {
  stopwatch: Stopwatch,
  moduleName: string
}): {
  renderToStringTime: number,
  finalPropsFetchTime: number,
  duration: number
} => {
  const events = stopwatch.getTimes();
  const getStopwatchEventDuration = (searchKey: string): number =>
    events
      .filter(event => event.name.includes(searchKey))
      .reduce(
        (acc, event) =>
          event.type === 'start' ? acc - event.time : acc + event.time,
        0
      );

  return {
    renderToStringTime: getStopwatchEventDuration(
      stopwatch.getRenderEventName(moduleName)
    ),
    finalPropsFetchTime: getStopwatchEventDuration(
      stopwatch.getInitialPropsEventName(moduleName)
    ),
    duration: getStopwatchEventDuration(stopwatch.getJobEventName(moduleName))
  };
};

export const constructServerResponse = ({
  batchResponse,
  stopwatch
}: {
  batchResponse: BatchResponse,
  stopwatch: Stopwatch
}): Promise<string> => {
  const {jobs} = batchResponse;
  const jobResponses = Object.keys(jobs).map(jobID =>
    jobs[jobID].renderDonePromise
      .then(jobHTML => ({jobHTML, jobError: null}))
      .catch(jobError => ({jobHTML: null, jobError}))
      .then(({jobHTML, jobError}) => ({
        jobID,
        jobData: constructJobResponse({
          id: jobID,
          jobResponse: jobs[jobID],
          jobHTML,
          jobError,
          name: jobs[jobID].metadata.name,
          ...getMetaTimingMetrics({
            stopwatch,
            moduleName: jobs[jobID].metadata.name,
            jobId: jobID
          })
        })
      }))
  );

  return Promise.all(jobResponses)
    .then(responses =>
      responses.reduce(
        (acc, response) => ({
          ...acc,
          [response.jobID]: {...response.jobData}
        }),
        {}
      )
    )
    .then(jobsData => {
      return {
        results: jobsData,
        error: [],
        success: true,
        metadata: batchResponse.metadata,
        perfProfile: stopwatch.getTimes()
      };
    })
    .then(responseObject => {
      const serverResponse = JSON.stringify(responseObject, null, 2);
      return serverResponse;
    });
};
