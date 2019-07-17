// @flow

// This feels fancy to me, but I like the results. Chains together an array of
// interceptor functions that look like this:
// ({moduleID, requestContext, next}) => {
//   if(iWantToShortCircuit){
//       return moduleExports;
//   }else{
//      return next(moduleName, requestContext);
//   }
// }
//
// Heavily influenced by redux and express middleware

import type {Interceptor} from '.';

const wrapRequireWithInterceptors = (
  require: string => any,
  requestContext: {},
  interceptors: Array<Interceptor>
) => {
  let prev = require;
  for (const interceptor of [...interceptors].reverse()) {
    const capturedPrev = prev;
    prev = (moduleID: string) =>
      interceptor({moduleID, requestContext, next: capturedPrev});
  }
  return prev;
};

export default wrapRequireWithInterceptors;
