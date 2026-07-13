import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCalendarState,
  calculateLunarState,
  calculateOrbitalState,
  calculateProgressState
} from '../public/core/mechanics.js';
import { formatClock } from '../public/core/formatting.js';
import {
  millisecondsUntilNextBoundary,
  startLiveState
} from '../public/live-state.js';
import * as rules from '../public/core/rules.js';

const lunarTimestamp = (lunarSeconds) => lunarSeconds * rules.REAL_MS_PER_LUNAR_SECOND;
const lunarTime = (realUnixMilliseconds) => calculateCalendarState(realUnixMilliseconds).lunar.time;
const bareLunarTime = (realUnixMilliseconds) => {
  const { hour, minute, second } = lunarTime(realUnixMilliseconds);
  return { hour, minute, second };
};

test('calendar and lunar unit constants have exact independent durations', () => {
  assert.equal(rules.REAL_MS_PER_FICTIONAL_SECOND, 997);
  assert.equal(rules.FICTIONAL_SECONDS_PER_MINUTE, 59);
  assert.equal(rules.FICTIONAL_MINUTES_PER_HOUR, 61);
  assert.equal(rules.FICTIONAL_SECONDS_PER_HOUR, 3599);
  assert.equal(rules.REAL_MS_PER_LUNAR_SECOND, 1009);
  assert.equal(rules.LUNAR_SECONDS_PER_MINUTE, 59);
  assert.equal(rules.LUNAR_MINUTES_PER_HOUR, 67);
  assert.equal(rules.LUNAR_SECONDS_PER_HOUR, 3953);
  assert.equal(rules.LUNAR_HOURS_PER_DAY, 31);
  assert.equal(rules.LUNAR_SECONDS_PER_DAY, 122543);
  assert.equal(rules.LUNAR_DAYS_PER_CYCLE, 13);
  assert.equal(rules.LUNAR_SECONDS_PER_CYCLE, 1593059);
  assert.equal(rules.LUNAR_SECONDS_PER_MINUTE * rules.REAL_MS_PER_LUNAR_SECOND, 59531);
  assert.equal(rules.LUNAR_SECONDS_PER_HOUR * rules.REAL_MS_PER_LUNAR_SECOND, 3988577);
  assert.equal(rules.LUNAR_SECONDS_PER_DAY * rules.REAL_MS_PER_LUNAR_SECOND, 123645887);
  assert.equal(rules.LUNAR_SECONDS_PER_CYCLE * rules.REAL_MS_PER_LUNAR_SECOND, 1607396531);
});

test('calendar and lunar seconds cross their own real-millisecond boundaries', () => {
  for (const [milliseconds, calendar, lunar, totalSeconds, totalLunarSeconds] of [
    [996, '00:00:00', '00:00:00', 0, 0],
    [997, '00:00:01', '00:00:00', 1, 0],
    [1008, '00:00:01', '00:00:00', 1, 0],
    [1009, '00:00:01', '00:00:01', 1, 1]
  ]) {
    const state = calculateCalendarState(milliseconds);
    assert.equal(formatClock(state.calendar.time), calendar, `${milliseconds} calendar`);
    assert.equal(formatClock(state.lunar.time), lunar, `${milliseconds} lunar`);
    assert.equal(state.totalSeconds, totalSeconds, `${milliseconds} totalSeconds`);
    assert.equal(state.totalLunarSeconds, totalLunarSeconds, `${milliseconds} totalLunarSeconds`);
  }
});

test('lunar minutes and 67-minute lunar hours use only lunar units', () => {
  const minuteBoundary = rules.LUNAR_SECONDS_PER_MINUTE;
  const hourBoundary = rules.LUNAR_SECONDS_PER_HOUR;
  assert.equal(formatClock(lunarTime(lunarTimestamp(minuteBoundary) - 1)), '00:00:58');
  assert.equal(formatClock(lunarTime(lunarTimestamp(minuteBoundary))), '00:01:00');
  assert.deepEqual(bareLunarTime(lunarTimestamp(hourBoundary) - 1), { hour: 0, minute: 66, second: 58 });
  assert.deepEqual(bareLunarTime(lunarTimestamp(hourBoundary)), { hour: 1, minute: 0, second: 0 });
  assert.equal(formatClock({ hour: 0, minute: 66, second: 58 }), '00:66:58');
});

test('calendar and lunar clocks diverge at their exact hour boundaries', () => {
  const atCalendarHour = calculateCalendarState(
    rules.FICTIONAL_SECONDS_PER_HOUR * rules.REAL_MS_PER_FICTIONAL_SECOND
  );
  assert.equal(formatClock(atCalendarHour.calendar.time), '01:00:00');
  assert.equal(formatClock(atCalendarHour.lunar.time), '00:60:16');

  const atLunarHour = calculateCalendarState(
    rules.LUNAR_SECONDS_PER_HOUR * rules.REAL_MS_PER_LUNAR_SECOND
  );
  assert.equal(formatClock(atLunarHour.lunar.time), '01:00:00');
  assert.equal(formatClock(atLunarHour.calendar.time), '01:06:47');
});

