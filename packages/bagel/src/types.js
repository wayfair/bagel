// @flow

import type {Interceptor} from 'bagel-module-loader';
import type {Stopwatch, StopwatchEvent} from './utils/stopwatch';
import type {Readable} from 'stream';

type JobMetadata = {
  jobId: string,
  [string]: any
};

type JobRequest = {
  name: string,
  props: {},
  metadata: JobMetadata
};

type ErrorResponse = {
  name: string,
  message: string,
  stack: Array<string> | null,
  pid: number,
  type: string,
  jobId?: string
};

type JobResponse = {
  renderDonePromise: Promise<string>,
  htmlStream: Readable | null,
  metadata: {[string]: any}
};

type BatchRequestContext = {stopwatch: Stopwatch, [string]: any};

type BatchRequest = {
  jobs: {[string]: JobRequest},
  context: BatchRequestContext
};

type BatchResponse = {
  jobs: {[string]: JobResponse},
  metadata: {[string]: mixed},
  [string]: mixed
};

// BatchHandler
type BatchHandlerRequest = {
  batchRequest: BatchRequest,
  batchResponseMetadata: {[string]: mixed}
};

type BatchHandlerResponse = {
  batchRequest: BatchRequest,
  batchResponse: BatchResponse,
  batchResponseMetadata: {[string]: any}
};

type BatchHandler = BatchHandlerRequest => Promise<BatchHandlerResponse>;

// JobHandler
type JobHandlerRequest = {
  jobRequest: JobRequest,
  parentBatchRequest: BatchRequest,
  jobResponseMetadata: {[string]: mixed},
  batchResponseMetadata: {[string]: mixed}
};

type JobHandlerResponse = {
  jobResponse: JobResponse,
  jobRequest: JobRequest,
  parentBatchRequest: BatchRequest,
  batchResponseMetadata: {[string]: mixed}
};

type JobHandler = JobHandlerRequest => Promise<JobHandlerResponse>;

// RenderHandler
type RenderHandlerRequest = {
  module: any,
  jobRequest: JobRequest,
  parentBatchRequest: BatchRequest,
  jobResponseMetadata: {[string]: mixed},
  batchResponseMetadata: {[string]: mixed}
};

type RenderHandler = RenderHandlerRequest => Promise<JobHandlerResponse>;

type RenderToString = ({component: any, props: {}}) => string;
type RenderToStream = ({component: any, props: {}}) => Readable;

type Renderer = ({
  component: any,
  props: {},
  jobRequest: JobRequest,
  parentBatchRequest: BatchRequest,
  batchResponseMetadata: {[string]: mixed}
}) => string | Readable;

// ModuleLoadHandler
type LoadModuleHandler = JobHandlerRequest => Promise<RenderHandlerRequest>;

// Plugin
type LifeCycleMethod<T> = T => Promise<void> | void;

type Plugin = {
  beforeBatch?: LifeCycleMethod<BatchHandlerRequest & LoadModuleHandler>,
  afterBatch?: LifeCycleMethod<BatchHandlerResponse & LoadModuleHandler>,
  afterRequestComplete?: LifeCycleMethod<
    BatchHandlerRequest & LoadModuleHandler
  >,
  beforeJob?: LifeCycleMethod<JobHandlerRequest & LoadModuleHandler>,
  afterJob?: LifeCycleMethod<JobHandlerResponse & LoadModuleHandler>,
  beforeLoadModule?: LifeCycleMethod<JobHandlerRequest & LoadModuleHandler>,
  afterLoadModule?: LifeCycleMethod<RenderHandlerRequest & LoadModuleHandler>,
  beforeRender?: LifeCycleMethod<RenderHandlerRequest & LoadModuleHandler>,
  afterRender?: LifeCycleMethod<JobHandlerResponse & LoadModuleHandler>
};

type Config = {
  plugins: Array<Plugin>,
  interceptors: Array<Interceptor>,
  renderer: Renderer,
  port: number,
  transport: ({
    port: number,
    afterRequestComplete: Function,
    batchHandler: Function,
    host?: string
  }) => Promise<Object>
};

type ServerJobData = {
  name: string,
  html: string | null,
  meta: {
    [string]: mixed
  },
  duration: number,
  success: boolean,
  error: ErrorResponse | null,
  jobId: string
};

type ServerBatchData = {
  success: boolean,
  error: null | Error,
  results: {
    [string]: ServerJobData
  },
  metadata: {
    [string]: mixed
  },
  perfProfile: Array<StopwatchEvent>,
  error: [],
  success: boolean
};

type ClientRequest = {
  [string]: {
    name: string,
    metadata: {[string]: mixed},
    data: {}
  }
};

// TODO: find / write real ws annotations
type WebServer = {
  close: () => void,
  on: (
    event: string,
    handler: (connection: {
      once: (event: string, handler: (message: string) => void) => void,
      on: (event: string, handler: () => void) => void,
      send: (message: string) => void,
      close: (code?: number, reason?: string) => void
    }) => void
  ) => void
};

type TransportType = ({
  port: number,
  afterRequestComplete: Function,
  batchHandler: Function,
  host?: string
}) => Promise<Object>;

export type {
  // Plugin
  Plugin,
  LifeCycleMethod,
  // Batch
  BatchRequest,
  BatchResponse,
  BatchHandlerRequest,
  BatchRequestContext,
  BatchHandlerResponse,
  BatchHandler,
  // Job
  JobMetadata,
  JobRequest,
  JobResponse,
  JobHandlerRequest,
  JobHandlerResponse,
  JobHandler,
  // Render
  RenderHandlerRequest,
  RenderHandler,
  Renderer,
  RenderToString,
  RenderToStream,
  // ModuleLoader
  LoadModuleHandler,
  // Misc
  Config,
  ErrorResponse,
  ClientRequest,
  ServerJobData,
  ServerBatchData,
  WebServer,
  TransportType
};
