import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  calculateAbsoluteMonthStartDay,
  calculateCalendarState,
  calculateCelestialBodyStates,
  calculateMonthRulerDecisionSnapshot,
  calculateMonthRulershipState,
  calculateOrbitalState,
  calculateSeasonState,
  resolveNextMonthRulership,
  selectAlternatingSkipReplacement,
  selectNextSeasonOneFallbackRuler
} from '../public/core/mechanics.js';
import * as rules from '../public/core/rules.js';

const BODY_IDS = rules.CELESTIAL_BODY_RULES.map(({ id }) => id);

function initialMachineState() {
  return {
    nextRotationIndexBySeason: { 'season-01': 1, 'season-02': 0 },
    alternatingSkipOpportunityCount: 1,
    lastEffectiveSeasonOneRulerId: 'ruler-08'
  };
}

function syntheticBodyStates(progressById = {}) {
  return BODY_IDS.map((id) => ({ id, progressFraction: progressById[id] ?? 0.5 }));
}

function syntheticDecision(seasonId, progressById = {}) {
  const bodyStates = syntheticBodyStates(progressById);
  const progressByBodyId = new Map(bodyStates.map(({ id, progressFraction }) => [id, progressFraction]));
  return {
    type: 'interregno_final_hour',
    realUnixMilliseconds: 0,
    calendarDayIndex: 0,
    calendarHour: 22,
    totalCalendarSeconds: 0,
    totalLunarSeconds: 0,
    seasonId,
    bodyProgress: bodyStates.map(({ id, progressFraction }) => ({ bodyId: id, progressFraction })),
    qualifyingBodyIds: rules.ALTERNATING_SKIP_REPLACEMENT_RULES
      .filter(({ bodyId }) => progressByBodyId.get(bodyId) >= rules.ALTERNATING_SKIP_ORBITAL_THRESHOLD)
      .map(({ bodyId }) => bodyId)
  };
}

function resolve(machineState, seasonId, progressById = {}) {
  return resolveNextMonthRulership(machineState, syntheticDecision(seasonId, progressById));
}

test('absolute month start days follow the unchanged calendar structure', () => {
  for (const [absoluteMonthIndex, dayIndex] of [[0, 0], [1, 32], [10, 320], [11, 353]]) {
    assert.equal(calculateAbsoluteMonthStartDay(absoluteMonthIndex), dayIndex);
  }
  assert.throws(() => calculateAbsoluteMonthStartDay('1'), TypeError);
  for (const value of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => calculateAbsoluteMonthStartDay(value), RangeError);
  }
});

test('the first post-epoch decision is the final hour of the preceding Interregno', () => {
  const snapshot = calculateMonthRulerDecisionSnapshot(1);
  const stateAtDecision = calculateCalendarState(snapshot.realUnixMilliseconds);
  let remaining = snapshot.totalCalendarSeconds;
  const second = remaining % rules.FICTIONAL_SECONDS_PER_MINUTE;
  remaining = Math.floor(remaining / rules.FICTIONAL_SECONDS_PER_MINUTE);
  const minute = remaining % rules.FICTIONAL_MINUTES_PER_HOUR;
  remaining = Math.floor(remaining / rules.FICTIONAL_MINUTES_PER_HOUR);
  const hour = remaining % rules.FICTIONAL_HOURS_PER_DAY;

  assert.equal(snapshot.calendarDayIndex, 31);
  assert.equal(snapshot.calendarHour, 22);
  assert.deepEqual({ hour, minute, second }, { hour: 22, minute: 0, second: 0 });
  assert.equal(stateAtDecision.calendar.period.type, 'inter_regnum');
  assert.equal(stateAtDecision.calendar.period.interRegnumId, 'interregnum-01');
  assert.equal(stateAtDecision.calendar.period.day, 3);
  assert.equal(stateAtDecision.calendar.period.length, 3);
  assert.equal(snapshot.seasonId, calculateSeasonState(31).id);
  assert.deepEqual(snapshot.bodyProgress.map(({ bodyId }) => bodyId), BODY_IDS);
  assert.equal(
    snapshot.totalLunarSeconds,
    Math.floor(snapshot.realUnixMilliseconds / rules.REAL_MS_PER_LUNAR_SECOND)
  );
  assert.throws(() => calculateMonthRulerDecisionSnapshot(0), RangeError);
});

