// @flow

import createLoadModule, {
  type Resolver,
  type Interceptor,
  type Transformer,
  type GenerateModuleCacheKey
} from 'bagel-module-loader';
import createBatchHandler from './batch_handler';
import createJobHandler from './job_handler';
import createRenderHandler from './render_handler';
import loadModuleHandlerAdapter from './utils/module_loader_adapter';
import createHTTPServer from './http_io';
import jobResponseUuidPlugin from './plugins/job_response_uuid_plugin';
import lifeCycleLogger from './plugins/lifecycle_logger';
import logger from './utils/logger';
import {streamRenderer, stringRenderer} from './utils/default_renderer';
import withPluginHooks from './utils/with_plugin_hooks';
import type {Config, Plugin, Renderer, TransportType} from './types';

const defaultConfig: Config = {
  plugins: [lifeCycleLogger, jobResponseUuidPlugin],
  renderer: stringRenderer,
  interceptors: [],
  port: 3030,
  transport: createHTTPServer
};

/**
 * Main bagel initialization function. Takes a configuration object
 */
const init = (
  userConfig: {
    moduleResolvers: Array<Resolver>,
    interceptors: Array<Interceptor>,
    sourceCodeTransformers: Array<Transformer>,
    generateModuleCacheKey?: GenerateModuleCacheKey,
    wrapModule?: string => string,
    renderer?: Renderer,
    plugins: Array<Plugin>,
    port?: number,
    transport?: TransportType,
    useResolverCache?: boolean
  } = {
    moduleResolvers: [],
    interceptors: [],
    sourceCodeTransformers: [],
    plugins: [],
    renderer: defaultConfig.renderer,
    port: defaultConfig.port,
    transport: defaultConfig.transport
  }
) => {
  const config: {
    moduleResolvers: Array<Resolver>,
    interceptors: Array<Interceptor>,
    sourceCodeTransformers: Array<Transformer>,
    plugins: Array<Plugin>,
    renderer: Renderer,
    port: number,
    transport: TransportType
  } = {
    ...defaultConfig,
    ...userConfig
  };

  config.port = config.port || defaultConfig.port;
  config.renderer = config.renderer || defaultConfig.renderer;
  config.plugins = defaultConfig.plugins.concat(userConfig.plugins || []);
  config.interceptors = defaultConfig.interceptors.concat(
    userConfig.interceptors || []
  );

  // get the plugin aware hooks for the each task
  const {
    withJobHooks,
    withBatchHooks,
    withLoadModuleHooks,
    withRenderHooks,
    afterRequestComplete
  } = withPluginHooks({
    plugins: config.plugins,
    // eslint-disable-next-line no-use-before-define
    loadModule: (...args) => loadModuleHandler({...args})
  });

  /**
   * Here we wire together the various functions bagel needs. In order to
   * handle a job request, we need to be able to load a root module,
   * and need some way to render that to HTML
   */
  const loadModule = createLoadModule({
    resolvers: config.moduleResolvers,
    interceptors: config.interceptors,
    wrapModule: userConfig.wrapModule,
    sourceCodeTransformers: userConfig.sourceCodeTransformers,
    generateModuleCacheKey: userConfig.generateModuleCacheKey,
    useResolverCache: userConfig.useResolverCache
  });

  const loadModuleHandler = withLoadModuleHooks(
    loadModuleHandlerAdapter(loadModule)
  );

  const renderHandlerWithHooks = withRenderHooks(
    createRenderHandler(config.renderer)
  );

  const jobHandler = withJobHooks(
    createJobHandler(renderHandlerWithHooks, loadModuleHandler)
  );

  /**
   * A batch request is a collection of job requests. Configure handleBatchRequest
   * with our handleJobRequest function
   */
  const batchHandler = withBatchHooks(createBatchHandler(jobHandler));

  const options = {batchHandler, port: config.port, afterRequestComplete};

  /**
   * Starts a server that will listen on a transport (http or websocket), calling
   * handleBatchRequest when requests come in.
   */

  return config.transport(options);
};

export default init;

export {default as wsRequest} from './utils/ws_request';
export {default as websocketTransport} from './websocket_io';

export {
  default as getInitialPropsPlugin
} from './plugins/get_initial_props_plugin';

export {
  logger,
  streamRenderer,
  stringRenderer,
  createHTTPServer as httpTransport
};

export * from './types';
