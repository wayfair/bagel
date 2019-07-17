// @flow

import wrapRequireWithInterceptors from '../wrap_require_with_interceptors';
import type {Interceptor} from '../';

const delegatesToNext: Interceptor = ({moduleID, next}) => next(moduleID);

const returnsBananaOnItsOwn: Interceptor = () => 'banana';
const returnsRadishOnItsOwn: Interceptor = () => 'radish';

let requireFn;

beforeEach(() => {
  requireFn = jest.fn();
});

it('should not explode', () => {
  wrapRequireWithInterceptors(requireFn, {}, []);
});

it('should call the final require', () => {
  const wrappedRequire = wrapRequireWithInterceptors(requireFn, {}, []);
  wrappedRequire('foo');
  expect(requireFn).toHaveBeenCalledWith('foo');
});

it('should call the first interceptor', () => {
  const interceptor = jest.fn();
  const wrappedRequire = wrapRequireWithInterceptors(requireFn, {}, [
    interceptor
  ]);
  wrappedRequire('foo');
  expect(interceptor).toHaveBeenCalled();
});

it('should call the final require if no interceptors handle the request', () => {
  const wrappedRequire = wrapRequireWithInterceptors(requireFn, {}, [
    delegatesToNext,
    delegatesToNext
  ]);

  wrappedRequire('foo');
  expect(requireFn).toHaveBeenCalled();
});

it('should allow an interceptor to short-circuit it', () => {
  const wrappedRequire = wrapRequireWithInterceptors(requireFn, {}, [
    delegatesToNext,
    returnsBananaOnItsOwn
  ]);

  const loaded = wrappedRequire('foo');
  expect(loaded).toBe('banana');
  expect(requireFn).not.toHaveBeenCalled();
});

it('uses the value of the first interceptor that short-circuits', () => {
  const wrappedRequire = wrapRequireWithInterceptors(requireFn, {}, [
    returnsRadishOnItsOwn,
    returnsBananaOnItsOwn
  ]);

  const loaded = wrappedRequire('foo');
  expect(loaded).toBe('radish');
});
