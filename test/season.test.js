import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CALENDAR_EPOCH_UNIX_MS,
  DAYS_PER_YEAR,
  FICTIONAL_SECONDS_PER_DAY,
  FICTIONAL_SECONDS_PER_HOUR,
  FICTIONAL_SECONDS_PER_LUNAR_DAY,
  REAL_MS_PER_FICTIONAL_SECOND,
  SEASONAL_CYCLE_LENGTH_DAYS,
  SEASONS,
  SEASONS_PER_CYCLE,
  SEASON_LENGTH_DAYS,
  calculateFictionalCalendar,
  calculateSeasonState,
  createCalendarJson,
  formatSeason
} from '../public/calendar.js';

function timestampForFictionalSeconds(seconds) {
  return CALENDAR_EPOCH_UNIX_MS + (seconds * REAL_MS_PER_FICTIONAL_SECOND);
}

function timestampForElapsedDays(days) {
  return timestampForFictionalSeconds(days * FICTIONAL_SECONDS_PER_DAY);
}

test('season definitions have the required 358-day invariant', () => {
  assert.equal(SEASONS.length, SEASONS_PER_CYCLE);
  assert.deepEqual(SEASONS.map((season) => season.name), ['Bones', 'Tears']);
  assert.ok(SEASONS.every((season) => season.durationDays === SEASON_LENGTH_DAYS));
  assert.equal(SEASONAL_CYCLE_LENGTH_DAYS, 358);
  assert.equal(SEASONS.reduce((total, season) => total + season.durationDays, 0), SEASONAL_CYCLE_LENGTH_DAYS);
});

test('the epoch begins with Bones on the first seasonal day', () => {
  const season = calculateSeasonState(0);
  assert.deepEqual(season, {
    totalCompletedSeasonalCycles: 0,
    cycle: 1,
    dayOfCycle: 1,
    cycleLengthDays: 358,
    id: 'bones',
    name: 'Bones',
    day: 1,
    lengthDays: 179,
    next: { id: 'tears', name: 'Tears' }
  });
  assert.equal(formatSeason(season), 'Bones · Day 1 of 179 · Seasonal Cycle 1');
});

test('Bones ends on seasonal day 179 and Tears begins on day 180', () => {
  const lastBonesDay = calculateSeasonState(178);
  assert.equal(lastBonesDay.cycle, 1);
  assert.equal(lastBonesDay.dayOfCycle, 179);
  assert.equal(lastBonesDay.name, 'Bones');
  assert.equal(lastBonesDay.day, 179);

  const firstTearsDay = calculateSeasonState(179);
  assert.equal(firstTearsDay.cycle, 1);
  assert.equal(firstTearsDay.dayOfCycle, 180);
  assert.equal(firstTearsDay.name, 'Tears');
  assert.equal(firstTearsDay.day, 1);
  assert.deepEqual(firstTearsDay.next, { id: 'bones', name: 'Bones' });
});

test('Tears ends on seasonal day 358 and the next cycle starts with Bones', () => {
  const lastTearsDay = calculateSeasonState(357);
  assert.equal(lastTearsDay.cycle, 1);
  assert.equal(lastTearsDay.dayOfCycle, 358);
  assert.equal(lastTearsDay.name, 'Tears');
  assert.equal(lastTearsDay.day, 179);

  const nextCycle = calculateSeasonState(358);
  assert.equal(nextCycle.totalCompletedSeasonalCycles, 1);
  assert.equal(nextCycle.cycle, 2);
  assert.equal(nextCycle.dayOfCycle, 1);
  assert.equal(nextCycle.name, 'Bones');
  assert.equal(nextCycle.day, 1);
});

test('the Bones to Tears transition occurs exactly at a calendar midnight', () => {
  const finalBonesSecond = calculateFictionalCalendar(
    timestampForFictionalSeconds((SEASON_LENGTH_DAYS * FICTIONAL_SECONDS_PER_DAY) - 1)
  );
  assert.equal(finalBonesSecond.season.name, 'Bones');
  assert.equal(finalBonesSecond.season.day, 179);
  assert.deepEqual(finalBonesSecond.time, { hour: 22, minute: 60, second: 58 });

  const firstTearsSecond = calculateFictionalCalendar(
    timestampForFictionalSeconds(SEASON_LENGTH_DAYS * FICTIONAL_SECONDS_PER_DAY)
  );
  assert.equal(firstTearsSecond.season.name, 'Tears');
  assert.equal(firstTearsSecond.season.day, 1);
  assert.deepEqual(firstTearsSecond.time, { hour: 0, minute: 0, second: 0 });
});

