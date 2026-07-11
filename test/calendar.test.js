import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CALENDAR_EPOCH_UNIX_MS,
  DAYS_PER_YEAR,
  FICTIONAL_SECONDS_PER_DAY,
  FICTIONAL_SECONDS_PER_HOUR,
  REAL_MS_PER_FICTIONAL_SECOND,
  calculateFictionalCalendar,
  createCalendarJson
} from '../public/calendar.js';

function timestampForFictionalSeconds(seconds) {
  return CALENDAR_EPOCH_UNIX_MS + (seconds * REAL_MS_PER_FICTIONAL_SECOND);
}

function timestampForDayIndex(dayIndex) {
  return timestampForFictionalSeconds(dayIndex * FICTIONAL_SECONDS_PER_DAY);
}

test('the epoch is Year 1, Month 1, Day 1 at midnight', () => {
  const value = calculateFictionalCalendar(CALENDAR_EPOCH_UNIX_MS);
  assert.equal(value.year, 1);
  assert.equal(value.dayOfYear, 1);
  assert.deepEqual(value.period, { type: 'month', month: 1, day: 1, length: 29 });
  assert.deepEqual(value.time, { hour: 0, minute: 0, second: 0 });
  assert.equal(createCalendarJson(value, 0).source.isoUtc, '1970-01-01T00:00:00.000Z');
});

test('fictional seconds change at exactly 997 real milliseconds', () => {
  assert.equal(calculateFictionalCalendar(996).time.second, 0);
  assert.equal(calculateFictionalCalendar(997).time.second, 1);
});

test('minute, hour, and day boundaries use their fictional units', () => {
  assert.deepEqual(calculateFictionalCalendar(timestampForFictionalSeconds(59)).time, { hour: 0, minute: 1, second: 0 });
  assert.deepEqual(calculateFictionalCalendar(timestampForFictionalSeconds(FICTIONAL_SECONDS_PER_HOUR)).time, { hour: 1, minute: 0, second: 0 });
  const day = calculateFictionalCalendar(timestampForFictionalSeconds(FICTIONAL_SECONDS_PER_DAY));
  assert.deepEqual(day.period, { type: 'month', month: 1, day: 2, length: 29 });
  assert.deepEqual(day.time, { hour: 0, minute: 0, second: 0 });
});

test('Month 1 ends and the first Inter Regnum has exactly three days', () => {
  assert.deepEqual(calculateFictionalCalendar(timestampForDayIndex(28)).period, { type: 'month', month: 1, day: 29, length: 29 });
  assert.deepEqual(calculateFictionalCalendar(timestampForDayIndex(29)).period, { type: 'inter_regnum', fromMonth: 1, toMonth: 2, day: 1, length: 3 });
  assert.deepEqual(calculateFictionalCalendar(timestampForDayIndex(31)).period, { type: 'inter_regnum', fromMonth: 1, toMonth: 2, day: 3, length: 3 });
  assert.deepEqual(calculateFictionalCalendar(timestampForDayIndex(32)).period, { type: 'month', month: 2, day: 1, length: 29 });
});

test('Month 11 and the four-day final Inter Regnum have exact boundaries', () => {
  assert.deepEqual(calculateFictionalCalendar(timestampForDayIndex(320)).period, { type: 'month', month: 11, day: 1, length: 29 });
  assert.deepEqual(calculateFictionalCalendar(timestampForDayIndex(348)).period, { type: 'month', month: 11, day: 29, length: 29 });
  assert.deepEqual(calculateFictionalCalendar(timestampForDayIndex(349)).period, { type: 'inter_regnum', fromMonth: 11, toMonth: 1, day: 1, length: 4 });
  assert.deepEqual(calculateFictionalCalendar(timestampForDayIndex(352)).period, { type: 'inter_regnum', fromMonth: 11, toMonth: 1, day: 4, length: 4 });
});

test('the new year starts after all 353 days', () => {
  const value = calculateFictionalCalendar(timestampForDayIndex(DAYS_PER_YEAR));
  assert.equal(value.year, 2);
  assert.deepEqual(value.period, { type: 'month', month: 1, day: 1, length: 29 });
});

test('weekday continuity is based on total elapsed days', () => {
  assert.equal(calculateFictionalCalendar(timestampForDayIndex(29)).dayOfWeek, 2);
  assert.equal(calculateFictionalCalendar(timestampForDayIndex(DAYS_PER_YEAR)).dayOfWeek, 4);
  assert.equal(calculateFictionalCalendar(timestampForDayIndex(DAYS_PER_YEAR + 1)).dayOfWeek, 5);
});

test('invalid timestamps are rejected', () => {
  for (const invalidValue of [NaN, Infinity, '0', -1]) {
    assert.throws(() => calculateFictionalCalendar(invalidValue), /realUnixMilliseconds/);
  }
});
