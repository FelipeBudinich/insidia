import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CALENDAR_EPOCH_UNIX_MS,
  DAYS_PER_YEAR,
  FICTIONAL_SECONDS_PER_DAY,
  FICTIONAL_SECONDS_PER_HOUR,
  FICTIONAL_SECONDS_PER_LUNAR_CYCLE,
  FICTIONAL_SECONDS_PER_LUNAR_DAY,
  FICTIONAL_SECONDS_PER_MINUTE,
  REAL_MS_PER_FICTIONAL_SECOND,
  SEASON_LENGTH_DAYS,
  calculateFictionalCalendar,
  createCalendarJson
} from '../public/calendar.js';

const progressKeys = ['lunarCycle', 'lunarPhase', 'season', 'year', 'day', 'hour'];

function calendarAtSeconds(totalFictionalSeconds) {
  return calculateFictionalCalendar(
    CALENDAR_EPOCH_UNIX_MS + (totalFictionalSeconds * REAL_MS_PER_FICTIONAL_SECOND)
  );
}

function assertApproximately(actual, expected, epsilon = 1e-15) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
}

function assertBelowBoundary(progressValue) {
  assert.ok(progressValue.fraction >= 0);
  assert.ok(progressValue.fraction < 1);
  assert.notEqual(progressValue.formatted, '100.000000%');
}

test('all six progress values begin at zero at the epoch', () => {
  const { progress } = calendarAtSeconds(0);
  assert.deepEqual(Object.keys(progress), progressKeys);
  for (const key of progressKeys) {
    assert.deepEqual(progress[key], {
      fraction: 0,
      percentage: 0,
      formatted: '0.000000%'
    });
  }
});

test('all progress values include the current fictional second', () => {
  const { progress } = calendarAtSeconds(1);
  for (const key of progressKeys) {
    assert.ok(progress[key].fraction > 0, key);
    assert.ok(progress[key].percentage > 0, key);
  }
});

test('hour progress uses all 61 fictional minutes and resets on the hour', () => {
  const afterOneMinute = calendarAtSeconds(FICTIONAL_SECONDS_PER_MINUTE).progress.hour;
  assertApproximately(afterOneMinute.fraction, 1 / 61);
  const beforeBoundary = calendarAtSeconds(FICTIONAL_SECONDS_PER_HOUR - 1).progress.hour;
  assertBelowBoundary(beforeBoundary);
  assert.equal(calendarAtSeconds(FICTIONAL_SECONDS_PER_HOUR).progress.hour.fraction, 0);
});

test('day progress uses all 23 fictional hours and resets at midnight', () => {
  const afterOneHour = calendarAtSeconds(FICTIONAL_SECONDS_PER_HOUR).progress.day;
  assertApproximately(afterOneHour.fraction, 1 / 23);
  const beforeBoundary = calendarAtSeconds(FICTIONAL_SECONDS_PER_DAY - 1).progress.day;
  assertBelowBoundary(beforeBoundary);
  assert.equal(calendarAtSeconds(FICTIONAL_SECONDS_PER_DAY).progress.day.fraction, 0);
});

test('year progress uses all 353 days and resets at New Year', () => {
  const yearLengthSeconds = DAYS_PER_YEAR * FICTIONAL_SECONDS_PER_DAY;
  const afterOneDay = calendarAtSeconds(FICTIONAL_SECONDS_PER_DAY).progress.year;
  assertApproximately(afterOneDay.fraction, 1 / DAYS_PER_YEAR);
  assertBelowBoundary(calendarAtSeconds(yearLengthSeconds - 1).progress.year);
  assert.equal(calendarAtSeconds(yearLengthSeconds).progress.year.fraction, 0);
});

test('season progress resets at both Bones-to-Tears and Tears-to-Bones boundaries', () => {
  const oneSeasonSeconds = SEASON_LENGTH_DAYS * FICTIONAL_SECONDS_PER_DAY;
  const fullSeasonalCycleSeconds = oneSeasonSeconds * 2;
  const beforeTears = calendarAtSeconds(oneSeasonSeconds - 1);
  assert.equal(beforeTears.season.name, 'Bones');
  assertBelowBoundary(beforeTears.progress.season);
  const firstTearsSecond = calendarAtSeconds(oneSeasonSeconds);
  assert.equal(firstTearsSecond.season.name, 'Tears');
  assert.equal(firstTearsSecond.progress.season.fraction, 0);

  const beforeBones = calendarAtSeconds(fullSeasonalCycleSeconds - 1);
  assert.equal(beforeBones.season.name, 'Tears');
  assertBelowBoundary(beforeBones.progress.season);
  const firstBonesSecond = calendarAtSeconds(fullSeasonalCycleSeconds);
  assert.equal(firstBonesSecond.season.name, 'Bones');
  assert.equal(firstBonesSecond.progress.season.fraction, 0);
});

test('lunar phase progress resets every 31 fictional hours', () => {
  assertBelowBoundary(calendarAtSeconds(FICTIONAL_SECONDS_PER_LUNAR_DAY - 1).progress.lunarPhase);
  assert.equal(calendarAtSeconds(FICTIONAL_SECONDS_PER_LUNAR_DAY).progress.lunarPhase.fraction, 0);
});

test('lunar cycle progress resets after all 13 lunar days', () => {
  assertBelowBoundary(calendarAtSeconds(FICTIONAL_SECONDS_PER_LUNAR_CYCLE - 1).progress.lunarCycle);
  assert.equal(calendarAtSeconds(FICTIONAL_SECONDS_PER_LUNAR_CYCLE).progress.lunarCycle.fraction, 0);
});

test('every final pre-boundary progress value stays below one', () => {
  const boundarySecondsByKey = {
    lunarCycle: FICTIONAL_SECONDS_PER_LUNAR_CYCLE,
    lunarPhase: FICTIONAL_SECONDS_PER_LUNAR_DAY,
    season: SEASON_LENGTH_DAYS * FICTIONAL_SECONDS_PER_DAY,
    year: DAYS_PER_YEAR * FICTIONAL_SECONDS_PER_DAY,
    day: FICTIONAL_SECONDS_PER_DAY,
    hour: FICTIONAL_SECONDS_PER_HOUR
  };
  for (const [key, boundarySeconds] of Object.entries(boundarySecondsByKey)) {
    assertBelowBoundary(calendarAtSeconds(boundarySeconds - 1).progress[key]);
  }
});

test('schema v7 JSON contains all six progress objects', () => {
  const value = calendarAtSeconds(1);
  const realUnixMilliseconds = REAL_MS_PER_FICTIONAL_SECOND;
  const snapshot = createCalendarJson(value, realUnixMilliseconds);
  assert.equal(snapshot.calendarVersion, 'v7');
  assert.deepEqual(Object.keys(snapshot.fictional.progress), progressKeys);
  for (const key of progressKeys) {
    assert.deepEqual(Object.keys(snapshot.fictional.progress[key]), ['fraction', 'percentage', 'formatted']);
    assert.deepEqual(snapshot.fictional.progress[key], value.progress[key]);
  }
  assert.equal(snapshot.fictional.lunar.tide.name, 'Low');
  assert.equal(snapshot.fictional.orbits.bodies.length, 6);
});
