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
  millisecondsUntilNextBoundary
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

test('first-tide progress starts at zero, advances by lunar seconds, and remains below one', () => {
  const firstTideDurationSeconds = 17 * rules.LUNAR_SECONDS_PER_HOUR;
  const epoch = calculateCalendarState(0);
  assert.equal(epoch.lunar.tide.id, 'tide-01');
  assert.deepEqual(epoch.progress.tide, { fraction: 0, percentage: 0 });

  const oneSecond = calculateCalendarState(rules.REAL_MS_PER_LUNAR_SECOND);
  assert.equal(oneSecond.progress.tide.fraction, 1 / firstTideDurationSeconds);
  assert.equal(oneSecond.progress.tide.percentage, (1 / firstTideDurationSeconds) * 100);

  const finalSecond = calculateCalendarState(
    (firstTideDurationSeconds * rules.REAL_MS_PER_LUNAR_SECOND) - 1
  );
  assert.equal(finalSecond.lunar.tide.id, 'tide-01');
  assert.equal(finalSecond.progress.tide.fraction, (firstTideDurationSeconds - 1) / firstTideDurationSeconds);
  assert.ok(finalSecond.progress.tide.fraction < 1);
  assert.equal(finalSecond.outcome.outcomeTypeId, 'outcome-tier-03');
});

test('tide progress and Outcome rarity reset at every tide boundary', () => {
  const firstTideDurationSeconds = 17 * rules.LUNAR_SECONDS_PER_HOUR;
  const secondTideDurationSeconds = 13 * rules.LUNAR_SECONDS_PER_HOUR;
  const boundaries = [
    [firstTideDurationSeconds, 'tide-02'],
    [firstTideDurationSeconds + secondTideDurationSeconds, 'tide-03'],
    [rules.LUNAR_SECONDS_PER_DAY, 'tide-01']
  ];
  for (const [elapsedLunarSeconds, expectedTideId] of boundaries) {
    const state = calculateCalendarState(lunarTimestamp(elapsedLunarSeconds));
    assert.equal(state.lunar.tide.id, expectedTideId);
    assert.deepEqual(state.progress.tide, { fraction: 0, percentage: 0 });
    assert.equal(state.outcome.outcomeTypeId, 'outcome-tier-01');
    assert.equal(state.outcome.attemptsUntilRare, 100);
    assert.equal(state.outcome.tideProgressFraction, 0);
    assert.equal(state.outcome.tideProgressPercentage, 0);
  }
});

test('each tide length has independent start, midpoint, final-second, and reset progress', () => {
  const tidePeriods = [
    { id: 'tide-01', start: 0, duration: 17 * rules.LUNAR_SECONDS_PER_HOUR, nextId: 'tide-02' },
    { id: 'tide-02', start: 17 * rules.LUNAR_SECONDS_PER_HOUR, duration: 13 * rules.LUNAR_SECONDS_PER_HOUR, nextId: 'tide-03' },
    { id: 'tide-03', start: 30 * rules.LUNAR_SECONDS_PER_HOUR, duration: rules.LUNAR_SECONDS_PER_HOUR, nextId: 'tide-01' }
  ];
  for (const { id, start, duration, nextId } of tidePeriods) {
    const atStart = calculateCalendarState(lunarTimestamp(start));
    assert.equal(atStart.lunar.tide.id, id);
    assert.equal(atStart.progress.tide.fraction, 0);

    const midpointSecond = Math.floor(duration / 2);
    const atMidpoint = calculateCalendarState(lunarTimestamp(start + midpointSecond));
    assert.equal(atMidpoint.lunar.tide.id, id);
    assert.equal(atMidpoint.progress.tide.fraction, midpointSecond / duration);
    assert.ok(Math.abs(atMidpoint.progress.tide.fraction - 0.5) <= 1 / duration);

    const atFinalSecond = calculateCalendarState(lunarTimestamp(start + duration - 1));
    assert.equal(atFinalSecond.lunar.tide.id, id);
    assert.equal(atFinalSecond.progress.tide.fraction, (duration - 1) / duration);
    assert.ok(atFinalSecond.progress.tide.fraction < 1);
    assert.equal(atFinalSecond.outcome.outcomeTypeId, 'outcome-tier-03');

    const atNextTide = calculateCalendarState(lunarTimestamp(start + duration));
    assert.equal(atNextTide.lunar.tide.id, nextId);
    assert.equal(atNextTide.progress.tide.fraction, 0);
    assert.equal(atNextTide.outcome.outcomeTypeId, 'outcome-tier-01');
    assert.equal(atNextTide.outcome.attemptsUntilRare, 100);
  }
});

test('Outcome rarity is driven by tide progress while calendar-hour progress stays independent', () => {
  const firstTideDurationSeconds = 17 * rules.LUNAR_SECONDS_PER_HOUR;
  const firstRareLunarSecond = Math.floor(firstTideDurationSeconds * 0.99) + 1;
  const timestamp = firstRareLunarSecond * rules.REAL_MS_PER_LUNAR_SECOND;
  const state = calculateCalendarState(timestamp);
  const expectedCalendarSeconds = Math.floor(timestamp / rules.REAL_MS_PER_FICTIONAL_SECOND);
  const expectedHourFraction = (expectedCalendarSeconds % rules.FICTIONAL_SECONDS_PER_HOUR)
    / rules.FICTIONAL_SECONDS_PER_HOUR;

  assert.ok(state.progress.tide.fraction > 0.99);
  assert.ok(state.progress.hour.fraction <= 0.85);
  assert.equal(state.progress.hour.fraction, expectedHourFraction);
  assert.equal(state.progress.hour.percentage, expectedHourFraction * 100);
  assert.equal(state.outcome.outcomeTypeId, 'outcome-tier-03');
  assert.equal(state.outcome.attemptsUntilRare, 0);
  assert.equal(state.outcome.tideProgressFraction, state.progress.tide.fraction);
  assert.equal(state.outcome.tideProgressPercentage, state.progress.tide.percentage);
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