test('celestial body helper preserves the orbital body calculations without Pulls', () => {
  const totalCalendarSeconds = 1234567;
  const totalLunarSeconds = 987654;
  const bodies = calculateCelestialBodyStates(totalCalendarSeconds, totalLunarSeconds);
  assert.deepEqual(bodies, calculateOrbitalState(totalCalendarSeconds, totalLunarSeconds).bodies);
  assert.deepEqual(bodies.map(({ id }) => id), BODY_IDS);
  assert.throws(() => calculateCelestialBodyStates(-1, 0), RangeError);
  assert.throws(() => calculateCelestialBodyStates(0, '0'), TypeError);
});

test('the epoch month consumes the first season-01 opportunity', () => {
  const epoch = calculateMonthRulershipState(0, 0);
  assert.equal(epoch.opportunityRulerId, 'ruler-08');
  assert.equal(epoch.regularRulerId, 'ruler-08');
  assert.equal(epoch.effectiveRulerId, 'ruler-08');
  assert.equal(epoch.rotationSeasonId, 'season-01');
  assert.equal(epoch.source, 'epoch_default');
  assert.equal(epoch.alternatingSkipOpportunityNumber, 1);
  assert.equal(epoch.reignNumber, 1);
  const firstPostEpoch = resolve(initialMachineState(), 'season-01');
  assert.equal(firstPostEpoch.rulership.opportunityRulerId, 'ruler-06');
  assert.equal(firstPostEpoch.nextMachineState.nextRotationIndexBySeason['season-01'], 2);
});

test('the two seasonal rotations advance independently and resume their cursors', () => {
  let machineState = initialMachineState();
  const observed = [];
  for (const seasonId of ['season-01', 'season-02', 'season-01', 'season-02']) {
    const result = resolve(machineState, seasonId);
    machineState = result.nextMachineState;
    observed.push(result.rulership.opportunityRulerId);
  }
  assert.deepEqual(observed, ['ruler-06', 'ruler-02', 'ruler-07', 'ruler-03']);
  assert.deepEqual(machineState.nextRotationIndexBySeason, { 'season-01': 3, 'season-02': 2 });
});

test('alternating skip opportunities ignore intervening season-02 decisions', () => {
  let machineState = initialMachineState();
  const observed = [{ number: 1, skipped: false }];
  for (let cycle = 0; cycle < 3; cycle += 1) {
    for (let step = 0; step < 3; step += 1) {
      machineState = resolve(machineState, 'season-01').nextMachineState;
    }
    const beforeOtherSeason = machineState.alternatingSkipOpportunityCount;
    machineState = resolve(machineState, 'season-02').nextMachineState;
    machineState = resolve(machineState, 'season-02').nextMachineState;
    assert.equal(machineState.alternatingSkipOpportunityCount, beforeOtherSeason);
    const alternating = resolve(machineState, 'season-01');
    machineState = alternating.nextMachineState;
    observed.push({
      number: alternating.rulership.alternatingSkipOpportunityNumber,
      skipped: alternating.rulership.skippedRegularTurn
    });
  }
  assert.deepEqual(observed, [
    { number: 1, skipped: false },
    { number: 2, skipped: true },
    { number: 3, skipped: false },
    { number: 4, skipped: true }
  ]);
});

