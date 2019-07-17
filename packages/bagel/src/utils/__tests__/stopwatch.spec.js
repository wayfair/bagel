import createStopWatch from '../stopwatch';

// $FlowExpectedError;
import {performance} from 'perf_hooks';

describe('stopwatch spec', () => {
  const descriptor = {id: '1', name: 'TEST_TIMER_KEY'};
  const descriptor2 = {id: '2', name: 'TEST_TIMER_KEY2'};
  let stopwatch;

  beforeEach(() => {
    stopwatch = createStopWatch();
  });

  it('should create successfully with no times recorded', () => {
    expect(stopwatch.getTimes()).toEqual([]);
  });

  it('should successfully add start and stop times', () => {
    stopwatch.start(descriptor);
    stopwatch.stop(descriptor);
    expect(stopwatch.getTimes().length).toBe(2);
  });

  it('should not log a duplicate start time for the same key', () => {
    stopwatch.start(descriptor);
    stopwatch.start(descriptor);
    expect(stopwatch.getTimes().length).toBe(1);
  });

  it('supports multiple timing events of different names', () => {
    stopwatch.start(descriptor);
    stopwatch.stop(descriptor);
    stopwatch.start(descriptor2);
    stopwatch.stop(descriptor2);
    const times = stopwatch.getTimes();
    expect(times.length).toBe(4);
    expect(times.filter(ob => ob.name === descriptor.name).length).toBe(2);
    expect(times.filter(ob => ob.name === descriptor2.name).length).toBe(2);
  });

  it('supports one "start" event', () => {
    stopwatch.start(descriptor);
    const times = stopwatch.getTimes();
    expect(times.length).toBe(1);
    expect(times.filter(ob => ob.name === descriptor.name).length).toBe(1);
  });

  describe('pausing (start && stop)', () => {
    const DATE_STEP = 10;
    let time = 0;

    beforeEach(() => {
      time = 0;
      // mock Date.now to easily check the stopwatch math
      performance.now = jest.fn(() => {
        time += DATE_STEP;
        return time;
      });

      // This means the first "start" always starts at zero
      Date.now = jest.fn(() => 0);
    });

    afterAll(() => {
      jest.clearAllMocks();
    });

    it('should support pausing, starting and stopping', () => {
      // started at 0 ms
      stopwatch.start(descriptor);
      // stopped at 10 ms, running time is 10 ms
      stopwatch.stop(descriptor);
      // started at 20 ms
      stopwatch.start(descriptor);
      // stopped at 30 ms, running time is 20 ms
      stopwatch.stop(descriptor);
      /**
       * -> start: 10
       * -> stop: 20 (started time + running time [0 + 20])
       */

      // starts at 0 ms
      stopwatch.start(descriptor2);
      // stopped at 10 ms, running time is 10 ms
      stopwatch.stop(descriptor2);
      // started at 20 ms
      stopwatch.start(descriptor2);
      // stopped at 30 ms, running time is 20 ms
      stopwatch.stop(descriptor2);
      /**
       * -> start: 0
       * -> stop: 20 (started time + running time [0 + 20])
       */

      // calling getTimes multiple times should return same objects
      let times = stopwatch.getTimes();
      times = stopwatch.getTimes();
      times = stopwatch.getTimes();

      expect(times.length).toBe(4);
      const testKeyValues = times.filter(ob => ob.name === descriptor.name);
      const testKey2Values = times.filter(ob => ob.name === descriptor2.name);

      expect(testKeyValues.length).toBe(2);
      expect(testKey2Values.length).toBe(2);

      // check times of "start" and "stop" events
      expect(testKeyValues[0].time).toBe(0);
      expect(testKeyValues[1].time).toBe(20);

      // check times of "start" and "stop" events
      expect(testKey2Values[0].time).toBe(0);
      expect(testKey2Values[1].time).toBe(20);
    });

    it('should not count the last event if it\'s a "start', () => {
      // started at 0 ms
      stopwatch.start(descriptor);
      // stopped at 10 ms, running time is 10 ms
      stopwatch.stop(descriptor);

      // started at 20 ms
      stopwatch.start(descriptor);
      // stopped at 30 ms, running time is 20 ms
      stopwatch.stop(descriptor);

      // started at 40 ms but will be ignored
      stopwatch.start(descriptor);

      const times = stopwatch.getTimes();

      expect(times.length).toBe(2);
      const testKeyValues = times.filter(ob => ob.name === descriptor.name);

      expect(testKeyValues.length).toBe(2);

      // check times of "start" and "stop" events
      expect(testKeyValues[0].time).toBe(0);
      expect(testKeyValues[1].time).toBe(20);
    });

    it('should not add "stop" event if stopwatch is already stopped', () => {
      // started at 0 ms
      stopwatch.start(descriptor);
      // stopped at 10 ms, running time is 10 ms
      stopwatch.stop(descriptor);
      // this will result in a warning
      stopwatch.stop(descriptor);

      const times = stopwatch.getTimes();
      expect(times.length).toBe(2);

      const fistEvent = times[0];
      expect(fistEvent.type).toBe('start');

      const lastEvent = times[1];
      expect(lastEvent.type).toBe('stop');
    });

    it('should not add "stop" event if stopwatch wasn\'t started', () => {
      // this will result in a warning
      stopwatch.stop(descriptor);

      const times = stopwatch.getTimes();
      expect(times.length).toBe(0);
    });

    it('should not add "start" event if stopwatch is already started', () => {
      // started at 0 ms
      stopwatch.start(descriptor);
      // this will result in a warning
      stopwatch.start(descriptor);

      const times = stopwatch.getTimes();
      expect(times.length).toBe(1);

      const fistEvent = times[0];
      expect(fistEvent.type).toBe('start');
    });

    it('supports adhoc additions', () => {
      stopwatch.adhoc({
        ...descriptor,
        startEpochTime: Date.now(),
        stopEpochTime: Date.now() + 50
      });

      const testKeyValues = stopwatch.getTimes();
      expect(testKeyValues.length).toBe(2);
      expect(testKeyValues[0].time).toBe(0);
      expect(testKeyValues[1].time).toBe(50);
    });

    it('supports async event tags', () => {
      stopwatch.start({...descriptor, async: true});
      stopwatch.stop({...descriptor, async: true});
      stopwatch.start({...descriptor2, async: false});
      stopwatch.stop({...descriptor2, async: false});

      const testKeyValues = stopwatch.getTimes();
      expect(testKeyValues[0].async).toBe(true);
      expect(testKeyValues[1].async).toBe(true);
      expect(testKeyValues[2].async).not.toBe(true);
      expect(testKeyValues[3].async).not.toBe(true);
    });
  });

  describe('helpers to create event names', () => {
    it('getBatchEventName', () => {
      expect(stopwatch.getBatchEventName).toBeDefined();
      expect(stopwatch.getBatchEventName()).toMatchSnapshot();
    });

    it('getJobEventName', () => {
      expect(stopwatch.getJobEventName).toBeDefined();
      expect(stopwatch.getJobEventName('a')).toMatchSnapshot();
    });

    it('getLoadEventName', () => {
      expect(stopwatch.getLoadEventName).toBeDefined();
      expect(stopwatch.getLoadEventName('a')).toMatchSnapshot();
    });

    it('getLazyLoadEventName', () => {
      expect(stopwatch.getLazyLoadEventName).toBeDefined();
      expect(stopwatch.getLazyLoadEventName('a')).toMatchSnapshot();
    });

    it('getRenderEventName', () => {
      expect(stopwatch.getRenderEventName).toBeDefined();
      expect(stopwatch.getRenderEventName('a')).toMatchSnapshot();
    });

    it('getInitialPropsEventName', () => {
      expect(stopwatch.getInitialPropsEventName).toBeDefined();
      expect(stopwatch.getInitialPropsEventName('a')).toMatchSnapshot();
    });
  });
});