test('lunar days and cycles cross exact independent boundaries', () => {
  const beforeDay = calculateCalendarState(lunarTimestamp(rules.LUNAR_SECONDS_PER_DAY) - 1);
  assert.equal(beforeDay.lunar.day, 1);
  assert.equal(formatClock(beforeDay.lunar.time), '30:66:58');
  const atDay = calculateCalendarState(lunarTimestamp(rules.LUNAR_SECONDS_PER_DAY));
  assert.equal(atDay.lunar.day, 2);
  assert.equal(formatClock(atDay.lunar.time), '00:00:00');

  const beforeCycle = calculateCalendarState(lunarTimestamp(rules.LUNAR_SECONDS_PER_CYCLE) - 1);
  assert.equal(beforeCycle.lunar.cycle, 1);
  assert.equal(beforeCycle.lunar.day, 13);
  const atCycle = calculateCalendarState(lunarTimestamp(rules.LUNAR_SECONDS_PER_CYCLE));
  assert.equal(atCycle.lunar.cycle, 2);
  assert.equal(atCycle.lunar.day, 1);
  assert.equal(atCycle.lunar.phaseId, 'phase-01');
  assert.equal(formatClock(atCycle.lunar.time), '00:00:00');
});

test('all three tides fill one 31-hour lunar day at lunar-hour boundaries', () => {
  const atHour = (hour, offset = 0) => calculateCalendarState(
    lunarTimestamp(hour * rules.LUNAR_SECONDS_PER_HOUR) + offset
  ).lunar;
  for (const [state, tideId, tideHour, localTime] of [
    [atHour(17, -1), 'tide-01', 17, '16:66:58'],
    [atHour(17), 'tide-02', 1, '00:00:00'],
    [atHour(30, -1), 'tide-02', 13, '12:66:58'],
    [atHour(30), 'tide-03', 1, '00:00:00'],
    [atHour(31), 'tide-01', 1, '00:00:00']
  ]) {
    assert.equal(state.tide.id, tideId);
    assert.equal(state.tide.hour, tideHour);
    assert.equal(formatClock(state.tide.timeInPeriod), localTime);
  }
  assert.equal(atHour(31).day, 2);
});

test('raw lunar time publishes its exact independent unit metadata', () => {
  assert.deepEqual(calculateCalendarState(0).lunar.time, {
    hour: 0,
    minute: 0,
    second: 0,
    realMillisecondsPerLunarSecond: 1009,
    secondsPerLunarMinute: 59,
    minutesPerLunarHour: 67,
    hoursPerLunarDay: 31
  });
});

test('lunar progress resets on lunar boundaries while calendar progress stays calendar-based', () => {
  const beforeDay = calculateCalendarState(lunarTimestamp(rules.LUNAR_SECONDS_PER_DAY) - 1);
  const atDay = calculateCalendarState(lunarTimestamp(rules.LUNAR_SECONDS_PER_DAY));
  assert.ok(beforeDay.progress.lunarPhase.fraction > 0.999);
  assert.equal(atDay.progress.lunarPhase.fraction, 0);
  assert.equal(atDay.progress.lunarCycle.fraction, 1 / rules.LUNAR_DAYS_PER_CYCLE);

  const beforeCycle = calculateCalendarState(lunarTimestamp(rules.LUNAR_SECONDS_PER_CYCLE) - 1);
  const atCycle = calculateCalendarState(lunarTimestamp(rules.LUNAR_SECONDS_PER_CYCLE));
  assert.ok(beforeCycle.progress.lunarCycle.fraction > 0.999);
  assert.equal(atCycle.progress.lunarCycle.fraction, 0);

  const beforeLunarTick = calculateCalendarState(1008);
  const atLunarTick = calculateCalendarState(1009);
  assert.equal(beforeLunarTick.totalSeconds, atLunarTick.totalSeconds);
  for (const key of ['hour', 'day', 'year', 'season']) {
    assert.deepEqual(beforeLunarTick.progress[key], atLunarTick.progress[key], key);
  }
  assert.equal(beforeLunarTick.progress.lunarPhase.fraction, 0);
  assert.equal(atLunarTick.progress.lunarPhase.fraction, 1 / rules.LUNAR_SECONDS_PER_DAY);
});

