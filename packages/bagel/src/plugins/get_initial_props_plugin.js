// @flow
/* eslint-disable consistent-return*/

import type {Plugin} from '../types.js';

const getInitialPropsPlugin: Plugin = {
  beforeRender({module, jobRequest, parentBatchRequest, jobResponseMetadata}) {
    if (
      module.getInitialProps &&
      typeof module.getInitialProps === 'function'
    ) {
      const {stopwatch} = parentBatchRequest.context;

      // create "getInitialProps" stopwatch event name
      const initialPropsEventName = stopwatch.getInitialPropsEventName(
        jobRequest.name
      );

      // stopwatch descriptor
      const stopwatchDescriptor = {
        id: jobRequest.metadata.jobId,
        name: initialPropsEventName,
        module: jobRequest.name,
        async: true
      };

      stopwatch.start(stopwatchDescriptor);
      // we are not sure if getInitialProps is sync or async
      return Promise.resolve(module.getInitialProps(jobRequest.props)).then(
        finalProps => {
          stopwatch.stop(stopwatchDescriptor);
          /**
           * Replace props with the result of the getInitialProps, add finalProps.
           */

          jobResponseMetadata.finalProps = finalProps;
          jobRequest.props = finalProps;
        }
      );
    }
  }
};

export default getInitialPropsPlugin;
