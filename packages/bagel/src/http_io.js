// @flow

import type {BatchHandler, BatchHandlerRequest} from './types';
// $FlowFixMe - flow is expecting flowtypes of the npm module itself which don't exist
import express from 'express';
import {
  constructClientRequest,
  constructServerError,
  constructServerResponse
} from './utils/server_api_formatters';

const createHTTPServer = ({
  port,
  batchHandler,
  afterRequestComplete
}: {
  port: number,
  batchHandler: BatchHandler,
  afterRequestComplete: BatchHandlerRequest => Promise<BatchHandlerRequest>
}): Promise<{unref: () => void, close: () => void, port: number}> => {
  const app = express();

  const getBatchRequestPromise = req => {
    const {error, batchRequest} = constructClientRequest(req);

    if (!batchRequest) {
      return Promise.reject(error);
    }

    // batchHandler expects an object with batchRequest field
    return Promise.resolve({batchRequest, batchResponseMetadata: {}});
  };

  app.post('/batch', (req, res) => {
    // this will be used later as a reference for the afterBatch method
    let request;

    res.on('finish', () => {
      afterRequestComplete({
        batchRequest: request,
        batchResponseMetadata: {}
      });
    });

    res.on('error', e => {
      console.log(e);
    });

    req.on('data', data => {
      getBatchRequestPromise(data.toString())
        .then(batchHandler)
        .then(({batchRequest, batchResponse, batchResponseMetadata}) => {
          // save off batchRequest to use in afterRequestComplete lifecycle
          request = batchRequest;
          batchResponse.metadata = {
            ...batchResponse.metadata,
            ...batchResponseMetadata
          };
          return constructServerResponse({
            batchResponse,
            stopwatch: batchRequest.context.stopwatch
          });
        })
        .then(result => {
          if (result) {
            res.end(result);
          }
        })
        .catch(error => {
          res.statusCode = 500;
          res.end(JSON.stringify(constructServerError(error)));
        });
    });
  });

  app.post('/batchStreaming', (req, res) => {
    req.on('data', data => {
      getBatchRequestPromise(data.toString())
        .then(batchHandler)
        .then(async ({batchRequest, batchResponse}) => {
          const {jobs} = batchResponse;
          const jobIDs = Object.keys(jobs);

          /**
           * forEach doesn't properly handle async/await so we need to use a
           * vanilla for loop.
           */
          for (let i = 0; i < jobIDs.length; i++) {
            const {htmlStream, renderDonePromise} = jobs[jobIDs[i]];
            if (htmlStream) {
              htmlStream.pipe(res);
            }
            await renderDonePromise;
          }

          return batchRequest;
        })
        .then(batchRequest => {
          res.end();
          afterRequestComplete({
            batchRequest,
            batchResponseMetadata: {}
          });
        })
        .catch(e => {
          res.statusCode = 500;
          res.end(JSON.stringify(constructServerError(e)));
        });
    });
  });

  return Promise.resolve(app.listen(port));
};

export default createHTTPServer;