test('Moon orbit stays synchronized to the independent lunar cycle', () => {
  for (const timestamp of [
    0,
    lunarTimestamp((8 * rules.LUNAR_SECONDS_PER_DAY) + 12345),
    lunarTimestamp(rules.LUNAR_SECONDS_PER_CYCLE),
    lunarTimestamp((3 * rules.LUNAR_SECONDS_PER_CYCLE) + (5 * rules.LUNAR_SECONDS_PER_DAY) + 42)
  ]) {
    const state = calculateCalendarState(timestamp);
    const moon = state.orbits.bodies.find(({ id }) => id === 'body-06');
    assert.equal(moon.progressFraction, state.progress.lunarCycle.fraction);
    assert.equal(moon.orbit, state.lunar.cycle);
    assert.equal(moon.dayOfOrbit, state.lunar.day);
  }
  const atCycle = calculateCalendarState(lunarTimestamp(rules.LUNAR_SECONDS_PER_CYCLE));
  const moon = atCycle.orbits.bodies.find(({ id }) => id === 'body-06');
  assert.equal(moon.orbit, 2);
  assert.equal(moon.progressFraction, 0);
  assert.equal(atCycle.progress.lunarCycle.fraction, 0);
});

test('planets remain based on calendar seconds while only the Moon uses lunar seconds', () => {
  const timestamp = lunarTimestamp(rules.LUNAR_SECONDS_PER_HOUR);
  const state = calculateCalendarState(timestamp);
  for (const body of state.orbits.bodies) {
    const usesLunarTime = body.id === 'body-06';
    const elapsed = usesLunarTime ? state.totalLunarSeconds : state.totalSeconds;
    const unitSeconds = usesLunarTime ? rules.LUNAR_SECONDS_PER_DAY : rules.FICTIONAL_SECONDS_PER_DAY;
    const periodSeconds = body.orbitalPeriod.value * unitSeconds;
    assert.equal(body.progressFraction, (elapsed % periodSeconds) / periodSeconds, body.id);
  }
  const firstPlanet = state.orbits.bodies[0];
  assert.notEqual(
    firstPlanet.progressFraction,
    (state.totalLunarSeconds % (89 * rules.FICTIONAL_SECONDS_PER_DAY)) / (89 * rules.FICTIONAL_SECONDS_PER_DAY)
  );
});

test('independent mechanics functions validate both counters', () => {
  for (const invalid of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculateLunarState(invalid), RangeError);
    assert.throws(() => calculateOrbitalState(0, invalid), RangeError);
    assert.throws(() => calculateOrbitalState(invalid, 0), RangeError);
  }
  assert.throws(() => calculateLunarState('0'), TypeError);
  assert.throws(() => calculateOrbitalState(0, '0'), TypeError);
  assert.throws(() => calculateProgressState(0, -1, {}, {}), RangeError);
});

test('boundary helper is epoch-relative and returns a full unit on a boundary', () => {
  for (const unit of [997, 1009]) {
    assert.equal(millisecondsUntilNextBoundary(0, unit), unit);
    assert.equal(millisecondsUntilNextBoundary(unit - 1, unit), 1);
    assert.equal(millisecondsUntilNextBoundary(unit, unit), unit);
    assert.equal(millisecondsUntilNextBoundary(unit + 1, unit), unit - 1);
  }
  for (const invalid of ['0', null]) {
    assert.throws(() => millisecondsUntilNextBoundary(invalid, 997), TypeError);
    assert.throws(() => millisecondsUntilNextBoundary(0, invalid), TypeError);
  }
  for (const invalid of [NaN, Infinity]) {
    assert.throws(() => millisecondsUntilNextBoundary(invalid, 997), RangeError);
  }
  for (const invalid of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => millisecondsUntilNextBoundary(0, invalid), RangeError);
  }
});

test('live scheduler chooses the earlier calendar or lunar second boundary', () => {
  const originalNow = Date.now;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const scheduled = [];
  let now = 0;
  const listeners = new Map();
  try {
    Date.now = () => now;
    globalThis.window = {
      clearTimeout() {},
      setTimeout(callback, delay) {
        scheduled.push({ callback, delay });
        return scheduled.length;
      }
    };
    globalThis.document = {
      visibilityState: 'visible',
      addEventListener(type, callback) { listeners.set(type, callback); },
      removeEventListener(type) { listeners.delete(type); }
    };
    const stop = startLiveState(() => {});
    assert.equal(scheduled.at(-1).delay, 997 + 5);
    now = 998;
    scheduled.at(-1).callback();
    assert.equal(scheduled.at(-1).delay, (1009 - 998) + 5);
    assert.equal(listeners.has('visibilitychange'), true);
    stop();
    assert.equal(listeners.has('visibilitychange'), false);
  } finally {
    Date.now = originalNow;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
