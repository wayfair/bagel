// @flow

import type {LifeCycleMethod, ErrorResponse} from '../types';

const makePromiseChain = <T: Object>(fns: Array<LifeCycleMethod<T>>) => (
  initialValue: Object
): Promise<T> => {
  /**
   * Note: We're not operating with copies of objects (copies are expensive),
   * every change to the object by Plugin's life cycle hook will alter the
   * original object.
   */
  return fns.reduce(
    (prev, next) =>
      /**
       * Since we're not sure all of the Plugin's life cycle methods return
       * promises, we'll wrap with Promise.resolve and explicitly "promisify" them.
       * Checking if "prev" is an instance of Promise, has ".then" and ".catch",
       * etc is more expensive. [TODO: insert proofs here].
       * Promise.resolve will slow us down only for one tick per wrapped function.
       */
      Promise.resolve(prev)
        .then(() => next({...initialValue}))
        /**
         * We never care about the return value - it's always the initialValue
         * passed by reference.
         */
        .then(() => initialValue),
    initialValue
  );
};

/**
 * This generic function allows us not to create extra Promise chains if we
 * don't have Plugins that implement some life cycles.
 */
const chainHandlerWithHooks = <Request, Response>({
  beforeHooksChain,
  afterHooksChain,
  handler,
  errorHandler,
  request
}: {
  /**
   * Every chain of hooks will return it's argument (object) wrapped in a Promise.
   * Before and After chains of hooks may not exist if we don't have plugins that
   * implement those hooks.
   */
  beforeHooksChain?: Request => Promise<Request>,
  afterHooksChain?: Response => Promise<Response>,
  /**
   * Handler (Batch, Job, LoadModule or Render) transforms generic Request
   * into generic Response.
   */
  handler: Request => Promise<Response>,
  // $FlowFixMe, technically it throws it and not returns
  errorHandler: Object => Promise<ErrorResponse>,
  // initial generic request to kick of the chain of promises
  request: Request
}): Promise<Response> => {
  let handlerPluginsChain;

  if (beforeHooksChain && afterHooksChain) {
    handlerPluginsChain = beforeHooksChain(request)
      .then(handler)
      .then(afterHooksChain);
  } else if (beforeHooksChain && !afterHooksChain) {
    handlerPluginsChain = beforeHooksChain(request).then(handler);
  } else if (!beforeHooksChain && afterHooksChain) {
    handlerPluginsChain = handler(request).then(afterHooksChain);
  } else {
    handlerPluginsChain = handler(request);
  }

  return errorHandler
    ? handlerPluginsChain.catch(error =>
        /**
         * If an error object already has a type key - it was caught somewhere
         * down the promise chain and we don't need to call errorHandler on it.
         * Just forward it to the top.
         */
        error.type ? Promise.reject(error) : Promise.reject(errorHandler(error))
      )
    : handlerPluginsChain;
};

export {makePromiseChain, chainHandlerWithHooks};
