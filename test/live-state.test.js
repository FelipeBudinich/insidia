import assert from 'node:assert/strict';
import test from 'node:test';
import * as rules from '../public/core/rules.js';
import { startLiveState } from '../public/live-state.js';

function withFakeClock(run, { now = 0, visibilityState = 'visible' } = {}) {
  const originalNow = Date.now;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const timers = new Map();
  const listeners = new Map();
  let nextTimerId = 1;
  const clock = {
    now,
    timers,
    listeners,
    document: {
      visibilityState,
      addEventListener(type, callback) { listeners.set(type, callback); },
      removeEventListener(type, callback) {
        if (listeners.get(type) === callback) listeners.delete(type);
      }
    },
    runTimer(timerId = [...timers.keys()][0]) {
      const timer = timers.get(timerId);
      if (!timer) throw new Error(`Unknown timer: ${timerId}`);
      timers.delete(timerId);
      timer.callback();
    },
    changeVisibility(nextState) {
      this.document.visibilityState = nextState;
      listeners.get('visibilitychange')?.();
    }
  };
  try {
    Date.now = () => clock.now;
    globalThis.window = {
      setTimeout(callback, delay) {
        const id = nextTimerId;
        nextTimerId += 1;
        timers.set(id, { callback, delay });
        return id;
      },
      clearTimeout(id) { timers.delete(id); }
    };
    globalThis.document = clock.document;
    return run(clock);
  } finally {
    Date.now = originalNow;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
}

function options(boundaryMilliseconds, renders = []) {
  return {
    calculateState(timestamp) { return { timestamp }; },
    renderSnapshot(state, timestamp) { renders.push({ state, timestamp }); },
    boundaryMilliseconds
  };
}

test('scheduler renders immediately and selects the earliest second boundary', () => {
  withFakeClock((clock) => {
    const renders = [];
    const stop = startLiveState(options(rules.TEMPORE_BOUNDARY_MILLISECONDS, renders));
    assert.deepEqual(renders, [{ state: { timestamp: 0 }, timestamp: 0 }]);
    assert.equal(clock.timers.size, 1);
    assert.equal([...clock.timers.values()][0].delay, 1002);
    clock.now = 998;
    clock.runTimer();
    assert.equal(renders.length, 2);
    assert.equal([...clock.timers.values()][0].delay, 16);
    stop();
  });
});

test('Calendario cadence selects calendar-day and lunar-day epoch boundaries', () => {
  withFakeClock((clock) => {
    const stop = startLiveState(options(rules.CALENDARIO_BOUNDARY_MILLISECONDS));
    assert.equal(
      [...clock.timers.values()][0].delay,
      Math.min(...rules.CALENDARIO_BOUNDARY_MILLISECONDS) + 5
    );
    clock.now = rules.REAL_MS_PER_FICTIONAL_DAY - 1;
    clock.runTimer();
    assert.equal([...clock.timers.values()][0].delay, 6);
    stop();
  });
});

test('hidden pages cancel timers and visibility restore renders immediately without duplicates', () => {
  withFakeClock((clock) => {
    const renders = [];
    const stop = startLiveState(options(rules.DESTINO_BOUNDARY_MILLISECONDS, renders));
    assert.equal(clock.timers.size, 1);
    clock.changeVisibility('hidden');
    assert.equal(clock.timers.size, 0);
    clock.now = 5000;
    assert.equal(renders.length, 1);
    clock.changeVisibility('visible');
    assert.equal(renders.length, 2);
    assert.equal(renders.at(-1).timestamp, 5000);
    assert.equal(clock.timers.size, 1);
    clock.changeVisibility('visible');
    assert.equal(renders.length, 3);
    assert.equal(clock.timers.size, 1);
    stop();
  });
});

test('an initially hidden page renders once and retains no recurring timeout', () => {
  withFakeClock((clock) => {
    const renders = [];
    const stop = startLiveState(options(rules.TEMPORE_BOUNDARY_MILLISECONDS, renders));
    assert.equal(renders.length, 1);
    assert.equal(clock.timers.size, 0);
    stop();
  }, { visibilityState: 'hidden' });
});

test('stop is idempotent, clears timers, and removes visibility handling', () => {
  withFakeClock((clock) => {
    const renders = [];
    const stop = startLiveState(options(rules.TEMPORE_BOUNDARY_MILLISECONDS, renders));
    assert.equal(clock.listeners.has('visibilitychange'), true);
    stop();
    stop();
    assert.equal(clock.timers.size, 0);
    assert.equal(clock.listeners.has('visibilitychange'), false);
    clock.changeVisibility('visible');
    assert.equal(renders.length, 1);
  });
});

test('scheduler rejects invalid options before creating timers', () => {
  withFakeClock((clock) => {
    assert.throws(() => startLiveState(), /calculateState/);
    assert.throws(() => startLiveState({ calculateState() {} }), /renderSnapshot/);
    const base = { calculateState() {}, renderSnapshot() {} };
    assert.throws(() => startLiveState({ ...base, boundaryMilliseconds: [] }), /non-empty/);
    assert.throws(() => startLiveState({ ...base, boundaryMilliseconds: [997] }), /immutable/);
    assert.throws(() => startLiveState({ ...base, boundaryMilliseconds: Object.freeze(['997']) }), TypeError);
    for (const invalid of [0, -1, 1.5, NaN, Infinity]) {
      assert.throws(
        () => startLiveState({ ...base, boundaryMilliseconds: Object.freeze([invalid]) }),
        RangeError
      );
    }
    assert.equal(clock.timers.size, 0);
  });
});
