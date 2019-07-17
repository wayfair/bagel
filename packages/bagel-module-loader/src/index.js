// @flow

import path from 'path';
import fs from 'fs';
import defaultResolver from './default_resolver';
import isBuiltinModule from './is_builtin_module';
import wrapRequireWithInterceptors from './wrap_require_with_interceptors';
import lruCache from 'lru-cache';
import vm from 'vm';

type Resolver = (
  dependencyID: string,
  from: string,
  requestContext: {}
) => string | null;

type Interceptor = ({
  moduleID: string,
  requestContext: {[string]: any},
  next: string => any
}) => any;

type Transformer = ({path: string, source: string}) => {
  errors: Array<string>,
  transformedSource: string
};

type LoadModule = (
  moduleID: string,
  loadModuleFrom: string,
  requestContext: {[string]: any}
) => any;

type GenerateModuleCacheKey = ({
  moduleID: string,
  requestContext: Object,
  pathToSourceFile: string
}) => string | null;

// Module resolution is expensive. If files live in node_modules, we can cache
// them for the lifetime of the application. Caching other modules may be trickier
// since they may be managed by an application deployment process.
const nodeModuleResolverCache = {};

// The 'resolve' function loops through resolvers provided, falling back
// on default node resolution if none of the provided resolvers are able
// to resolve the module.
const makeResolve = ({resolvers, requestContext}) => (dependencyID, from) => {
  let pathToModule;

  const resolveNodeModule = (id, from) => {
    if (!nodeModuleResolverCache[id]) {
      nodeModuleResolverCache[id] = defaultResolver(id, {
        basedir: path.dirname(from)
      });
    }
    return nodeModuleResolverCache[id];
  };

  for (const resolver of [...resolvers, resolveNodeModule]) {
    // $FlowFixMe variable number of arguments for resolver
    const resolved = resolver(dependencyID, from, requestContext);
    if (resolved) {
      pathToModule = resolved;
      break;
    }
  }
  return pathToModule;
};

// Get the full filename based on a module name and path to parent
const getFilename = ({resolve, moduleName, pathToParent}) => {
  let filename;

  try {
    filename = resolve(moduleName, pathToParent);
  } catch (e) {
    e.__rootError = true;
    if (e.message) {
      e.message = `Could not resolve module: ${moduleName}, imported by ${pathToParent}
${e.message}
            `;
    }
    throw e;
  }

  if (!filename) {
    throw new Error(
      `Could not resolve module: ${moduleName}, imported by ${pathToParent}`
    );
  }

  return filename;
};

// Transform the initial module source code with each of the transformer
// functions.
const getModuleSource = ({filename, sourceCodeTransformers}) => {
  return sourceCodeTransformers.reduce((source, transformer) => {
    const {errors, transformedSource} = transformer({
      path: filename || '',
      source
    });

    if (errors.length) {
      throw new Error(`[LoadModule] Transform error(s):\n${errors.join('\n')}`);
    }

    return transformedSource;
  }, fs.readFileSync(filename, 'utf-8'));
};

// Compile and cache module wrappers
const makeLoadModuleExports = ({
  filename,
  cacheKey,
  moduleWrapperCache,
  finalizeSource
}) => {
  let loadModuleExports;
  if (cacheKey) {
    loadModuleExports = moduleWrapperCache.get(cacheKey);
  }

  if (!loadModuleExports) {
    // @NOTE we are not sandboxing, and share globals.
    // however we cache the wrapper, not the exports, so each module is unique per request.
    loadModuleExports = vm.runInThisContext(finalizeSource(), {
      filename,
      cacheKey
    });

    if (cacheKey) {
      moduleWrapperCache.set(cacheKey, loadModuleExports);
    }
  }

  return loadModuleExports;
};

