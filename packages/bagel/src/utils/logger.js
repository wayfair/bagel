// @flow

import consoleHandler from './console_logger_handler';

type LevelName = 'debug' | 'info' | 'warn' | 'error';
type LevelCode = 0 | 1 | 2 | 3;
type Metadata = {
  levelName: LevelName,
  levelCode: LevelCode,
  [string]: mixed
};

type MiddlewareFn = Metadata => Metadata;
type Middleware = {
  name: string,
  fn: MiddlewareFn
};
type MiddlewaresObject = {[string]: MiddlewareFn};
type HandlerFunction = (message: string, metadata?: Metadata) => void;
type LevelNameSet = Set<LevelName>;
type LevelNameOrCode = LevelName | LevelCode;
type HandlerObject = {
  fn: HandlerFunction,
  addedForLevels: LevelNameSet
};
type HandlersMap = Map<string, HandlerObject>;
type LevelNameArray = Array<LevelName>;
type HandlerNameSet = Set<string>;

type AddHandlerObject = {
  levels?: LevelNameArray,
  name: string,
  fn: HandlerFunction
};
type RemoveHandlerObject = {
  name: string,
  levels: LevelNameArray
};

type Logger = {
  addHandler: AddHandlerObject => void,
  addMiddleware: Middleware => void,
  removeMiddleware: string => void,
  removeAllMiddlewares: () => void,
  removeHandler: (RemoveHandlerObject | string) => void,
  getHandlers: (
    levelNameOrCode?: LevelNameOrCode
  ) => Array<{name: string, fn: HandlerFunction}>,
  getLevels: (
    handlerName?: string
  ) => Array<{code: LevelCode, level: LevelName}>,
  setGlobalLevel: LevelNameOrCode => void,
  getGlobalLevel: () => {code: LevelCode, level: LevelName | void},
  removeAllHandlers: ?(LevelNameArray | LevelName) => void,
  debug: HandlerFunction,
  info: HandlerFunction,
  warn: HandlerFunction,
  error: HandlerFunction
};

const DEFAULT_CODE = 0;
let globalCode: LevelCode = DEFAULT_CODE;
const handlers: HandlersMap = new Map();
let middlewares: MiddlewaresObject = {};

const levelToCode: {[levelName: LevelName]: LevelCode} = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const levelsToHandlers: {[levelName: LevelName]: HandlerNameSet} = {
  debug: new Set(),
  info: new Set(),
  warn: new Set(),
  error: new Set()
};

const printErrors = (prefix = 'unknown', errors = '') => {
  if (process.env.NODE_ENV !== 'production') {
    const errorsLength = errors.length;
    let isMultipleErrors;
    let errorString;

    if (Array.isArray(errors)) {
      if (errors.length) {
        errorString = errors.join('\n');
        isMultipleErrors = true;
      }
    } else if (errorsLength) {
      errorString = `${errors}\n`;
      isMultipleErrors = false;
    }

    if (errorString) {
      console.warn(
        `${prefix} error${isMultipleErrors ? 's' : ''}:\n${errorString}`
      );
    }
  }
};

const isValidNewHandlerObject = ({levels, name, fn}) => {
  const validationErrors = [];
  const printName = name ? ` "${name}"` : '';

  // validate levels if any
  if (levels) {
    if (!Array.isArray(levels) || !levels.length) {
      validationErrors.push('levels must be a non empty array');
    } else {
      levels.forEach(levelName => {
        if (levelToCode[levelName] == null) {
          validationErrors.push(
            `can't add handler for unknown level "${levelName}"`
          );
        }
      });
    }
  }

  if (!name) {
    validationErrors.push("must specify handler's name");
  } else if (handlers.get(name)) {
    validationErrors.push(`handler${printName} is already registered`);
  }

  if (!fn) {
    validationErrors.push(`must specify${printName} handler function`);
  } else if (typeof fn !== 'function') {
    validationErrors.push(`handler${printName} must be a function`);
  }

  return validationErrors.length
    ? (printErrors('addHandler', validationErrors), false)
    : true;
};

const makeHandler = (levelName: LevelName) => (
  message: string,
  metadata?: Metadata
) => {
  const levelCode = levelToCode[levelName];
  // augument metadata with levelName, levelCode and message
  const metadataPlus = {
    ...(metadata || {}),
    message,
    levelName,
    levelCode
  };

  // pass metadata to every middleware
  const processedMetadata = Object.keys(middlewares).reduce(
    (meta, name) => middlewares[name](meta),
    metadataPlus
  );

  // check if the middleware returned anything
  const finalMetadata = processedMetadata
    ? {
        message,
        levelName,
        levelCode,
        ...processedMetadata
      }
    : {
        message,
        levelName,
        levelCode
      };

  // finalMeta is the finalMetadata without the message
  const {message: finalMessage, ...finalMeta} = finalMetadata;
  // we should not care about the length of the string as long as it was passed
  const messageExists = typeof finalMessage === 'string';

  if (messageExists && finalMeta.levelCode >= globalCode) {
    levelsToHandlers[finalMeta.levelName].forEach(handlerName => {
      const handler = handlers.get(handlerName);
      if (handler) {
        handler.fn(finalMessage, finalMeta);
      }
    });
  }
};

