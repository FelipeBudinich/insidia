import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCalendarState } from '../public/core/mechanics.js';
import * as rules from '../public/core/rules.js';

const dayMs = rules.FICTIONAL_SECONDS_PER_DAY * rules.REAL_MS_PER_FICTIONAL_SECOND;
const atDay = (index) => index * dayMs;

test('epoch is Year 1, Month 1, Day 1 at 00:00:00', () => {
  const state = calculateCalendarState(0);
  assert.equal(state.totalSeconds, 0);
  assert.deepEqual(state.calendar.time, { hour: 0, minute: 0, second: 0 });
  assert.deepEqual(state.calendar.period, { type: 'month', monthId: 'month-01', monthIndex: 1, day: 1, length: 29 });
  assert.equal(state.calendar.year, 1);
});

for (const [label, milliseconds, expected] of [
  ['last millisecond before second 1', 996, { second: 0 }],
  ['first second boundary', 997, { second: 1 }],
  ['minute boundary', 59 * 997, { minute: 1, second: 0 }],
  ['hour boundary', 59 * 61 * 997, { hour: 1, minute: 0, second: 0 }]
]) test(label, () => assert.deepEqual(calculateCalendarState(milliseconds).calendar.time, { hour: expected.hour ?? 0, minute: expected.minute ?? 0, second: expected.second }));

test('day boundary advances the calendar and resets the clock', () => {
  const state = calculateCalendarState(dayMs);
  assert.equal(state.calendar.period.day, 2);
  assert.deepEqual(state.calendar.time, { hour: 0, minute: 0, second: 0 });
});

for (const [index, expected] of [
  [28, ['month', 'month-01', 29, 29]],
  [29, ['inter_regnum', 'interregnum-01', 1, 3]],
  [31, ['inter_regnum', 'interregnum-01', 3, 3]],
  [32, ['month', 'month-02', 1, 29]],
  [320, ['month', 'month-11', 1, 29]],
  [348, ['month', 'month-11', 29, 29]],
  [349, ['inter_regnum', 'interregnum-11', 1, 4]],
  [352, ['inter_regnum', 'interregnum-11', 4, 4]]
]) test(`calendar period boundary at day index ${index}`, () => {
  const period = calculateCalendarState(atDay(index)).calendar.period;
  assert.equal(period.type, expected[0]);
  assert.equal(period.monthId ?? period.interRegnumId, expected[1]);
  assert.equal(period.day, expected[2]);
  assert.equal(period.length, expected[3]);
});

test('new year begins after all 353 days', () => {
  const state = calculateCalendarState(atDay(353));
  assert.equal(state.calendar.year, 2);
  assert.equal(state.calendar.dayOfYear, 1);
  assert.equal(state.calendar.period.monthId, 'month-01');
});

test('weekday is continuous at month, interregnum, and year boundaries', () => {
  for (const index of [29, 32, 353]) {
    const before = calculateCalendarState(atDay(index - 1)).calendar.dayOfWeek;
    const after = calculateCalendarState(atDay(index)).calendar.dayOfWeek;
    assert.equal(after, before % 7 + 1);
  }
});

test('invalid inputs are rejected', () => {
  for (const value of [NaN, Infinity]) assert.throws(() => calculateCalendarState(value), RangeError);
  for (const value of ['0', null]) assert.throws(() => calculateCalendarState(value), TypeError);
  assert.throws(() => calculateCalendarState(-1), RangeError);
});

test('raw state contains IDs and mechanics but no presentation fields', () => {
  const raw = JSON.stringify(calculateCalendarState(atDay(352)));
  assert.doesNotMatch(raw, /"(?:name|symbol|formatted)"/);
  for (const id of ['month-', 'weekday-', 'season-', 'phase-', 'tide-', 'body-', 'pull-', 'outcome-tier-']) assert.match(raw, new RegExp(id));
});

test('the exact mechanical constants remain stable', () => {
  assert.equal(rules.DAYS_PER_YEAR, 353);
  assert.deepEqual(rules.INTER_REGNUM_LENGTHS, [3,3,3,3,3,3,3,3,3,3,4]);
  assert.equal(rules.CELESTIAL_BODY_RULES.length, 6);
  assert.equal(rules.LUNAR_PHASE_RULES.length, 13);
});