const createLoadModule = (options: {
  resolvers?: Array<Resolver>,
  interceptors?: Array<Interceptor>,
  sourceCodeTransformers?: Array<Transformer>,
  wrapModule?: string => string,
  generateModuleCacheKey?: GenerateModuleCacheKey,
  useResolverCache?: boolean
}) => {
  const {resolvers, interceptors, sourceCodeTransformers, useResolverCache} = {
    resolvers: [],
    interceptors: [],
    sourceCodeTransformers: [],

    // If you pass true for this option, the resolved paths for imports will be cached.
    // Leave this off if you need to handle relative imports.
    useResolverCache: false,
    ...options
  };

  const moduleWrapperCache = lruCache({max: 10000});

  // Pass in your own cache key generator or default to filepath
  const generateModuleCacheKey =
    options.generateModuleCacheKey ||
    (({pathToSourceFile}) => pathToSourceFile);

  // Pass in your own wrapper function if you like. This is one way (though probably not the best way) to insert additional functionality
  // in to your module. For example, the 'define' function that an AMD module relies on.
  const wrapModule =
    options.wrapModule ||
    (source => `(function (exports, require, module, __filename, __dirname) {
      ${source}
    })`);

  /**
   * This is the actual loadModule function
   */
  const moduleHandler: LoadModule = (
    moduleID,
    loadModuleFrom,
    requestContext
  ) => {
    // Store all the module exports here in order to avoid having more than one
    // instance of a given module in the dependency graph.
    const moduleRegistry = {};

    const resolve = makeResolve({resolvers, requestContext});

    // Inside a single dependency graph, we may be requiring the same module many times. Cache
    // the location of the module
    const moduleResolutionCache = {};

    // The 'require' function we provide to each module has to be unique for that module,
    // because it needs to know where the module source file lives in order to do relative imports correctly.
    // makeRequire creates this function.
    const makeRequire = pathToParent => {
      const customRequire = moduleName => {
        if (!moduleName) {
          throw new Error('moduleName is not defined');
        }

        if (isBuiltinModule(moduleName)) {
          // $FlowFixMe flow doesn't like non-string-literals passed to require, but I'm not sure how else to do this.
          return require(moduleName);
        }

        let filename;

        if (useResolverCache) {
          if (!moduleResolutionCache[moduleName]) {
            moduleResolutionCache[moduleName] = getFilename({
              moduleName,
              pathToParent,
              resolve
            });
          }

          filename = moduleResolutionCache[moduleName];
        } else {
          filename = getFilename({
            moduleName,
            pathToParent,
            resolve
          });
        }

        if (moduleRegistry[filename]) {
          return moduleRegistry[filename].exports;
        }

        const cacheKey = generateModuleCacheKey({
          moduleID: moduleName,
          pathToSourceFile: filename,
          requestContext
        });

        try {
          const loadModuleExports = makeLoadModuleExports({
            filename,
            cacheKey,
            moduleWrapperCache,
            finalizeSource: () =>
              wrapModule(getModuleSource({filename, sourceCodeTransformers}))
          });

          // these exports are mutated, reference from one variable for simplicity
          moduleRegistry[filename] = {exports: {}};

          loadModuleExports(
            moduleRegistry[filename].exports,
            makeRequire(filename),
            moduleRegistry[filename],
            filename,
            path.dirname(filename)
          );
        } catch (e) {
          if (!e.__rootError) {
            e.__rootError = true;
            e.message = `Error loading module ${moduleName} from ${pathToParent}.
${e.message}`;
            // Don't add to the error message if we're at the root of the
            // dependency graph
          } else if (moduleName !== moduleID) {
            e.message = `Error loading dependencies of ${pathToParent}.
${e.message}`;
          }
          throw e;
        }

        return moduleRegistry[filename].exports;
      };

      customRequire.resolve = moduleID => resolve(moduleID, pathToParent);

      // Give the interceptors a chance to intercept and/or modify the call to require
      // It's conceivable that interceptors may want to know what a module's resolved filename is.
      // We could modify the api to pass in the resolve function. I see an immediate use case for that
      // now though.
      return wrapRequireWithInterceptors(
        customRequire,
        requestContext,
        interceptors
      );
    };

    return makeRequire(loadModuleFrom)(moduleID);
  };

  return moduleHandler;
};

export default createLoadModule;
export type {
  Resolver,
  Interceptor,
  Transformer,
  LoadModule,
  GenerateModuleCacheKey
};