const codeToLevel = (code: number): LevelName | void =>
  Object.keys(levelToCode).find(
    (level: LevelName) => levelToCode[level] === code
  );

const logger: Logger = {
  addHandler({levels, name, fn}: AddHandlerObject) {
    if (isValidNewHandlerObject({levels, name, fn})) {
      const addToLevels = levels || Object.keys(levelToCode);
      const addedForLevels = new Set();

      addToLevels.forEach(levelName => {
        const handlersForLevel = levelsToHandlers[levelName];
        if (handlersForLevel) {
          addedForLevels.add(levelName);
          handlersForLevel.add(name);
        }
      });

      if (addedForLevels.size) {
        handlers.set(name, {fn, addedForLevels});
      }
    }
  },
  addMiddleware(middleware: Middleware) {
    const {name, fn} = middleware;
    middlewares[name] = fn;
  },
  removeMiddleware(name: string) {
    const {[name]: omit, ...updatedMiddlewares} = middlewares;
    middlewares = updatedMiddlewares;
  },
  removeAllMiddlewares() {
    middlewares = {};
  },
  removeHandler(removeHandlerObjectOrName: RemoveHandlerObject | string) {
    let name;
    let levels;

    if (typeof removeHandlerObjectOrName === 'string') {
      name = removeHandlerObjectOrName;
    } else {
      name = removeHandlerObjectOrName.name;
      levels = removeHandlerObjectOrName.levels;
    }

    const handler = handlers.get(name);
    if (handler) {
      const {addedForLevels} = handler;
      // if no levels were passed, addedForLevels will clear itself
      (levels || addedForLevels).forEach(level => {
        const handlersForLevel = levelsToHandlers[level];
        if (handlersForLevel && handlersForLevel.has(name)) {
          handlersForLevel.delete(name);
          addedForLevels.delete(level);
        }
      });

      if (addedForLevels.size === 0) {
        handlers.delete(name);
      }
    }
  },
  getHandlers(
    levelNameOrCode?: LevelNameOrCode
  ): Array<{name: string, fn: HandlerFunction}> {
    const levelHandlers = [];
    let handlerNames;

    // using typeof to help Flow figure out types
    if (typeof levelNameOrCode === 'string') {
      const code = levelToCode[levelNameOrCode];
      if (code > -1) {
        handlerNames = [...levelsToHandlers[levelNameOrCode]];
      }
    } else if (typeof levelNameOrCode === 'string') {
      handlerNames = levelsToHandlers[levelNameOrCode];
    } else {
      handlerNames = [...handlers.keys()];
    }

    if (handlerNames) {
      handlerNames.forEach(name => {
        const handler = handlers.get(name);
        if (handler) {
          levelHandlers.push({
            name,
            fn: handler.fn
          });
        }
      });
    }

    return levelHandlers;
  },
  getLevels(handlerName?: string): Array<{code: LevelCode, level: LevelName}> {
    let levels;
    if (handlerName) {
      const handler = handlers.get(handlerName);
      if (handler) {
        levels = [...handler.addedForLevels];
      }
    } else {
      levels = Object.keys(levelToCode);
    }

    return levels
      ? levels.map(levelName => ({
          level: levelName,
          code: levelToCode[levelName]
        }))
      : [];
  },
  setGlobalLevel(levelNameOrCode: LevelNameOrCode) {
    // using typeof to help Flow figure out types
    if (typeof levelNameOrCode === 'string') {
      const code = levelToCode[levelNameOrCode];
      if (code > -1) {
        globalCode = code;
      }
    } else if (typeof levelNameOrCode === 'number') {
      const levelName = codeToLevel(levelNameOrCode);
      if (levelName) {
        globalCode = levelNameOrCode;
      }
    } else {
      printErrors('setLevel', 'unknown logger level');
    }
  },
  getGlobalLevel() {
    return {
      code: globalCode,
      level: codeToLevel(globalCode)
    };
  },
  removeAllHandlers(levels?: LevelNameArray | LevelName) {
    if (!levels) {
      // Can't use values, value is of type mixed in Flow
      Object.keys(levelsToHandlers).forEach(levelName =>
        levelsToHandlers[levelName].clear()
      );
      handlers.clear();
    } else {
      const levelsToClear = Array.isArray(levels) ? levels : [levels];
      levelsToClear.forEach(level => {
        const handlersForLevel = levelsToHandlers[level];
        if (handlersForLevel) {
          handlersForLevel.forEach(handlerName => {
            const handler = handlers.get(handlerName);
            if (handler) {
              const {addedForLevels} = handler;
              addedForLevels.delete(level);
              if (addedForLevels.size === 0) {
                handlers.delete(handlerName);
              }
            }
          });

          handlersForLevel.clear();
        }
      });
    }
  },
  // make handlers for levels
  debug: makeHandler('debug'),
  info: makeHandler('info'),
  warn: makeHandler('warn'),
  error: makeHandler('error')
};

// add "console" handler for all log levels by default
logger.addHandler({
  name: 'console',
  fn: consoleHandler
});

export default logger;
export type {
  LevelName,
  LevelCode,
  HandlerFunction,
  AddHandlerObject,
  RemoveHandlerObject
};
