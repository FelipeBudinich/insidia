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
  LUNAR_DAYS_PER_CYCLE,
  MOON_PHASES,
  REAL_MS_PER_FICTIONAL_SECOND,
  TIDE_PERIODS,
  calculateFictionalCalendar,
  calculateLunarState,
  createCalendarJson,
  formatLunarTime,
  formatTideTime
} from '../public/calendar.js';

function timestampForFictionalSeconds(seconds) {
  return CALENDAR_EPOCH_UNIX_MS + (seconds * REAL_MS_PER_FICTIONAL_SECOND);
}

function secondsAtLunarTime(hour, minute = 0, second = 0) {
  return (hour * FICTIONAL_SECONDS_PER_HOUR)
    + (minute * FICTIONAL_SECONDS_PER_MINUTE)
    + second;
}

test('lunar constants have the required cycle invariants', () => {
  assert.equal(MOON_PHASES.length, LUNAR_DAYS_PER_CYCLE);
  assert.deepEqual(TIDE_PERIODS.map((period) => period.id), ['low', 'high', 'parted']);
  assert.deepEqual(TIDE_PERIODS.map((period) => period.name), ['Low', 'High', 'Parted']);
  assert.equal(TIDE_PERIODS.reduce((total, period) => total + period.durationHours, 0), 31);
  assert.equal(FICTIONAL_SECONDS_PER_LUNAR_DAY, FICTIONAL_SECONDS_PER_HOUR * 31);
  assert.equal(FICTIONAL_SECONDS_PER_LUNAR_CYCLE, FICTIONAL_SECONDS_PER_LUNAR_DAY * 13);
});

test('the lunar epoch begins at Rebirth and Low tide', () => {
  const lunar = calculateLunarState(0);
  assert.equal(lunar.totalCompletedLunarDays, 0);
  assert.equal(lunar.cycle, 1);
  assert.equal(lunar.day, 1);
  assert.equal(lunar.phase.name, 'Rebirth');
  assert.deepEqual(lunar.time, { hour: 0, minute: 0, second: 0 });
  assert.equal(lunar.tide.name, 'Low');
  assert.equal(lunar.tide.hour, 1);
  assert.deepEqual(lunar.tide.timeInPeriod, { hour: 0, minute: 0, second: 0 });
});

test('each lunar day begins the required phase in order', () => {
  const expectedNames = [
    'Rebirth', 'Horn', 'Crescent', 'Passage', 'Growing', 'Waxing', 'Ascent',
    'Apex', 'Bite', 'Waning', 'Receding', 'Veil', 'Death'
  ];
  assert.deepEqual(MOON_PHASES.map((phase) => phase.name), expectedNames);

  for (const [index, name] of expectedNames.entries()) {
    const lunar = calculateLunarState(index * FICTIONAL_SECONDS_PER_LUNAR_DAY);
    assert.equal(lunar.day, index + 1);
    assert.equal(lunar.phase.name, name);
    assert.equal(formatLunarTime(lunar), '00:00:00');
  }
});

test('Low tide ends after lunar hour 16 and High begins at lunar hour 17', () => {
  const lastLowSecond = calculateLunarState(secondsAtLunarTime(16, 60, 58));
  assert.equal(lastLowSecond.tide.name, 'Low');
  assert.equal(lastLowSecond.tide.hour, 17);
  assert.equal(formatTideTime(lastLowSecond), '16:60:58');

  const firstHighSecond = calculateLunarState(secondsAtLunarTime(17));
  assert.equal(firstHighSecond.tide.name, 'High');
  assert.equal(firstHighSecond.tide.hour, 1);
  assert.deepEqual(firstHighSecond.tide.timeInPeriod, { hour: 0, minute: 0, second: 0 });
});

test('High tide ends after lunar hour 29 and Parted begins at lunar hour 30', () => {
  const lastHighSecond = calculateLunarState(secondsAtLunarTime(29, 60, 58));
  assert.equal(lastHighSecond.tide.name, 'High');
  assert.equal(lastHighSecond.tide.hour, 13);

  const firstPartedSecond = calculateLunarState(secondsAtLunarTime(30));
  assert.equal(firstPartedSecond.tide.id, 'parted');
  assert.equal(firstPartedSecond.tide.name, 'Parted');
  assert.equal(firstPartedSecond.tide.hour, 1);
  assert.deepEqual(firstPartedSecond.tide.timeInPeriod, { hour: 0, minute: 0, second: 0 });
});

test('Parted lasts through 30:60:58 before the next phase and Low tide', () => {
  const lastSecond = calculateLunarState(FICTIONAL_SECONDS_PER_LUNAR_DAY - 1);
  assert.equal(lastSecond.phase.name, 'Rebirth');
  assert.equal(formatLunarTime(lastSecond), '30:60:58');
  assert.equal(lastSecond.tide.id, 'parted');
  assert.equal(lastSecond.tide.name, 'Parted');
  assert.deepEqual(lastSecond.tide.timeInPeriod, { hour: 0, minute: 60, second: 58 });

  const nextSecond = calculateLunarState(FICTIONAL_SECONDS_PER_LUNAR_DAY);
  assert.equal(nextSecond.phase.name, 'Horn');
  assert.equal(nextSecond.day, 2);
  assert.equal(formatLunarTime(nextSecond), '00:00:00');
  assert.equal(nextSecond.tide.name, 'Low');
  assert.equal(nextSecond.tide.hour, 1);
});

