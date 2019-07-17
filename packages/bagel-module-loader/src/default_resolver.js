/**
 * @flow
 */

import fs from 'fs';
import path from 'path';
import isBuiltinModule from './is_builtin_module';

import nodeModulesPaths from './node_modules_paths';

type Path = string;

type ResolverOptions = {|
  basedir: Path,
  browser?: boolean,
  extensions?: Array<string>,
  moduleDirectory?: Array<string>,
  paths?: ?Array<Path>
|};

/*
 * Adapted from: https://github.com/substack/node-resolve by way of https://github.com/facebook/jest
 */
type ErrorWithCode = Error & {code?: string};

// eslint-disable-next-line no-useless-escape
const REGEX_RELATIVE_IMPORT = /^(?:\.\.?(?:\/|$)|\/|([A-Za-z]:)?[\\\/])/;

function resolveSync(target: Path, options: ResolverOptions): Path {
  const basedir = options.basedir;
  const extensions = options.extensions || ['.js'];
  const paths = options.paths || [];

  if (REGEX_RELATIVE_IMPORT.test(target)) {
    // resolve relative import
    const resolveTarget = path.resolve(basedir, target);
    // eslint-disable-next-line no-use-before-define
    const result = tryResolve(resolveTarget);
    if (result) {
      return result;
    }
  } else {
    // otherwise search for node_modules
    const dirs = nodeModulesPaths(basedir, {
      moduleDirectory: options.moduleDirectory,
      paths
    });
    for (let i = 0; i < dirs.length; i++) {
      const resolveTarget = path.join(dirs[i], target);
      // eslint-disable-next-line no-use-before-define
      const result = tryResolve(resolveTarget);
      if (result) {
        return result;
      }
    }
  }

  if (isBuiltinModule(target)) {
    return target;
  }

  const err: ErrorWithCode = new Error(
    "Cannot find module '" + target + "' from '" + basedir + "'"
  );
  err.code = 'MODULE_NOT_FOUND';
  throw err;

  /*
   * contextual helper functions
   */
  function tryResolve(name: Path): ?Path {
    const dir = path.dirname(name);
    let result;
    // eslint-disable-next-line no-use-before-define
    if (isDirectory(dir)) {
      // eslint-disable-next-line no-use-before-define
      result = resolveAsFile(name) || resolveAsDirectory(name);
    }
    if (result) {
      // Dereference symlinks to ensure we don't create a separate
      // module instance depending on how it was referenced.
      result = fs.realpathSync(result);
    }
    return result;
  }

  function resolveAsFile(name: Path): ?Path {
    // eslint-disable-next-line no-use-before-define
    if (isFile(name)) {
      return name;
    }

    for (let i = 0; i < extensions.length; i++) {
      const file = name + extensions[i];
      // eslint-disable-next-line no-use-before-define
      if (isFile(file)) {
        return file;
      }
    }

    // eslint-disable-next-line no-undefined
    return undefined;
  }

  function resolveAsDirectory(name: Path): ?Path {
    // eslint-disable-next-line no-use-before-define
    if (!isDirectory(name)) {
      // eslint-disable-next-line no-undefined
      return undefined;
    }

    const pkgfile = path.join(name, 'package.json');
    let pkgmain;
    try {
      const body = fs.readFileSync(pkgfile, 'utf8');
      pkgmain = JSON.parse(body).main;

      // eslint-disable-next-line no-empty
    } catch (e) {}

    if (pkgmain && pkgmain !== '.') {
      const resolveTarget = path.resolve(name, pkgmain);
      const result = tryResolve(resolveTarget);
      if (result) {
        return result;
      }
    }

    return resolveAsFile(path.join(name, 'index'));
  }
}

/*
 * helper functions
 */
function isFile(file: Path): boolean {
  let result;

  try {
    const stat = fs.statSync(file);
    result = stat.isFile() || stat.isFIFO();
  } catch (e) {
    if (!(e && e.code === 'ENOENT')) {
      throw e;
    }
    result = false;
  }

  return result;
}

function isDirectory(dir: Path): boolean {
  let result;

  try {
    const stat = fs.statSync(dir);
    result = stat.isDirectory();
  } catch (e) {
    if (!(e && (e.code === 'ENOENT' || e.code === 'ENOTDIR'))) {
      throw e;
    }
    result = false;
  }

  return result;
}

export default function defaultResolver(
  path: Path,
  options: ResolverOptions
): Path {
  return resolveSync(path, {
    basedir: options.basedir,
    extensions: options.extensions,
    moduleDirectory: options.moduleDirectory,
    paths: options.paths
  });
}
