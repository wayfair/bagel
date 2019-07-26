// @flow

import {makePromiseChain, chainHandlerWithHooks} from './plugin_utils';
import {groupObjectsByKeys} from './utils';
import {
  loadModuleError,
  renderError,
  batchError,
  jobError
} from './serialize_error';

import type {
  Plugin,
  BatchHandlerRequest,
  BatchHandler,
  JobHandlerRequest,
  JobHandler,
  RenderHandlerRequest,
  BatchHandlerResponse,
  RenderHandler,
  JobHandlerResponse,
  LoadModuleHandler
} from '../types';

const withPluginHooks = ({plugins}: {plugins: Array<Plugin>}) => {
  // Group all of the life cycle hooks by name.
  const pluginLifeCycleHooks = groupObjectsByKeys(plugins);

  /**
   * Promise chains for every life cycle method from all available plugins,
   * if any were provided.
   */
  const {
    beforeBatch,
    afterBatch,
    beforeJob,
    afterJob,
    beforeLoadModule,
    afterLoadModule,
    beforeRender,
    afterRender,
    // fallback for the "afterRequestComplete" promise chain
    afterRequestComplete = (batchHandlerRequest: BatchHandlerRequest) =>
      Promise.resolve(batchHandlerRequest)
  } =
    // Combine an each array of life cycle methods into a single Promise chain.
    Object.keys(pluginLifeCycleHooks).reduce((acc, name) => {
      acc[name] = makePromiseChain(pluginLifeCycleHooks[name]);
      return acc;
    }, {});

  const withJobHooks = (jobHandler: JobHandler) => (
    jobHandlerRequest: JobHandlerRequest
  ) => {
    const jobErrorHandler = error => {
      const {name, metadata} = jobHandlerRequest.jobRequest;
      return jobError({
        error,
        metadata,
        name
      });
    };

    return (chainHandlerWithHooks({
      handler: jobHandler,
      errorHandler: jobErrorHandler,
      beforeHooksChain: beforeJob,
      afterHooksChain: afterJob,
      request: jobHandlerRequest
    }): Promise<JobHandlerResponse>);
  };

  const withBatchHooks = (batchHandler: BatchHandler) => (
    batchHandlerRequest: BatchHandlerRequest
  ) => {
    const batchErrorHandler = error =>
      batchError({
        error,
        context: batchHandlerRequest.batchRequest.context,
        code: error.code || 500
      });

    return (chainHandlerWithHooks({
      handler: batchHandler,
      errorHandler: batchErrorHandler,
      beforeHooksChain: beforeBatch,
      afterHooksChain: afterBatch,
      request: batchHandlerRequest
    }): Promise<BatchHandlerResponse>);
  };

  const withLoadModuleHooks = (loadModuleHandler: LoadModuleHandler) => (
    jobHandlerRequest: JobHandlerRequest
  ) => {
    const loadModuleErrorHandler = error => {
      const {name, metadata} = jobHandlerRequest.jobRequest;
      return loadModuleError({
        error,
        metadata,
        name
      });
    };

    return (chainHandlerWithHooks({
      handler: loadModuleHandler,
      errorHandler: loadModuleErrorHandler,
      beforeHooksChain: beforeLoadModule,
      afterHooksChain: afterLoadModule,
      request: jobHandlerRequest
    }): Promise<RenderHandlerRequest>);
  };

  const withRenderHooks = (renderHandler: RenderHandler) => (
    renderHandlerRequest: RenderHandlerRequest
  ) => {
    const renderErrorHandler = error => {
      const {name, metadata} = renderHandlerRequest.jobRequest;
      return renderError({
        error,
        metadata,
        name
      });
    };

    return (chainHandlerWithHooks({
      handler: renderHandler,
      errorHandler: renderErrorHandler,
      beforeHooksChain: beforeRender,
      afterHooksChain: afterRender,
      request: renderHandlerRequest
    }): Promise<JobHandlerResponse>);
  };

  return {
    withJobHooks,
    withBatchHooks,
    withLoadModuleHooks,
    withRenderHooks,
    afterRequestComplete
  };
};

export default withPluginHooks;
