import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateAbsoluteMonthStartDay,
  calculateCalendarState,
  calculateMonthRulershipState,
  calculateOutcomeType,
  resolveNamedDayId
} from '../public/core/mechanics.js';
import { formatRomanNumeral } from '../public/core/formatting.js';
import * as rules from '../public/core/rules.js';

const dayMs = rules.FICTIONAL_SECONDS_PER_DAY * rules.REAL_MS_PER_FICTIONAL_SECOND;
const atDay = (index) => index * dayMs;

test('Roman numeral formatter uses uppercase standard subtractive notation', () => {
  for (const [value, expected] of [
    [1, 'I'], [4, 'IV'], [9, 'IX'], [19, 'XIX'], [29, 'XXIX'], [40, 'XL'],
    [62, 'LXII'], [90, 'XC'], [400, 'CD'], [900, 'CM'], [3999, 'MMMCMXCIX']
  ]) assert.equal(formatRomanNumeral(value), expected);
});

test('Roman numeral formatter rejects unsupported inputs', () => {
  for (const value of ['1', null, undefined]) assert.throws(() => formatRomanNumeral(value), TypeError);
  for (const value of [0, -1, 1.5, NaN, Infinity, -Infinity, 4000]) {
    assert.throws(() => formatRomanNumeral(value), RangeError);
  }
});

