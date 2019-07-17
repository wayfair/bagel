// @flow
import WebSocket from 'ws';
import type {BatchHandler, BatchHandlerRequest, WebServer} from './types';

import {
  constructClientRequest,
  constructServerError,
  constructServerResponse
} from './utils/server_api_formatters';

const createIO = ({
  batchHandler,
  port,
  afterRequestComplete
}: {
  batchHandler: BatchHandler,
  port: number,
  afterRequestComplete: BatchHandlerRequest => Promise<BatchHandlerRequest>
}): Promise<{shutDown: () => void, port: number}> =>
  new Promise(resolve => {
    const wsServer: WebServer = new WebSocket.Server({
      port
    });

    const shutDown = () => {
      wsServer.close();
    };

    const getBatchRequestPromise = (connection, message) => {
      const {error, batchRequest} = constructClientRequest(message);

      if (!batchRequest) {
        return Promise.reject(error);
      }

      // batchHandler expects an object with batchRequest field
      batchRequest.context.ws = connection;
      return Promise.resolve({batchRequest, batchResponseMetadata: {}});
    };

    wsServer.on('listening', () => resolve({port, shutDown}));

    wsServer.on('connection', connection => {
      // $FlowFixMe this method exists, but flow is confused
      connection.setMaxListeners(100);

      // request will not outlive connection
      let request;
      connection.once('message', message => {
        getBatchRequestPromise(connection, message)
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
              connection.send(result);
            }
          })
          .catch(error => {
            connection.send(JSON.stringify(constructServerError(error)));
          })
          .then(() => {
            /**
             * In case websocket connection is not closed immediately after
             * response from Bagel.
             *
             * TODO: this section should be rewritten with .finally when we
             * switch to Node 10.
             */
            connection.close();
          });
      });
      connection.once('close', () => {
        afterRequestComplete({
          batchRequest: request,
          batchResponseMetadata: {}
        });
      });
    });
  });
export default createIO;