test('every single qualifying body maps inclusively to its configured replacement', () => {
  for (const { bodyId, rulerId } of rules.ALTERNATING_SKIP_REPLACEMENT_RULES) {
    const result = selectAlternatingSkipReplacement(
      syntheticBodyStates({ [bodyId]: 0.95 }),
      'ruler-08'
    );
    assert.deepEqual(result, {
      rulerId,
      method: 'single_qualifying_body',
      selectedBodyId: bodyId,
      qualifyingBodyIds: [bodyId],
      fallbackReason: null
    });
  }
  const below = selectAlternatingSkipReplacement(
    syntheticBodyStates({ 'body-03': 0.949999999 }),
    'ruler-08'
  );
  assert.equal(below.selectedBodyId, null);
  assert.equal(below.fallbackReason, 'no_qualifying_body');
});

test('multiple unequal qualifiers are a tie and never select the highest progress', () => {
  const result = selectAlternatingSkipReplacement(
    syntheticBodyStates({ 'body-03': 0.99, 'body-01': 0.951 }),
    'ruler-06'
  );
  assert.deepEqual(result, {
    rulerId: 'ruler-07',
    method: 'season_rotation_fallback',
    selectedBodyId: null,
    qualifyingBodyIds: ['body-03', 'body-01'],
    fallbackReason: 'multiple_qualifying_bodies'
  });
});

test('zero qualifiers use the dynamic next-season-01 fallback', () => {
  for (const [lastRulerId, fallbackRulerId] of [
    ['ruler-08', 'ruler-06'],
    ['ruler-06', 'ruler-07'],
    ['ruler-07', 'ruler-01'],
    ['ruler-01', 'ruler-06']
  ]) {
    assert.equal(selectNextSeasonOneFallbackRuler(lastRulerId), fallbackRulerId);
    const replacement = selectAlternatingSkipReplacement(syntheticBodyStates(), lastRulerId);
    assert.equal(replacement.rulerId, fallbackRulerId);
    assert.equal(replacement.selectedBodyId, null);
    assert.deepEqual(replacement.qualifyingBodyIds, []);
    assert.equal(replacement.fallbackReason, 'no_qualifying_body');
  }
  assert.throws(() => selectNextSeasonOneFallbackRuler('ruler-02'), RangeError);
});

test('a celestial replacement consumes only the declined opportunity', () => {
  let machineState = initialMachineState();
  for (let step = 0; step < 3; step += 1) {
    machineState = resolve(machineState, 'season-01').nextMachineState;
  }
  const declined = resolve(machineState, 'season-01', { 'body-03': 0.95 });
  assert.equal(declined.rulership.opportunityRulerId, 'ruler-08');
  assert.equal(declined.rulership.regularRulerId, 'ruler-02');
  assert.equal(declined.rulership.skippedRegularTurn, true);
  assert.equal(declined.rulership.alternatingSkipOpportunityNumber, 2);
  assert.equal(declined.nextMachineState.nextRotationIndexBySeason['season-01'], 1);
  assert.equal(declined.nextMachineState.nextRotationIndexBySeason['season-02'], 0);

  const nextSeasonOne = resolve(declined.nextMachineState, 'season-01');
  assert.equal(nextSeasonOne.rulership.regularRulerId, 'ruler-06');
  const nextSeasonTwo = resolve(nextSeasonOne.nextMachineState, 'season-02');
  assert.equal(nextSeasonTwo.rulership.regularRulerId, 'ruler-02');
});

test('real first-year decisions produce the required effective sequence and ordinals', () => {
  const rulerships = Array.from({ length: rules.MONTHS_PER_YEAR }, (_unused, index) => (
    calculateMonthRulershipState(0, index)
  ));
  assert.deepEqual(rulerships.map(({ effectiveRulerId }) => effectiveRulerId), [
    'ruler-08', 'ruler-06', 'ruler-07', 'ruler-01', 'ruler-06', 'ruler-06',
    'ruler-02', 'ruler-03', 'ruler-04', 'ruler-05', 'ruler-02'
  ]);
  assert.equal(rulerships[4].opportunityRulerId, 'ruler-08');
  assert.equal(rulerships[4].skippedRegularTurn, true);
  assert.equal(rulerships[4].source, 'alternating_skip_fallback');
  assert.equal(rulerships[4].replacement.fallbackReason, 'no_qualifying_body');
  assert.equal(rulerships[4].reignNumber, 2);
  assert.equal(rulerships[4].ordinalId, 'reign-ordinal-02');
  assert.equal(rulerships[5].opportunityRulerId, 'ruler-06');
  assert.equal(rulerships[5].reignNumber, 3);
  assert.equal(rulerships[5].ordinalId, 'reign-ordinal-03');
});