test('seasons continue independently across calendar New Year', () => {
  const yearTwo = calculateFictionalCalendar(timestampForElapsedDays(DAYS_PER_YEAR));
  assert.equal(yearTwo.year, 2);
  assert.deepEqual(yearTwo.period, { type: 'month', month: 1, day: 1, length: 29 });
  assert.equal(yearTwo.season.cycle, 1);
  assert.equal(yearTwo.season.dayOfCycle, 354);
  assert.equal(yearTwo.season.name, 'Tears');
  assert.equal(yearTwo.season.day, 175);

  const seasonTwo = calculateFictionalCalendar(timestampForElapsedDays(SEASONAL_CYCLE_LENGTH_DAYS));
  assert.equal(seasonTwo.year, 2);
  assert.deepEqual(seasonTwo.period, { type: 'month', month: 1, day: 6, length: 29 });
  assert.equal(seasonTwo.season.cycle, 2);
  assert.equal(seasonTwo.season.name, 'Bones');
  assert.equal(seasonTwo.season.day, 1);
});

test('the season does not reset at an Inter Regnum boundary', () => {
  const firstInterRegnumDay = calculateFictionalCalendar(timestampForElapsedDays(29));
  assert.deepEqual(firstInterRegnumDay.period, {
    type: 'inter_regnum', fromMonth: 1, toMonth: 2, day: 1, length: 3
  });
  assert.equal(firstInterRegnumDay.season.name, 'Bones');
  assert.equal(firstInterRegnumDay.season.day, 30);
});

test('the season is based on 23-hour calendar days rather than lunar days', () => {
  const afterOneLunarDay = calculateFictionalCalendar(
    timestampForFictionalSeconds(FICTIONAL_SECONDS_PER_LUNAR_DAY)
  );
  assert.deepEqual(afterOneLunarDay.time, { hour: 8, minute: 0, second: 0 });
  assert.equal(afterOneLunarDay.period.day, 2);
  assert.equal(afterOneLunarDay.season.name, 'Bones');
  assert.equal(afterOneLunarDay.season.day, 2);
  assert.equal(afterOneLunarDay.totalSeconds, FICTIONAL_SECONDS_PER_LUNAR_DAY);
  assert.equal(FICTIONAL_SECONDS_PER_LUNAR_DAY, FICTIONAL_SECONDS_PER_HOUR * 31);
});

test('calendar calculation includes exactly the calculated season state', () => {
  const value = calculateFictionalCalendar(timestampForElapsedDays(200));
  assert.deepEqual(value.season, calculateSeasonState(value.totalElapsedDays));
});

test('v3 calendar JSON preserves calendar and lunar data and adds season', () => {
  const value = calculateFictionalCalendar(CALENDAR_EPOCH_UNIX_MS);
  const snapshot = createCalendarJson(value, CALENDAR_EPOCH_UNIX_MS);
  assert.equal(snapshot.calendarVersion, 'v3');
  assert.equal(snapshot.fictional.year, 1);
  assert.equal(snapshot.fictional.period.month, 1);
  assert.equal(snapshot.fictional.time.formatted, '00:00:00');
  assert.equal(snapshot.fictional.lunar.phase.name, 'Rebirth');
  assert.equal(snapshot.fictional.lunar.tide.name, 'Low');
  assert.deepEqual(snapshot.fictional.season, {
    cycle: 1,
    dayOfCycle: 1,
    cycleLengthDays: 358,
    id: 'bones',
    name: 'Bones',
    day: 1,
    lengthDays: 179,
    next: { id: 'tears', name: 'Tears' }
  });
});

test('invalid total elapsed day values are rejected', () => {
  for (const invalidValue of [NaN, Infinity, -1, '0', 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculateSeasonState(invalidValue), /totalElapsedDays/);
  }
});