test('Death rolls over to Rebirth in the next lunar cycle', () => {
  const death = calculateLunarState(12 * FICTIONAL_SECONDS_PER_LUNAR_DAY);
  assert.equal(death.cycle, 1);
  assert.equal(death.day, 13);
  assert.equal(death.phase.name, 'Death');

  const rebirth = calculateLunarState(FICTIONAL_SECONDS_PER_LUNAR_CYCLE);
  assert.equal(rebirth.cycle, 2);
  assert.equal(rebirth.day, 1);
  assert.equal(rebirth.phase.name, 'Rebirth');
  assert.equal(formatLunarTime(rebirth), '00:00:00');
  assert.equal(rebirth.tide.name, 'Low');
});

test('lunar state stays independent from calendar-day boundaries', () => {
  const afterOneCalendarDay = calculateFictionalCalendar(
    timestampForFictionalSeconds(FICTIONAL_SECONDS_PER_DAY)
  );
  assert.equal(afterOneCalendarDay.period.day, 2);
  assert.equal(afterOneCalendarDay.lunar.phase.name, 'Rebirth');
  assert.equal(formatLunarTime(afterOneCalendarDay.lunar), '23:00:00');
  assert.equal(afterOneCalendarDay.lunar.tide.name, 'High');
  assert.equal(afterOneCalendarDay.lunar.tide.hour, 7);

  const afterOneLunarDay = calculateFictionalCalendar(
    timestampForFictionalSeconds(FICTIONAL_SECONDS_PER_LUNAR_DAY)
  );
  assert.equal(afterOneLunarDay.period.day, 2);
  assert.deepEqual(afterOneLunarDay.time, { hour: 8, minute: 0, second: 0 });
  assert.equal(afterOneLunarDay.lunar.day, 2);
  assert.equal(afterOneLunarDay.lunar.phase.name, 'Horn');
  assert.equal(afterOneLunarDay.lunar.tide.name, 'Low');
});

test('the lunar cycle remains independent across the calendar year boundary', () => {
  const calendarYearBoundarySeconds = DAYS_PER_YEAR * FICTIONAL_SECONDS_PER_DAY;
  const value = calculateFictionalCalendar(timestampForFictionalSeconds(calendarYearBoundarySeconds));
  assert.equal(value.year, 2);
  assert.equal(value.lunar.cycle, 21);
  assert.equal(value.lunar.day, 2);
  assert.equal(value.lunar.phase.name, 'Horn');
  assert.equal(formatLunarTime(value.lunar), '28:00:00');
  assert.equal(value.lunar.tide.name, 'High');
  assert.equal(value.lunar.tide.hour, 12);
});

test('v6 JSON keeps calendar, season, lunar, and orbital fields while adding progress', () => {
  const value = calculateFictionalCalendar(CALENDAR_EPOCH_UNIX_MS);
  const snapshot = createCalendarJson(value, CALENDAR_EPOCH_UNIX_MS);
  assert.equal(snapshot.calendarVersion, 'v6');
  assert.equal(snapshot.fictional.year, 1);
  assert.equal(snapshot.fictional.period.month, 1);
  assert.equal(snapshot.fictional.time.formatted, '00:00:00');
  assert.equal(snapshot.fictional.lunar.cycle, 1);
  assert.equal(snapshot.fictional.lunar.day, 1);
  assert.equal(snapshot.fictional.lunar.phase.name, 'Rebirth');
  assert.equal(snapshot.fictional.lunar.time.formatted, '00:00:00');
  assert.equal(snapshot.fictional.lunar.tide.name, 'Low');
  assert.equal(snapshot.fictional.lunar.tide.hour, 1);
  assert.equal(snapshot.fictional.lunar.tide.timeInPeriod.formatted, '00:00:00');
  assert.equal(snapshot.fictional.season.name, 'Bones');
  assert.equal(snapshot.fictional.orbits.bodies.length, 5);
  assert.equal(snapshot.fictional.progress.lunarPhase.fraction, 0);
});

test('v6 JSON exposes the Parted tide enum', () => {
  const realUnixMilliseconds = timestampForFictionalSeconds(secondsAtLunarTime(30));
  const value = calculateFictionalCalendar(realUnixMilliseconds);
  const snapshot = createCalendarJson(value, realUnixMilliseconds);
  assert.equal(snapshot.fictional.lunar.tide.id, 'parted');
  assert.equal(snapshot.fictional.lunar.tide.name, 'Parted');
});

test('lunar and tide formatting preserves fictional clock ranges', () => {
  assert.equal(formatLunarTime(calculateLunarState(0)), '00:00:00');
  assert.equal(formatLunarTime(calculateLunarState(secondsAtLunarTime(17))), '17:00:00');
  assert.equal(formatLunarTime(calculateLunarState(secondsAtLunarTime(30, 60, 58))), '30:60:58');
});

test('invalid lunar inputs are rejected', () => {
  for (const invalidValue of [NaN, Infinity, -1, '0', 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculateLunarState(invalidValue), /totalFictionalSeconds/);
  }
});