test('a selected month remains fixed across an in-month season change', () => {
  const monthStartDay = calculateAbsoluteMonthStartDay(5);
  const firstSecond = monthStartDay * rules.FICTIONAL_SECONDS_PER_DAY * rules.REAL_MS_PER_FICTIONAL_SECOND;
  const finalSecond = ((monthStartDay + rules.DAYS_PER_MONTH) * rules.FICTIONAL_SECONDS_PER_DAY
    * rules.REAL_MS_PER_FICTIONAL_SECOND) - 1;
  const first = calculateCalendarState(firstSecond);
  const final = calculateCalendarState(finalSecond);
  assert.equal(first.calendar.period.monthId, 'month-06');
  assert.equal(final.calendar.period.monthId, 'month-06');
  assert.equal(first.season.id, 'season-01');
  assert.equal(final.season.id, 'season-02');
  assert.deepEqual(first.calendar.period.rulership, final.calendar.period.rulership);
  assert.equal(first.calendar.period.rulership.rotationSeasonId, 'season-01');
  assert.equal(first.calendar.period.rulership.effectiveRulerId, 'ruler-06');
});

test('yearly reign counts include replacements and reset at the new year', () => {
  for (const zeroBasedYear of [0, 1, 17, 61]) {
    const counts = new Map();
    for (let month = 0; month < rules.MONTHS_PER_YEAR; month += 1) {
      const rulership = calculateMonthRulershipState(zeroBasedYear, month);
      const expected = (counts.get(rulership.effectiveRulerId) ?? 0) + 1;
      counts.set(rulership.effectiveRulerId, expected);
      assert.equal(rulership.reignNumber, expected, `year ${zeroBasedYear} month ${month}`);
      assert.equal(rulership.ordinalId, rules.REIGN_ORDINAL_IDS[expected - 1]);
    }
  }
  assert.equal(calculateMonthRulershipState(0, 4).reignNumber, 2);
  assert.equal(calculateMonthRulershipState(0, 5).reignNumber, 3);
  assert.equal(calculateMonthRulershipState(1, 0).reignNumber, 1);
});

test('raw month rulership is neutral and contains the complete decision seam', () => {
  const rulership = calculateMonthRulershipState(0, 4);
  for (const key of [
    'rotationSeasonId', 'opportunityRulerId', 'regularRulerId', 'effectiveRulerId',
    'decision', 'replacement', 'reignNumber', 'ordinalId'
  ]) assert.ok(Object.hasOwn(rulership, key), key);
  assert.equal(rulership.decision.bodyProgress.length, 6);
  assert.equal(rulership.replacement.applied, true);
  assert.doesNotMatch(
    JSON.stringify(rulership),
    /"(?:Ossos|Lacrimas|Pigritia|Vanitate|Luxuria|Orgolio|Rabia|Gula|Invidia|Avaritia|Mars|Mercurius|Jupiter|Venus|Saturnus|Luna)"|formatted/
  );
});

test('the fixed supercycle implementation and description are removed', async () => {
  const rulesSource = await readFile(new URL('../public/core/rules.js', import.meta.url), 'utf8');
  const mechanicsSource = await readFile(new URL('../public/core/mechanics.js', import.meta.url), 'utf8');
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  for (const source of [rulesSource, mechanicsSource]) {
    assert.doesNotMatch(source, /MONTH_RULER_SUPERCYCLE_IDS|calculateRegularMonthRulership|source: 'base_rotation'/);
  }
  assert.doesNotMatch(readme, /15-month|global fixed rotation|repeating fifteen-month/i);
});
