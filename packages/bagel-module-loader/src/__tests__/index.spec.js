// @flow

import createLoader, {type Resolver} from '../';
import {join} from 'path';
import vm from 'vm';

const testResolver: Resolver = (moduleName: string) =>
  ({
    bar: join(__dirname, './modules/bar.js'),
    foo: join(__dirname, './modules/foo.js'),
    accessGlobalContextVar: join(
      __dirname,
      './modules/access_global_context_variable.js'
    )
  }[moduleName]);

it('should load a file using a resolver provided', () => {
  // no matter what, always loads our foo module
  const load = createLoader({resolvers: [testResolver]});
  const loaded = load('foo', __dirname, {});
  expect(loaded).toBe('FOO');
});

it('should use the second resolver if the first returns null', () => {
  const fooResolver: Resolver = () => join(__dirname, './modules/foo.js');
  const load = createLoader({resolvers: [() => null, fooResolver]});
  const loaded = load('foo', __dirname, {});
  expect(loaded).toBe('FOO');
});

it('should fall back on the default node resolver and load node modules', () => {
  const load = createLoader({resolvers: [() => null]});
  const loaded = load('lru-cache', __dirname, {});
  expect(loaded).toBeTruthy();
});

it('should load nested dependencies', () => {
  const load = createLoader({resolvers: [testResolver]});
  const loaded = load('bar', __dirname, {});
  expect(loaded).toBe('FOO');
});

it('should handle empty exports', () => {
  const load = createLoader({resolvers: []});
  const loaded = load('./__tests__/modules/export_changer', __dirname, {});
  expect(loaded).toBeUndefined();
});

it('should cache modules inside a dependency graph', () => {
  // There's a 'counter' module with an 'increment function'. We import
  // and increment that  in counter_import, and also import another file
  // which imports it. If the module is shared across the two files
  // importing it, we'll see the counter go up to two.
  const load = createLoader({resolvers: []});
  const loaded = load('./__tests__/modules/counter_import', __dirname, {});
  expect(loaded.counter).toBe(2);
});

it('should allow interceptors to short-circuit it for nested dependencies', () => {
  const load = createLoader({
    resolvers: [testResolver],
    interceptors: [
      ({moduleID, next}) =>
        moduleID === 'foo' ? 'intercepted' : next(moduleID)
    ]
  });

  const loaded = load('bar', __dirname, {});
  expect(loaded).toBe('intercepted');
});

it('should allow a customized wrapper', () => {
  const load = createLoader({
    resolvers: [testResolver],
    wrapModule: source =>
      `(function (exports, require, module, __filename, __dirname) { const banana = 'banana';${source} });`
  });

  const loaded = load('accessGlobalContextVar', __dirname, {});
  expect(loaded).toBe('banana');
});

// @NOTE bagel-module-loader is NOT responsible for sandboxing
it('DOES leak globals', () => {
  const load = createLoader({
    resolvers: [testResolver],
    wrapModule: () =>
      `(function (exports, require, module) {
          global.counter = global.counter || 1;
          module.exports = global.counter++;
        });`
  });

  const l1 = load('foo', __dirname, {});
  const l2 = load('foo', __dirname, {});
  const l3 = load('foo', __dirname, {});

  expect(l1).not.toBe(l2);
  expect(l2).not.toBe(l3);
});

it('should cache module initializers', () => {
  const spy = jest.spyOn(vm, 'runInThisContext');
  const load = createLoader({resolvers: [testResolver]});

  expect(load('foo', __dirname, {})).toBe('FOO');
  expect(load('foo', __dirname, {})).toBe('FOO');
  expect(load('foo', __dirname, {})).toBe('FOO');

  expect(spy).toHaveBeenCalledTimes(1);
  spy.mockClear();
});

it('should cache module initializers with custom cache keys', () => {
  const spy = jest.spyOn(vm, 'runInThisContext');
  const pretendCacheBuster = Date.now();

  const load = createLoader({
    resolvers: [testResolver],
    generateModuleCacheKey: ({moduleID}) => `${moduleID}_${pretendCacheBuster}`
  });

  expect(load('foo', __dirname, {})).toBe('FOO');
  expect(load('foo', __dirname, {})).toBe('FOO');
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy.mock.calls[0][1].cacheKey).toBe(`foo_${pretendCacheBuster}`);

  spy.mockClear();
});

it('should not cache module initializers if falsy cache key', () => {
  const spy = jest.spyOn(vm, 'runInThisContext');
  const load = createLoader({
    resolvers: [testResolver],
    generateModuleCacheKey: () => null
  });

  expect(load('foo', __dirname, {})).toBe('FOO');
  expect(load('foo', __dirname, {})).toBe('FOO');
  expect(load('foo', __dirname, {})).toBe('FOO');
  expect(spy).toHaveBeenCalledTimes(3);

  spy.mockClear();
});
