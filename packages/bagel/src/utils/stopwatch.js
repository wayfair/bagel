// @flow

// $FlowExpectedError;
import {performance} from 'perf_hooks';

export type StopwatchEvent = {
  name: string,
  time: number,
  type: string,
  async?: boolean,
  module?: string,
  // only for first start event
  epochTime?: number
};

export type Stopwatch = {
  getTimes: () => Array<StopwatchEvent>,
  start: ({
    name: string,
    module?: string,
    id?: string,
    async?: boolean,
    debug?: boolean
  }) => void,
  stop: ({
    name: string,
    module?: string,
    id?: string,
    async?: boolean
  }) => void,
  // helpers to get uniq keys
  getBatchEventName: () => string,
  getJobEventName: (name: string) => string,
  getLoadEventName: (name: string) => string,
  getLazyLoadEventName: (name: string) => string,
  getRenderEventName: (name: string) => string,
  getInitialPropsEventName: (name: string) => string
};

const makeKey = ({id, name}: {id: string, name: string}) =>
  id ? `${id}/${name}` : name;
const getBatchEventName = () => `batch`;
const getJobEventName = (name: string) => `processing job for "${name}"`;
const getLoadEventName = (name: string) => `loading modules for "${name}"`;
const getLazyLoadEventName = (name: string) =>
  `lazy loading modules for "${name}"`;
const getRenderEventName = (name: string) => `rendering "${name}"`;
const getInitialPropsEventName = (name: string) =>
  `getting initial props for "${name}"`;

/**
 * In the future we should switch to process.hrtime.bigint.
 * It has cleaner API and return value is in nanoseconds.
 * https://nodejs.org/api/process.html#process_process_hrtime_bigint
 */

const createStopWatch = (): Stopwatch => {
  /**
   * Result of the last call to getTimes, get invalidated by "start" and "stop"
   * calls.
   */
  let cachedTimes = [];

  const eventsMap = new Map();
  // Map object iterates it's elements in insertion order.
  const calculateTimes = (
    map: Map<string, Array<StopwatchEvent>>
  ): Array<StopwatchEvent> => {
    const times = [];
    /**
     * Since PHP is only expecting "start" and "stop" events for one name (label),
     * we'll need to sum "start" and "stop" events (if we have many).
     */

    for (const values of map.values()) {
      let length = values.length;
      const {epochTime: firstEventEpochTimeStart, ...firstEvent} = values[0];

      /**
       * If we reached the body of the for-of loop - we have at least one key,
       * and we'll need firstEventAdjusted for every case.
       */
      const firstEventAdjusted = {
        ...firstEvent,
        time: firstEventEpochTimeStart
      };

      if (length === 1) {
        // just one "start" event
        times.push(firstEventAdjusted);
      } else {
        /**
         * If we have multiple events that end with a "start" event -
         * we never stopped the stopwatch.
         * The last "start" event should be ignored.
         */
        const lastEvent = values[length - 1];
        if (lastEvent.type === 'start') {
          // remove the last "start" event and adjust the length
          values.splice(-1, 1);
          length -= 1;
        }

        // if we only have "start" and "stop" events pair
        if (length === 2) {
          /**
           * Adjust the times of the last event accounting for delta.
           * Since PHP client doesn't expect decimal numbers - use floor.
           */
          const lastEventAdjusted = {
            ...lastEvent,
            time: Math.floor(
              firstEventEpochTimeStart + (lastEvent.time - firstEvent.time)
            )
          };

          times.push(firstEventAdjusted, lastEventAdjusted);
        } else {
          /**
           * Need to calculate time between "start" and "stop" events.
           * Delta is the time difference (ms) between first and last event.
           */
          let delta = 0;

          /**
           * We're working with "start" and "stop" event pairs.
           * length % 2 is always 0.
           */
          for (let i = 0; i < length; i += 2) {
            delta += values[i + 1].time - values[i].time;
          }

          /**
           * Adjust the times of the last event accounting for delta.
           * Since PHP client doesn't expect decimal numbers - use floor.
           */
          const lastEventAdjusted = {
            ...lastEvent,
            time: Math.floor(firstEventEpochTimeStart + delta)
          };

          times.push(firstEventAdjusted, lastEventAdjusted);
        }
      }
    }

    return times;
  };

  const getTimes = () => {
    if (cachedTimes.length) {
      return cachedTimes;
    }

    // save off the result
    cachedTimes = calculateTimes(eventsMap);
    return cachedTimes;
  };

  const stop = ({id = '', name, module, async = false}) => {
    const values = eventsMap.get(makeKey({id, name}));

    /**
     * Stop can be called if we have:
     *
     * 1. at least one event recorded event for this name (label);
     * AND
     * 2. the last recorded event is of type "start".
     */

    if (values) {
      const lastEventType = values[values.length - 1].type;
      if (lastEventType === 'start') {
        values.push({
          name,
          type: 'stop',
          time: performance.now(),
          module,
          async
        });
        // reset the getTimes result
        cachedTimes = [];
      } else if (lastEventType === 'stop') {
        console.warn(
          `Can't stop stopwatch "${name}" because it's already stopped.`
        );
      }
    } else {
      console.warn(
        `Can't stop stopwatch "${name}" because it's wasn't started.`
      );
    }
  };

  const start = ({id = '', name, module, async = false, debug = false}) => {
    const key = makeKey({id, name});
    const values = eventsMap.get(key);

    /**
     * Start can be called if we have:
     *
     * 1. no recorded events for this name (label);
     * OR
     * 2. the last recorded event is of type "stop".
     */

    if (values) {
      const lastEventType = values[values.length - 1].type;
      if (lastEventType === 'stop') {
        values.push({
          name,
          type: 'start',
          time: performance.now(),
          module,
          async
        });
        // reset the getTimes result
        cachedTimes = [];
      } else if (lastEventType === 'start') {
        console.warn(
          `Can't start stopwatch "${name}" because it's already started.`
        );
      }
    } else {
      /**
       * If there are no events recorded for given name (label) - add an array
       * first "start" event.
       */
      eventsMap.set(key, [
        {
          name,
          type: 'start',
          time: performance.now(),
          module,
          async,
          debug,

          /**
           * We need to have epoch time on first start to understand how long
           * stopwatch was running relative to ms from 1970.
           */
          epochTime: Date.now()
        }
      ]);
    }
  };

  /**
   * Add adhoc times to our perf data
   * Useful when start generated somewhere else (aka - php); and stop generated here
   * Specifically, helpful for adding timers around ws overhead
   */
  const adhoc = ({
    id = '',
    name,
    module,
    startEpochTime,
    stopEpochTime,
    async = false
  }) => {
    const key = makeKey({id, name});

    // @NOTE - other timers use performance.now() for the time
    // While this is nice, Date.now() also works fine, and is necessary if recording events from other places (like php)
    eventsMap.set(key, [
      {
        name,
        type: 'start',
        time: startEpochTime,
        module,
        async,
        epochTime: startEpochTime
      },
      {
        name,
        type: 'stop',
        time: stopEpochTime,
        module,
        async
      }
    ]);

    // reset the getTimes result
    cachedTimes = [];
  };

  return {
    getTimes,
    start,
    stop,
    adhoc,
    // helper functions to get unique keys
    getBatchEventName,
    getJobEventName,
    getLoadEventName,
    getLazyLoadEventName,
    getRenderEventName,
    getInitialPropsEventName
  };
};

export default createStopWatch;
