// @flow
import type {ErrorResponse, BatchRequestContext} from '../types';

type Error = {
  message: string,
  stack: string
};

type Metadata = {
  [string]: string
};

type SerializeErrorInput = {
  error: Error,
  metadata: Metadata,
  name: string
};

const serializeError = ({
  error,
  metadata,
  name,
  type,
  code
}: {
  error: Error,
  metadata: Metadata,
  name: string,
  type: string,
  code?: number
}): ErrorResponse => ({
  ...metadata,
  name,
  type,
  message: (error && error.message) || 'unknown error message',
  stack: (error && error.stack && error.stack.split('\n    ')) || null,
  pid: process.pid,
  code
});

export const loadModuleError = ({error, metadata, name}: SerializeErrorInput) =>
  serializeError({
    error,
    metadata,
    name,
    type: 'LOADING_MODULE'
  });

export const renderError = ({error, metadata, name}: SerializeErrorInput) =>
  serializeError({
    error,
    metadata,
    name,
    type: 'RENDER'
  });

export const jobError = ({error, metadata, name}: SerializeErrorInput) =>
  serializeError({
    error,
    metadata,
    name,
    type: 'JOB'
  });

export const invalidRequestError = ({
  error,
  metadata,
  name
}: SerializeErrorInput) =>
  serializeError({
    error,
    metadata,
    name,
    type: 'INVALID_REQUEST'
  });

export const batchError = ({
  error,
  context,
  code = 500
}: {
  error: Error,
  context: BatchRequestContext,
  code: number
}) =>
  serializeError({
    error,
    metadata: context.metadata,
    name: 'unknown module name',
    type: 'BATCH',
    code
  });
