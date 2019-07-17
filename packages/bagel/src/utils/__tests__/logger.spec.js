import logger from '../logger';
import consoleHandler from '../console_logger_handler';

// mute console for this file
console.log = jest.fn();

const noop = () => {};

const ALL_LEVELS = [
  {level: 'debug', code: 0},
  {level: 'info', code: 1},
  {level: 'warn', code: 2},
  {level: 'error', code: 3}
];

describe('logger spec', () => {
  const spyHandler = jest.fn();
  const spyMiddleware = jest.fn();

  afterEach(() => {
    // reset the spies
    spyHandler.mockReset();
    spyMiddleware.mockReset();

    // remove all of the handlers and middlewares
    logger.removeAllHandlers();
    logger.removeAllMiddlewares();
    logger.setGlobalLevel(1);

    // add "console" handler by default
    logger.addHandler({
      levels: ['info', 'debug', 'warn', 'error'],
      name: 'console',
      fn: consoleHandler
    });
  });

  describe('compatibility with logger v1', () => {
    it('should have methods for "debug", "info", "warn", "error" log levels', () => {
      expect(logger.debug).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
    });

    it('should have default "console" handler defined for all log levels', () => {
      const handlerLevels = logger.getLevels('console');
      // check "console" is defined for all log levels
      expect(handlerLevels).toEqual(expect.arrayContaining(ALL_LEVELS));

      // check we have all four log levels
      expect(handlerLevels).toHaveLength(4);
    });
  });

  describe('handler behavior', () => {
    it('should not call handlers when log level is less than global level', () => {
      // set logger to trigger handlers when the level is greater than "error"
      logger.setGlobalLevel('error');

      // create a few test messages
      const errorMessage = 'error test';
      const warnMessage = 'warn test';

      // add a "spyHandler" to "warn" and "error" levels
      logger.addHandler({
        levels: ['warn', 'error'],
        name: 'spyHandler',
        fn: spyHandler
      });

      // verify that "spyHandler" wasn't called for "warn" log level
      logger.warn(warnMessage);
      expect(spyHandler).not.toHaveBeenCalled();

      // verify that "spyHandler" was called for "error" log level
      logger.error(errorMessage);
      expect(spyHandler).toHaveBeenCalledTimes(1);
      expect(spyHandler).toHaveBeenCalledWith(errorMessage, {
        levelName: 'error',
        levelCode: 3
      });

      // set the global log level to it's lowest
      logger.setGlobalLevel(0);

      // verify that now "spyHandler" was called for "warn" log level
      logger.warn(warnMessage);
      expect(spyHandler).toHaveBeenCalledTimes(2);
      expect(spyHandler).toHaveBeenCalledWith(warnMessage, {
        levelName: 'warn',
        levelCode: 2
      });
    });

    it('should not call handlers when message does not exist', () => {
      // set logger to trigger handlers when the level is greater than "error"
      logger.setGlobalLevel('error');

      // add a "spyHandler" to "error" level
      logger.addHandler({
        levels: ['error'],
        name: 'spyHandler',
        fn: spyHandler
      });

      /**
       * Verify that "spyHandler" was not called for "error" log level with
       * undefined message.
       */
      logger.error(void 0);
      expect(spyHandler).not.toHaveBeenCalled();
    });

    it('should call log handlers in the order they were added', () => {
      // define an array, all of the spies with push their names to
      const callOrder = [];

      const first = jest.fn(() => callOrder.push('first'));
      const second = jest.fn(() => callOrder.push('second'));
      const third = jest.fn(() => callOrder.push('third'));
      const fourth = jest.fn(() => callOrder.push('fourth'));

      // add "first" handler to "info" level
      logger.addHandler({
        levels: ['info'],
        name: 'first',
        fn: first
      });

      // add "second" handler to "info" level
      logger.addHandler({
        levels: ['info'],
        name: 'second',
        fn: second
      });

      // add "third" handler to "info" level
      logger.addHandler({
        levels: ['info'],
        name: 'third',
        fn: third
      });

      // add "fourth" handler to "info" level
      logger.addHandler({
        levels: ['info'],
        name: 'fourth',
        fn: fourth
      });

      // call the logger and verify the handlers execution order
      logger.info('test info');
      expect(callOrder).toEqual(['first', 'second', 'third', 'fourth']);
    });

    it('should pass an object with "message" and "level" keys to the log handler', () => {
      // add a "spyHandler" to "info" level
      logger.addHandler({
        levels: ['info'],
        name: 'spyHandler',
        fn: spyHandler
      });

      const message = 'info test';
      logger.info(message);

      // verify that "spyHandler" was called
      expect(spyHandler).toHaveBeenCalledWith(message, {
        levelName: 'info',
        levelCode: 1
      });
    });
  });

  describe('addHandler', () => {
    it('should have "addHandler" method', () => {
      expect(logger.addHandler).toBeDefined();
    });

    it('should add multiple log handlers', () => {
      // add a "spyHandler" to "info" level
      logger.addHandler({
        levels: ['info'],
        name: 'spyHandler',
        fn: spyHandler
      });

      // verify that "spyHandler" was added to the "info" level
      expect(logger.getLevels('spyHandler')).toEqual([
        {level: 'info', code: 1}
      ]);

      const levelHandlers = logger.getHandlers('info');
      // verify that "info" level has two handlers, "console" (default) and "spyHandler"
      expect(levelHandlers).toHaveLength(2);
      expect(levelHandlers).toEqual(
        expect.arrayContaining([
          {name: 'console', fn: consoleHandler},
          {name: 'spyHandler', fn: spyHandler}
        ])
      );

      const message = 'info test';
      logger.info(message);

      // verify that "spyHandler" was called
      expect(spyHandler).toHaveBeenCalledTimes(1);
    });

    it('should add handler to all log levels if levels were not specified', () => {
      // add a "noop" to "all" levels
      logger.addHandler({
        name: 'noop',
        fn: noop
      });

      // verify that "noop" was added to the "all" levels
      expect(logger.getLevels('noop')).toEqual(
        expect.arrayContaining(ALL_LEVELS)
      );
    });

    it('should not add handler if unknown level is in the levels array', () => {
      // try add a "noop" to "info", "error" and "hmm" levels
      logger.addHandler({
        levels: ['info', 'error', 'hmm'],
        name: 'noop',
        fn: noop
      });

      // verify that "noop" handler was not added
      expect(logger.getLevels('noop')).toEqual([]);
    });

    it('should not add handler if handler name was not passed', () => {
      // try to add a "noop" to "info" level
      logger.addHandler({
        levels: ['info'],
        fn: noop
      });

      const infoHandlers = logger.getHandlers('info');
      // verify that "noop" handler was not added
      expect(infoHandlers).toEqual(
        expect.arrayContaining([
          {
            name: 'console',
            fn: consoleHandler
          }
        ])
      );
    });

    it('should not add handler if handler with passed name is already added', () => {
      // try to add a "noop" to "info" and "error" levels
      logger.addHandler({
        levels: ['info', 'error'],
        name: 'console',
        fn: noop
      });

      const handlers = logger.getHandlers('info');
      const needle = handlers.find(({name}) => name === 'console');

      // verify that "noop" handler was not added and thus was not overridden by noop
      console.log(needle);
      expect(needle.fn === consoleHandler).toBeTruthy();
    });

    it('should not add handler if handler "fn" was not passed', () => {
      // try to add a "noop" to "info" and "error" levels
      logger.addHandler({
        levels: ['info', 'error'],
        name: 'noop'
      });

      const levels = logger.getLevels('noop');
      // verify that "noop" handler was not added
      expect(levels).toEqual([]);
    });

    it('should not add handler if handler "fn" is not a function', () => {
      // try to add a "noop" to "info" and "error" levels
      logger.addHandler({
        levels: ['info', 'error'],
        name: 'noop',
        fn: 1
      });

      const levels = logger.getLevels('noop');
      // verify that "noop" handler was not added
      expect(levels).toEqual([]);
    });
  });

  describe('removeHandler', () => {
    it('should remove log handlers for explicitly specified levels', () => {
      // add a "spyHandler" to "warn" and "error" levels
      logger.addHandler({
        levels: ['warn', 'error'],
        name: 'spyHandler',
        fn: spyHandler
      });

      const errorMessage = 'error test';

      // verify "spyHandler" only used for "warn" and "error" log levels
      expect(logger.getLevels('spyHandler')).toEqual(
        expect.arrayContaining([
          {
            level: 'warn',
            code: 2
          },
          {
            level: 'error',
            code: 3
          }
        ])
      );

      // remove "spyHandler" for "warn" log level
      logger.removeHandler({levels: ['warn'], name: 'spyHandler'});

      // verify that not "spyHandler" is only used for "error" log level
      expect(logger.getLevels('spyHandler')).toEqual(
        expect.arrayContaining([
          {
            level: 'error',
            code: 3
          }
        ])
      );
      // verify that "spyHandler" is not called on "warn" log level
      logger.warn('warn test');
      expect(spyHandler).not.toHaveBeenCalled();

      // verify that not "spyHandler" still works for "error" log level
      logger.error('error test');
      expect(spyHandler).toHaveBeenCalledTimes(1);
      expect(spyHandler).toHaveBeenLastCalledWith(errorMessage, {
        levelName: 'error',
        levelCode: 3
      });

      // remove "spyHandler" for "error" log level
      logger.removeHandler({levels: ['error'], name: 'spyHandler'});

      // verify "spyHandler" is not in the list of registered handlers
      expect(logger.getHandlers()).not.toEqual(
        expect.arrayContaining([
          {
            name: 'spyHandler',
            fn: spyHandler
          }
        ])
      );
    });

    it('should remove all handlers for all log levels if levels were not specified', () => {
      const one = () => 1;
      // add a "noop" to "info" and "debug" levels
      logger.addHandler({
        levels: ['info', 'debug'],
        name: 'noop',
        fn: noop
      });

      // add a "one" to "warn" and "error" levels
      logger.addHandler({
        levels: ['warn', 'error'],
        name: 'one',
        fn: one
      });

      // verify that "noop" is used for "info" and "debug" log levels
      expect(logger.getLevels('noop')).toEqual(
        expect.arrayContaining([
          {
            level: 'info',
            code: 1
          },
          {
            level: 'debug',
            code: 0
          }
        ])
      );

      // verify that "one" is used for "warn" and "error" log levels
      expect(logger.getLevels('one')).toEqual(
        expect.arrayContaining([
          {
            level: 'warn',
            code: 2
          },
          {
            level: 'error',
            code: 3
          }
        ])
      );

      // verify that "info" level has two handlers, "console" (default) and "noop"
      expect(logger.getHandlers('info')).toEqual(
        expect.arrayContaining([
          {name: 'console', fn: consoleHandler},
          {name: 'noop', fn: noop}
        ])
      );

      // verify that "debug" level has two handlers, "console" (default) and "noop"
      expect(logger.getHandlers('debug')).toEqual(
        expect.arrayContaining([
          {name: 'console', fn: consoleHandler},
          {name: 'noop', fn: noop}
        ])
      );

      // verify that "warn" level has two handlers, "console" (default) and "one"
      expect(logger.getHandlers('warn')).toEqual(
        expect.arrayContaining([
          {name: 'console', fn: consoleHandler},
          {name: 'one', fn: one}
        ])
      );

      // verify that "error" level has two handlers, "console" (default) and "one"
      expect(logger.getHandlers('error')).toEqual(
        expect.arrayContaining([
          {name: 'console', fn: consoleHandler},
          {name: 'one', fn: one}
        ])
      );

      // verify there are three handlers in total, "console", "noop" and "one"
      expect(logger.getHandlers()).toEqual(
        expect.arrayContaining([
          {name: 'console', fn: consoleHandler},
          {name: 'noop', fn: noop},
          {name: 'one', fn: one}
        ])
      );

      // delete all of the handlers
      logger.removeAllHandlers();
      // verify there are no handlers
      expect(logger.getHandlers()).toEqual([]);
      expect(logger.getHandlers('info')).toEqual([]);
      expect(logger.getHandlers('debug')).toEqual([]);
      expect(logger.getHandlers('warn')).toEqual([]);
      expect(logger.getHandlers('error')).toEqual([]);
    });
  });

  describe('setGlobalLevel', () => {
    it('should have "setGlobalLevel" method', () => {
      expect(logger.setGlobalLevel).toBeDefined();
    });

    it('should set global level with a level name', () => {
      logger.setGlobalLevel('error');
      expect(logger.getGlobalLevel()).toEqual(
        expect.objectContaining({
          level: 'error',
          code: 3
        })
      );
    });

    it('should set global level with a level code', () => {
      logger.setGlobalLevel(0);
      expect(logger.getGlobalLevel()).toEqual(
        expect.objectContaining({
          level: 'debug',
          code: 0
        })
      );
    });
  });

  describe('getGlobalLevel', () => {
    it('should have "getGlobalLevel" method', () => {
      expect(logger.getGlobalLevel).toBeDefined();
    });

    it('should return global level', () => {
      expect(logger.getGlobalLevel()).toEqual(
        expect.objectContaining({
          level: 'info',
          code: 1
        })
      );
    });
  });

  describe('getLevels', () => {
    it('should have "getLevels" method', () => {
      expect(logger.getLevels).toBeDefined();
    });

    it('should get all log levels for specified handler name', () => {
      logger.addHandler({
        levels: ['info'],
        name: 'spyHandler',
        fn: spyHandler
      });

      expect(logger.getLevels('console')).toEqual(
        expect.arrayContaining(ALL_LEVELS)
      );

      expect(logger.getLevels('spyHandler')).toEqual(
        expect.arrayContaining([
          {
            level: 'info',
            code: 1
          }
        ])
      );
    });

    it('should return an empty array for unknown handler name', () => {
      expect(logger.getLevels('HandlerX')).toEqual([]);
    });

    it('should get all log levels if the handler name was not specified', () => {
      expect(logger.getLevels()).toEqual(expect.arrayContaining(ALL_LEVELS));
    });
  });

  describe('getHandlers', () => {
    it('should have "getHandlers" method', () => {
      expect(logger.getHandlers).toBeDefined();
    });

    it('should get all handlers for specified level name', () => {
      logger.addHandler({
        levels: ['info'],
        name: 'spyHandler',
        fn: spyHandler
      });

      expect(logger.getHandlers('info')).toEqual(
        expect.arrayContaining([
          {
            name: 'console',
            fn: consoleHandler
          },
          {
            name: 'spyHandler',
            fn: spyHandler
          }
        ])
      );
    });

    it('should get all handlers for specified level code', () => {
      logger.addHandler({
        levels: ['info'],
        name: 'spyHandler',
        fn: spyHandler
      });

      expect(logger.getHandlers(1)).toEqual(
        expect.arrayContaining([
          {
            name: 'console',
            fn: consoleHandler
          },
          {
            name: 'spyHandler',
            fn: spyHandler
          }
        ])
      );
    });

    it('should get all handlers if the level name was not specified', () => {
      logger.addHandler({
        levels: ['info'],
        name: 'spyHandler',
        fn: spyHandler
      });

      expect(logger.getHandlers()).toEqual(
        expect.arrayContaining([
          {
            name: 'console',
            fn: consoleHandler
          },
          {
            name: 'spyHandler',
            fn: spyHandler
          }
        ])
      );
    });

    it('should return an empty array for unknown level name', () => {
      expect(logger.getLevels('levelX')).toEqual([]);
    });

    it('should return an empty array for unknown level code', () => {
      expect(logger.getLevels(100)).toEqual([]);
    });
  });

  describe('addMiddleware', () => {
    it('should have "getHandlers" method', () => {
      expect(logger.addMiddleware).toBeDefined();
    });

    it('should add middleware to the logger', () => {
      logger.addMiddleware({name: 'spyMiddleware', fn: spyMiddleware});
      logger.addHandler({
        levels: ['info'],
        name: 'spyHandler',
        fn: spyHandler
      });

      const message = 'info test';
      logger.info(message);

      // verify that "spyMiddleware" was called
      expect(spyMiddleware).toHaveBeenCalledWith({
        message,
        levelName: 'info',
        levelCode: 1
      });
      // verify that "spyHandler" was called
      expect(spyHandler).toHaveBeenCalledWith(message, {
        levelName: 'info',
        levelCode: 1
      });
    });
  });

  describe('removeMiddleware', () => {
    it('should be able to remove middleware by name', () => {
      logger.addMiddleware({
        name: 'fooBar',
        fn: meta => ({...meta, foo: 'bar'})
      });

      logger.addHandler({
        levels: ['info'],
        name: 'spyHandler',
        fn: spyHandler
      });

      const message = 'info test';
      logger.info(message);

      // verify that "spyHandler" was called with metadata object that has "foo"
      expect(spyHandler).toHaveBeenCalledWith(message, {
        levelName: 'info',
        levelCode: 1,
        foo: 'bar'
      });

      // now remove middleware
      logger.removeMiddleware('fooBar');
      logger.info(message);

      expect(spyHandler).toHaveBeenCalledWith(message, {
        levelName: 'info',
        levelCode: 1
      });
    });
  });
});
