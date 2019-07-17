```
 _                      _
| |                    | |
| |__   __ _  __ _  ___| |
| '_ \ / _` |/ _` |/ _ \ |
| |_) | (_| | (_| |  __/ |
|_.__/ \__,_|\__, |\___|_|
              __/ |
             |___/
```

Bagel is a flexible rendering service for server-rendered React applications.

Bagel was built to solve a specific set of problems at [Wayfair](https://tech.wayfair.com/):

- **React rendering as a service.** If you have an existing non-JavaScript backend and want to render React applications, Bagel can help.
- **Configurable network transport layer.** Maybe you want to use HTTP to communicate with your service. Maybe you want to use WebSockets, maybe TCP, maybe Morse code over telegraph. Bagel makes it easy to use whatever you want.
- **Extremely flexible [module loading](./packages/bagel-module-loader/README.md).** Code built to run in a browser may not run correctly in a server environment where all modules are singletons shared across requests. Frontend code may rely on module formats (haste-style flat namespaces, for example) that don't work out-of-the-box in a Node environment. You may need to have fine-grained control over which specific modules are singletons, shared across requests, and which are reloaded every time.

## Getting Started

Bagel is designed to be run as an imported library.

`yarn install bagel`

```
import bagel from 'bagel'

bagel({
    moduleResolvers: [],
    interceptors: [],
    sourceCodeTransformers: [],
    port: 3030
});

// bagel is now ready to serve requests

```

The code above will only be able to load modules using the default Node.js module resolver, which means you will only be able to render React components that are in your project's `node_modules` directory. For more flexibility with how your root components are loaded, you'll need to supply a module resolver. See the `Resolver` type in the [module loader index file](./packages/bagel-module-loader/src/index.js) file or examples in [tests](./packages/bagel/src/__tests__/example.spec.js) for details on what a module resolver should look like.

Bagel should work with any [Hypernova client](https://github.com/airbnb/hypernova/blob/master/docs/clients.md). Please see [tests](./packages/bagel/src/__tests__/example.spec.js) for a good selection of examples.

## Plugins

Developers can create plugins to tap into Bagel's core operation. With plugins, you are able to hook into actions before and after they happen. Plugins have access to a context object which they are able to write to and use within various stages of the request.

Flow types for plugins:

```javascript
type LifeCycleMethod<T> = T => Promise<void> | void;

type Plugin = {
  beforeBatch?: LifeCycleMethod<BatchHandlerRequest>,
  afterBatch?: LifeCycleMethod<BatchHandlerResponse>,
  beforeJob?: LifeCycleMethod<JobHandlerRequest>,
  afterJob?: LifeCycleMethod<JobHandlerResponse>,
  beforeLoadModule?: LifeCycleMethod<JobHandlerRequest>,
  afterLoadModule?: LifeCycleMethod<RenderHandlerRequest>,
  beforeRender?: LifeCycleMethod<RenderHandlerRequest>,
  afterRender?: LifeCycleMethod<JobHandlerResponse>
};
```

## Request and Response Types

A Bagel request / response cycle is encompassed in a BatchRequest and a BatchResponse. These objects, and the associated JobRequest / JobResponse objects, are the primary means by which data flows through the Bagel application during a request.

A batch is a single request / response cycle from a client application. A batch may contain one or more jobs. A job corresponds to a single root React component which needs to be rendered.

Most of the hooks provided by Bagel (plugins, module loader interceptors, module resolvers) have access to job and batch requests and response objects.

### Metadata

Applications may pass request-related metadata into Bagel, where Bagel returns response-related metadata. Example uses of metadata inlude supplying a request ID to Bagel, and supplying performance profile data to a client application.

### Batch Context

Each batch has its own 'global' context object which is present during the entire life cycle of the batch. We know unstructured globals are a madness-inducing antipattern, but sometimes you need an escape hatch. If you need to share arbitrary data between different parts of the system during a request, the context object will permit this.

### Flow Types

```javascript
type BatchRequest = {
  jobs: {[string]: JobRequest},
  // context is a single object, 'global' to the batch, shared between the BatchRequest and BatchReponse object
  context: {[string]: any}
};

type BatchResponse = {
  jobs: {[string]: JobResponse},
  // context is a single object, 'global' to the batch, shared between the BatchRequest and BatchReponse object
  context: {[string]: any}
};

type JobRequest = {
  name: string,
  props: {},
  metadata: {
    jobId: string,
    [string]: any
  }
};

type JobResponse = {
  htmlStream: Readable,
  metadata: {[string]: any}
};
```

## Built With

- [Babel](https://babeljs.io/)
- [Flow](https://flow.org/)
- [Jest](https://jestjs.io/)

## Contributing

Please read [Code of Conduct.md](CODE_OF_CONDUCT.md) for details on our Code of Conduct.

To contribute, please open an issue or submit a pull request with appropriate test coverage.

## Building

`yarn build`

## Running the tests

```
yarn test
yarn test-watch
yarn test-watch-debug
yarn test-debug
```

## Running eslint

`yarn lint`

## Checking Flow Types

`yarn flow`

## Deploying

In a production environment, you'll want to have a process manager such as [PM2](http://pm2.keymetrics.io/) to keep the correct number of Bagel workers running.

## Authors

[Artem Ruts](https://github.com/artemruts)

[Claudio Herrara](https://github.com/claudioherrera)

[Morgan Packard](https://github.com/morganpackard)

[Nick Dreckshage](https://github.com/ndreckshage)

## License

This project is licensed under the BSD-2-Clause license. See the [License](./LICENSE) file for details.

## History

Bagel began as a fork of Airbnb's [Hypernova](https://github.com/airbnb/hypernova) renderer (thanks Airbnb!). By default, it implments the same API as Hypernova, and can be used with any Hypernova client. Wayfair uses a version of our own publically available [PHP client](https://github.com/wayfair/hypernova-php) which has been modified to use WebSockets instead of HTTP.

We chose the name Bagel because:

- Rather than going large, hard, powerful, and industrial with the name, we opted for modest, simple, and tasty.
- Riffing on the name of Bagel's main inspiration, Hypernova, we thought about nova lox, which is a kind of smoked salmon, which tastes great on bagels.

```

```