test('epoch is the first day of the first calendar slot at 00:00:00', () => {
  const state = calculateCalendarState(0);
  assert.equal(state.totalSeconds, 0);
  assert.deepEqual(state.calendar.time, { hour: 0, minute: 0, second: 0 });
  assert.deepEqual(state.calendar.period, {
    type: 'month', monthId: 'month-01', monthIndex: 1, day: 1,
    namedDayId: 'named-day-01', length: 29,
    rulership: {
      opportunityRulerId: 'ruler-08', regularRulerId: 'ruler-08', effectiveRulerId: 'ruler-08',
      rotationSeasonId: 'season-01', source: 'epoch_default', skippedRegularTurn: false,
      alternatingSkipOpportunityNumber: 1, reignNumber: 1, ordinalId: 'reign-ordinal-01',
      decision: {
        type: 'epoch_default', realUnixMilliseconds: 0, calendarDayIndex: 0, calendarHour: 0,
        totalCalendarSeconds: 0, totalLunarSeconds: 0, bodyProgress: [], qualifyingBodyIds: []
      },
      replacement: { applied: false, method: null, selectedBodyId: null, fallbackReason: null }
    }
  });
  assert.equal(state.calendar.year, 1);
  assert.equal(state.lunar.tide.id, 'tide-01');
  assert.deepEqual(state.progress.tide, { fraction: 0, percentage: 0 });
  assert.equal(state.outcome.outcomeTypeId, 'outcome-tier-01');
  assert.equal(state.outcome.attemptsUntilRare, 100);
  assert.equal(state.outcome.tideProgressFraction, 0);
  assert.equal(state.outcome.tideProgressPercentage, 0);
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

test('weekday is continuous at month, Interregno, and year boundaries', () => {
  for (const index of [29, 32, 353]) {
    const before = calculateCalendarState(atDay(index - 1)).calendar.dayOfWeek;
    const after = calculateCalendarState(atDay(index)).calendar.dayOfWeek;
    assert.equal(after, before % 7 + 1);
  }
});

test('named-day resolver uses exact neutral rules and validates its inputs', () => {
  for (const [periodType, day, expected] of [
    ['month', 1, 'named-day-01'],
    ['month', 7, 'named-day-02'],
    ['month', 15, 'named-day-03'],
    ['month', 23, 'named-day-04'],
    ['month', 19, null],
    ['inter_regnum', 1, 'named-day-05'],
    ['inter_regnum', 2, null]
  ]) assert.equal(resolveNamedDayId(periodType, day), expected);

  for (const periodType of [null, undefined, 1]) {
    assert.throws(() => resolveNamedDayId(periodType, 1), TypeError);
  }
  for (const periodType of ['', 'interregno', 'other']) {
    assert.throws(() => resolveNamedDayId(periodType, 1), RangeError);
  }
  assert.throws(() => resolveNamedDayId('month', '1'), TypeError);
  for (const day of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => resolveNamedDayId('month', day), RangeError);
  }
});

test('every month receives the four named days and ordinary days remain unnamed', () => {
  const expectedNamedDays = new Map([
    [1, 'named-day-01'],
    [7, 'named-day-02'],
    [15, 'named-day-03'],
    [23, 'named-day-04']
  ]);
  for (let monthIndex = 0; monthIndex < rules.MONTHS_PER_YEAR; monthIndex += 1) {
    const monthStartDay = calculateAbsoluteMonthStartDay(monthIndex);
    for (const [day, namedDayId] of expectedNamedDays) {
      const period = calculateCalendarState(atDay(monthStartDay + day - 1)).calendar.period;
      assert.equal(period.monthId, rules.MONTH_IDS[monthIndex], `month ${monthIndex + 1}, day ${day}`);
      assert.equal(period.day, day, `month ${monthIndex + 1}, day ${day}`);
      assert.equal(period.namedDayId, namedDayId, `month ${monthIndex + 1}, day ${day}`);
    }
    assert.equal(
      calculateCalendarState(atDay(monthStartDay + 18)).calendar.period.namedDayId,
      null,
      `month ${monthIndex + 1}, day 19`
    );
  }

  const laterYearPeriod = calculateCalendarState(
    atDay(calculateAbsoluteMonthStartDay(rules.MONTHS_PER_YEAR) + 14)
  ).calendar.period;
  assert.equal(laterYearPeriod.day, 15);
  assert.equal(laterYearPeriod.namedDayId, 'named-day-03');
});

test('every Interregno receives Interregis only on day one', () => {
  for (let index = 0; index < rules.MONTHS_PER_YEAR; index += 1) {
    const interRegnumStartDay = calculateAbsoluteMonthStartDay(index) + rules.DAYS_PER_MONTH;
    const length = rules.INTER_REGNUM_LENGTHS[index];
    for (let day = 1; day <= length; day += 1) {
      const period = calculateCalendarState(atDay(interRegnumStartDay + day - 1)).calendar.period;
      assert.equal(period.interRegnumId, rules.INTER_REGNUM_IDS[index]);
      assert.equal(period.day, day);
      assert.equal(period.namedDayId, day === 1 ? 'named-day-05' : null);
    }
  }
  assert.equal(calculateCalendarState(atDay(352)).calendar.period.namedDayId, null);
});

test('Interregnos neither contain rulership nor advance the regular rotation', () => {
  const monthOne = calculateCalendarState(atDay(28)).calendar.period;
  const interRegnum = calculateCalendarState(atDay(29)).calendar.period;
  const monthTwo = calculateCalendarState(atDay(32)).calendar.period;
  assert.equal(monthOne.rulership.effectiveRulerId, 'ruler-08');
  assert.equal(Object.hasOwn(interRegnum, 'rulership'), false);
  assert.equal(monthTwo.rulership.effectiveRulerId, 'ruler-06');
});

test('month-rulership inputs are validated', () => {
  for (const args of [[-1, 0], [0, -1], [0, 11], [0, 1.5], [NaN, 0], [Infinity, 0], [Number.MAX_SAFE_INTEGER, 0]]) {
    assert.throws(() => calculateMonthRulershipState(...args), RangeError);
  }
  assert.throws(() => calculateMonthRulershipState('0', 0), TypeError);
  assert.throws(() => calculateMonthRulershipState(0, '0'), TypeError);
});

test('invalid inputs are rejected', () => {
  for (const value of [NaN, Infinity]) assert.throws(() => calculateCalendarState(value), RangeError);
  for (const value of ['0', null]) assert.throws(() => calculateCalendarState(value), TypeError);
  assert.throws(() => calculateCalendarState(-1), RangeError);
});

test('raw state contains IDs and mechanics but no presentation fields', () => {
  const state = calculateCalendarState(atDay(352));
  const raw = JSON.stringify(state);
  assert.equal(state.calendar.weekdayId, 'weekday-03');
  assert.doesNotMatch(raw, /"(?:name|shortName|symbol|formatted)"/);
  assert.doesNotMatch(raw, /Dies (?:Lunae|Martis|Mercurii|Iovis|Veneris|Saturni|Solis)/);
  for (const id of ['month-', 'weekday-', 'season-', 'phase-', 'tide-', 'body-', 'pull-', 'outcome-tier-']) assert.match(raw, new RegExp(id));
  const namedState = calculateCalendarState(0);
  assert.equal(namedState.calendar.period.namedDayId, 'named-day-01');
  assert.match(JSON.stringify(namedState), /named-day-01/);
});

test('the exact mechanical constants remain stable', () => {
  assert.equal(rules.DAYS_PER_YEAR, 353);
  assert.deepEqual(rules.INTER_REGNUM_LENGTHS, [3,3,3,3,3,3,3,3,3,3,4]);
  assert.equal(rules.CELESTIAL_BODY_RULES.length, 6);
  assert.equal(rules.LUNAR_PHASE_RULES.length, 13);
  assert.deepEqual(rules.MONTH_RULER_IDS, ['ruler-01','ruler-02','ruler-03','ruler-04','ruler-05','ruler-06','ruler-07','ruler-08']);
  assert.equal(rules.ALTERNATING_SKIP_RULER_ID, 'ruler-08');
  assert.equal(Object.hasOwn(rules, 'MONTH_RULER_SUPERCYCLE_IDS'), false);
  assert.equal(rules.MONTH_RULER_DECISION_HOUR, 22);
  assert.equal(rules.ALTERNATING_SKIP_ORBITAL_THRESHOLD, 0.95);
  assert.deepEqual(rules.SEASON_MONTH_RULER_ROTATIONS, {
    'season-01': ['ruler-08','ruler-06','ruler-07','ruler-01'],
    'season-02': ['ruler-02','ruler-03','ruler-04','ruler-05']
  });
  assert.equal(Object.isFrozen(rules.SEASON_MONTH_RULER_ROTATIONS), true);
  assert.equal(Object.isFrozen(rules.SEASON_MONTH_RULER_ROTATIONS['season-01']), true);
  assert.equal(Object.isFrozen(rules.SEASON_MONTH_RULER_ROTATIONS['season-02']), true);
  assert.deepEqual(rules.ALTERNATING_SKIP_REPLACEMENT_RULES, [
    { bodyId: 'body-03', rulerId: 'ruler-02' },
    { bodyId: 'body-01', rulerId: 'ruler-05' },
    { bodyId: 'body-04', rulerId: 'ruler-03' },
    { bodyId: 'body-02', rulerId: 'ruler-04' },
    { bodyId: 'body-05', rulerId: 'ruler-01' },
    { bodyId: 'body-06', rulerId: 'ruler-06' }
  ]);
  assert.equal(rules.ALTERNATING_SKIP_REPLACEMENT_RULES.every(Object.isFrozen), true);
  assert.equal(rules.REIGN_ORDINAL_IDS.length, 11);
  assert.deepEqual(rules.NAMED_DAY_IDS, [
    'named-day-01', 'named-day-02', 'named-day-03', 'named-day-04', 'named-day-05'
  ]);
  assert.deepEqual(rules.CALENDAR_NAMED_DAY_RULES, {
    month: [
      { day: 1, namedDayId: 'named-day-01' },
      { day: 7, namedDayId: 'named-day-02' },
      { day: 15, namedDayId: 'named-day-03' },
      { day: 23, namedDayId: 'named-day-04' }
    ],
    inter_regnum: [{ day: 1, namedDayId: 'named-day-05' }]
  });
  assert.equal(Object.isFrozen(rules.NAMED_DAY_IDS), true);
  assert.equal(Object.isFrozen(rules.CALENDAR_NAMED_DAY_RULES), true);
  assert.equal(Object.isFrozen(rules.CALENDAR_NAMED_DAY_RULES.month), true);
  assert.equal(Object.isFrozen(rules.CALENDAR_NAMED_DAY_RULES.inter_regnum), true);
  assert.equal(rules.CALENDAR_NAMED_DAY_RULES.month.every(Object.isFrozen), true);
  assert.equal(rules.CALENDAR_NAMED_DAY_RULES.inter_regnum.every(Object.isFrozen), true);
});

test('Outcome thresholds use tide progress and retain their exact neutral IDs', () => {
  assert.equal(calculateOutcomeType(0.85).id, 'outcome-tier-01');
  assert.equal(calculateOutcomeType(0.850001).id, 'outcome-tier-02');
  assert.equal(calculateOutcomeType(0.99).id, 'outcome-tier-02');
  assert.equal(calculateOutcomeType(0.990001).id, 'outcome-tier-03');

  const outcomeType = calculateOutcomeType(0.5);
  assert.deepEqual(outcomeType, {
    id: 'outcome-tier-01',
    tideProgressFraction: 0.5,
    tideProgressPercentage: 50,
    attemptsUntilRare: 50
  });
  assert.equal(Object.hasOwn(outcomeType, 'hourProgressFraction'), false);
  assert.equal(Object.hasOwn(outcomeType, 'hourProgressPercentage'), false);
});

test('Attempts until Rare are derived from tide progress at every required edge', () => {
  for (const [tideProgressFraction, attemptsUntilRare] of [
    [0, 100], [0.5, 50], [0.85, 15], [0.851, 14],
    [0.98, 2], [0.982, 1], [0.99, 1], [0.990001, 0]
  ]) {
    assert.equal(calculateOutcomeType(tideProgressFraction).attemptsUntilRare, attemptsUntilRare, tideProgressFraction);
  }
  assert.throws(() => calculateOutcomeType('0.5'), /tideProgressFraction must be a number/);
  for (const value of [NaN, Infinity, -0.001, 1]) {
    assert.throws(() => calculateOutcomeType(value), /tideProgressFraction/);
  }
});

test('raw Outcome state contains neutral IDs and no localized names', () => {
  const outcome = calculateCalendarState(0).outcome;
  assert.equal(outcome.outcomeTypeId, 'outcome-tier-01');
  const stringValues = [];
  JSON.stringify(outcome, (_key, value) => {
    if (typeof value === 'string') stringValues.push(value);
    return value;
  });
  assert.equal(stringValues.some((value) => ['Common','Uncommon','Rare','Común','Poco común','Raro'].includes(value)), false);
  assert.equal(Object.hasOwn(outcome, 'outcomeType'), false);
});
