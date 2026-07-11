import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CALENDAR_EPOCH_UNIX_MS,
  CELESTIAL_BODIES,
  FICTIONAL_SECONDS_PER_DAY,
  FICTIONAL_SECONDS_PER_HOUR,
  FICTIONAL_SECONDS_PER_LUNAR_CYCLE,
  FICTIONAL_SECONDS_PER_LUNAR_DAY,
  ORBITAL_SPAN_TIE_EPSILON,
  REAL_MS_PER_FICTIONAL_SECOND,
  calculateCircularSpan,
  calculateDominantPull,
  calculateFictionalCalendar,
  calculateOrbitalState,
  createCalendarJson,
  formatOrbitalPercentage
} from '../public/calendar.js';

function approximatelyEqual(actual, expected, epsilon = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
}

function createSyntheticStates(progressFractions) {
  return CELESTIAL_BODIES.map((body, index) => ({
    ...body,
    progressFraction: progressFractions[index]
  }));
}

function memberIds(dominantPull) {
  return dominantPull.members.map((member) => member.id);
}

test('celestial definitions preserve canonical display and fixed-priority order', () => {
  assert.equal(CELESTIAL_BODIES.length, 6);
  assert.deepEqual(CELESTIAL_BODIES.map((body) => body.id), [
    'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'moon'
  ]);
  const planets = CELESTIAL_BODIES.slice(0, 5);
  const moon = CELESTIAL_BODIES.at(-1);
  assert.deepEqual(planets.map((body) => body.orbitalPeriodDays), [89, 223, 683, 4337, 7919]);
  assert.ok(planets.every((body) => Number.isSafeInteger(body.orbitalPeriodDays) && body.orbitalPeriodDays > 0));
  assert.deepEqual(
    { orbitalPeriodLunarDays: moon.orbitalPeriodLunarDays, tieBreakPriorityRank: moon.tieBreakPriorityRank },
    { orbitalPeriodLunarDays: 13, tieBreakPriorityRank: 1 }
  );
  assert.equal('orbitalPeriodDays' in moon, false);
  assert.equal(new Set(CELESTIAL_BODIES.map((body) => body.id)).size, 6);
  assert.deepEqual(
    [...CELESTIAL_BODIES].sort((first, second) => first.tieBreakPriorityRank - second.tieBreakPriorityRank).map((body) => body.id),
    ['moon', 'venus', 'mars', 'mercury', 'jupiter', 'saturn']
  );
  assert.deepEqual(
    [...CELESTIAL_BODIES].map((body) => body.tieBreakPriorityRank).sort((first, second) => first - second),
    [1, 2, 3, 4, 5, 6]
  );
  assert.equal(moon.tieBreakPriorityRank, 1);
});

test('all bodies begin together in Orbit 1 at zero progress', () => {
  const orbitalState = calculateOrbitalState(0);
  for (const body of orbitalState.bodies) {
    assert.equal(body.completedOrbits, 0);
    assert.equal(body.orbit, 1);
    assert.equal(body.dayOfOrbit, 1);
    assert.equal(body.progressFraction, 0);
    assert.equal(body.progressPercentage, 0);
  }
});

test('orbital progress includes fictional hours rather than jumping by day', () => {
  const orbitalState = calculateOrbitalState(FICTIONAL_SECONDS_PER_HOUR);
  for (const body of orbitalState.bodies) {
    const orbitalPeriodSeconds = body.id === 'moon'
      ? FICTIONAL_SECONDS_PER_LUNAR_CYCLE
      : body.orbitalPeriodDays * FICTIONAL_SECONDS_PER_DAY;
    approximatelyEqual(body.progressFraction, FICTIONAL_SECONDS_PER_HOUR / orbitalPeriodSeconds);
  }
});

test('one fictional calendar day preserves planetary periods while Moon uses lunar time', () => {
  const orbitalState = calculateOrbitalState(FICTIONAL_SECONDS_PER_DAY);
  for (const body of orbitalState.bodies.slice(0, 5)) {
    approximatelyEqual(body.progressFraction, 1 / body.orbitalPeriodDays);
    assert.equal(body.dayOfOrbit, 2);
  }
  const moon = orbitalState.bodies.at(-1);
  approximatelyEqual(moon.progressFraction, FICTIONAL_SECONDS_PER_DAY / FICTIONAL_SECONDS_PER_LUNAR_CYCLE);
  assert.equal(moon.dayOfOrbit, 1);
});

test('every planet independently resets at its unchanged calendar-day orbit boundary', () => {
  for (const definition of CELESTIAL_BODIES.slice(0, 5)) {
    const orbitalPeriodSeconds = definition.orbitalPeriodDays * FICTIONAL_SECONDS_PER_DAY;
    const beforeReset = calculateOrbitalState(orbitalPeriodSeconds - 1).bodies.find((body) => body.id === definition.id);
    const atReset = calculateOrbitalState(orbitalPeriodSeconds).bodies.find((body) => body.id === definition.id);
    assert.equal(beforeReset.orbit, 1);
    assert.equal(beforeReset.dayOfOrbit, definition.orbitalPeriodDays);
    assert.ok(beforeReset.progressFraction < 1);
    assert.equal(atReset.orbit, 2);
    assert.equal(atReset.dayOfOrbit, 1);
    assert.equal(atReset.progressFraction, 0);
  }
});

test('Moon remains in Orbit 1 through Lunar Day 13 and resets with the lunar cycle', () => {
  const beforeReset = calculateOrbitalState(FICTIONAL_SECONDS_PER_LUNAR_CYCLE - 1).bodies.at(-1);
  const atReset = calculateOrbitalState(FICTIONAL_SECONDS_PER_LUNAR_CYCLE).bodies.at(-1);
  assert.equal(beforeReset.id, 'moon');
  assert.equal(beforeReset.orbit, 1);
  assert.equal(beforeReset.dayOfOrbit, 13);
  assert.ok(beforeReset.progressFraction < 1);
  assert.equal(atReset.orbit, 2);
  assert.equal(atReset.dayOfOrbit, 1);
  assert.equal(atReset.progressFraction, 0);
});

test('Moon orbital progress exactly matches lunar-cycle progress', () => {
  for (const totalSeconds of [
    0,
    1,
    FICTIONAL_SECONDS_PER_LUNAR_DAY,
    (7 * FICTIONAL_SECONDS_PER_LUNAR_DAY) + FICTIONAL_SECONDS_PER_HOUR,
    FICTIONAL_SECONDS_PER_LUNAR_CYCLE - 1,
    FICTIONAL_SECONDS_PER_LUNAR_CYCLE
  ]) {
    const value = calculateFictionalCalendar(totalSeconds * REAL_MS_PER_FICTIONAL_SECOND);
    const moon = value.orbits.bodies.find((body) => body.id === 'moon');
    assert.equal(moon.progressFraction, value.progress.lunarCycle.fraction);
    assert.equal(moon.orbit, value.lunar.cycle);
    assert.equal(moon.dayOfOrbit, value.lunar.day);
  }
});

test('orbital percentage formatting truncates safely to six decimals', () => {
  assert.equal(formatOrbitalPercentage(0), '0.000000%');
  assert.equal(formatOrbitalPercentage(0.01), '1.000000%');
  assert.equal(formatOrbitalPercentage(0.5), '50.000000%');
  const mercuryPeriodSeconds = CELESTIAL_BODIES[0].orbitalPeriodDays * FICTIONAL_SECONDS_PER_DAY;
  const finalMercuryFraction = calculateOrbitalState(mercuryPeriodSeconds - 1).bodies[0].progressFraction;
  assert.notEqual(formatOrbitalPercentage(finalMercuryFraction), '100.000000%');
  assert.equal(formatOrbitalPercentage(1), '100.000000%');
});

test('circular span handles non-wrapping, wrapping, and dispersed trios', () => {
  approximatelyEqual(calculateCircularSpan([0, 0.01, 0.02]), 0.02);
  approximatelyEqual(calculateCircularSpan([0.99, 0, 0.01]), 0.02);
  approximatelyEqual(calculateCircularSpan([0.10, 0.27, 0.50]), 0.40);
});

test('circular span rejects invalid input without mutating valid input', () => {
  const values = [0.99, 0, 0.01];
  const originalValues = [...values];
  calculateCircularSpan(values);
  assert.deepEqual(values, originalValues);
  for (const invalidValue of [
    [], [0, 0.1], [0, 0.1, 0.2, 0.3],
    [-0.1, 0, 0.1], [0, 0.1, 1], [0, NaN, 0.1],
    [0, Infinity, 0.1], [0, '0.1', 0.2]
  ]) {
    assert.throws(() => calculateCircularSpan(invalidValue), /progressFractions/);
  }
});

test('epoch Dominant Pull uses fixed priority across all twenty tied trios', () => {
  const dominantPull = calculateOrbitalState(0).dominantPull;
  assert.deepEqual(memberIds(dominantPull), ['moon', 'venus', 'mars']);
  assert.equal(dominantPull.spanFraction, 0);
  assert.equal(dominantPull.spanPercentage, 0);
  assert.equal(dominantPull.alignmentPercentage, 100);
  assert.equal(dominantPull.evaluatedCombinationCount, 20);
  assert.equal(dominantPull.tieBreak.applied, true);
  assert.equal(dominantPull.tieBreak.method, 'fixed_priority');
  assert.equal(dominantPull.tieBreak.tiedCombinationCount, 20);
});

test('Dominant Pull selects the basic closest trio', () => {
  const dominantPull = calculateDominantPull(createSyntheticStates([0, 0.01, 0.02, 0.40, 0.80, 0.60]));
  assert.deepEqual(memberIds(dominantPull), ['venus', 'mars', 'mercury']);
  approximatelyEqual(dominantPull.spanFraction, 0.02);
});

test('Dominant Pull recognizes a trio across circular wrap-around', () => {
  const dominantPull = calculateDominantPull(createSyntheticStates([0.99, 0, 0.01, 0.40, 0.70, 0.50]));
  assert.deepEqual(memberIds(dominantPull), ['venus', 'mars', 'mercury']);
  approximatelyEqual(dominantPull.spanFraction, 0.02);
});

test('Moon-containing trio wins across circular wrap-around when strictly narrowest', () => {
  const dominantPull = calculateDominantPull(createSyntheticStates([0.30, 0, 0.01, 0.50, 0.70, 0.99]));
  assert.deepEqual(memberIds(dominantPull), ['moon', 'venus', 'mars']);
  approximatelyEqual(dominantPull.spanFraction, 0.02);
  assert.equal(dominantPull.tieBreak.applied, false);
});

test('Moon-containing trio wins when its span is strictly smaller', () => {
  const dominantPull = calculateDominantPull(createSyntheticStates([0, 0.20, 0.80, 0.50, 0.501, 0.502]));
  assert.deepEqual(memberIds(dominantPull), ['moon', 'jupiter', 'saturn']);
  approximatelyEqual(dominantPull.spanFraction, 0.002);
  assert.equal(dominantPull.tieBreak.applied, false);
});

test('required five-position example selects 0%, 10%, and 27%', () => {
  const states = createSyntheticStates([0.10, 0.27, 0.50, 0.80, 0, 0.60]);
  const dominantPull = calculateDominantPull(states);
  const positionsById = new Map(states.map((body) => [body.id, body.progressFraction]));
  const winningPositions = memberIds(dominantPull).map((id) => positionsById.get(id)).sort((first, second) => first - second);
  assert.deepEqual(winningPositions, [0, 0.10, 0.27]);
  approximatelyEqual(dominantPull.spanFraction, 0.27);
  assert.notDeepEqual(winningPositions, [0.10, 0.27, 0.50]);
  assert.notDeepEqual(winningPositions, [0, 0.10, 0.80]);
});

test('equal-span tie selects the highest-priority trio including Moon', () => {
  const dominantPull = calculateDominantPull(createSyntheticStates([0, 0, 0, 0, 0, 0]));
  assert.deepEqual(memberIds(dominantPull), ['moon', 'venus', 'mars']);
  assert.equal(dominantPull.tieBreak.applied, true);
  assert.ok(dominantPull.tieBreak.tiedCombinationCount > 1);
});

test('fixed-priority tie-break minimizes the lowest-priority member first', () => {
  const dominantPull = calculateDominantPull(createSyntheticStates([0, 1 / 12, 2 / 12, 0, 1 / 12, 0.60]));
  assert.deepEqual(memberIds(dominantPull), ['venus', 'mercury', 'jupiter']);
  approximatelyEqual(dominantPull.spanFraction, 1 / 12);
  assert.equal(dominantPull.tieBreak.applied, true);
});

test('a strictly smaller lower-priority trio overrides fixed priority', () => {
  const dominantPull = calculateDominantPull(createSyntheticStates([0, 0.20, 0.50, 0.501, 0.502, 0.80]));
  assert.deepEqual(memberIds(dominantPull), ['mars', 'jupiter', 'saturn']);
  approximatelyEqual(dominantPull.spanFraction, 0.002);
  assert.equal(dominantPull.tieBreak.applied, false);
});

test('span differences inside epsilon tie while larger differences do not', () => {
  const withinEpsilon = calculateDominantPull(createSyntheticStates([
    0.40 - (ORBITAL_SPAN_TIE_EPSILON / 2), 0.42, 0.50, 0.58, 0.60, 0.90
  ]));
  assert.deepEqual(memberIds(withinEpsilon), ['venus', 'mars', 'mercury']);
  assert.equal(withinEpsilon.tieBreak.applied, true);

  const outsideEpsilon = calculateDominantPull(createSyntheticStates([
    0.40 - (ORBITAL_SPAN_TIE_EPSILON * 10), 0.42, 0.50, 0.58, 0.60, 0.90
  ]));
  assert.deepEqual(memberIds(outsideEpsilon), ['mars', 'jupiter', 'saturn']);
  assert.equal(outsideEpsilon.tieBreak.applied, false);
});

test('actual one-day Dominant Pull is Mars, Jupiter, and Saturn', () => {
  const orbitalState = calculateOrbitalState(FICTIONAL_SECONDS_PER_DAY);
  assert.deepEqual(memberIds(orbitalState.dominantPull), ['mars', 'jupiter', 'saturn']);
  assert.equal(orbitalState.dominantPull.tieBreak.applied, false);
  for (const body of orbitalState.bodies.slice(0, 5)) {
    approximatelyEqual(body.progressFraction, 1 / body.orbitalPeriodDays);
  }
  approximatelyEqual(
    orbitalState.bodies.at(-1).progressFraction,
    FICTIONAL_SECONDS_PER_DAY / FICTIONAL_SECONDS_PER_LUNAR_CYCLE
  );
});

test('calendar integration uses the same total-second orbital snapshot', () => {
  const realUnixMilliseconds = FICTIONAL_SECONDS_PER_DAY * REAL_MS_PER_FICTIONAL_SECOND;
  const calendarValue = calculateFictionalCalendar(realUnixMilliseconds);
  assert.deepEqual(calendarValue.orbits, calculateOrbitalState(calendarValue.totalSeconds));
});

test('Mercury orbit reset does not reset independent fictional systems', () => {
  const mercuryPeriodSeconds = CELESTIAL_BODIES[0].orbitalPeriodDays * FICTIONAL_SECONDS_PER_DAY;
  const calendarValue = calculateFictionalCalendar(mercuryPeriodSeconds * REAL_MS_PER_FICTIONAL_SECOND);
  assert.equal(calendarValue.orbits.bodies[0].orbit, 2);
  assert.equal(calendarValue.year, 1);
  assert.equal(calendarValue.season.name, 'Bones');
  assert.equal(calendarValue.season.day, 90);
  assert.equal(calendarValue.lunar.time.hour, 1);
  assert.equal(calendarValue.lunar.tide.hour, 2);
});

test('schema v7 preserves existing data and adds the Moon orbital shape', () => {
  const snapshot = createCalendarJson(calculateFictionalCalendar(CALENDAR_EPOCH_UNIX_MS), CALENDAR_EPOCH_UNIX_MS);
  assert.equal(snapshot.calendarVersion, 'v7');
  assert.equal(snapshot.fictional.year, 1);
  assert.equal(snapshot.fictional.period.month, 1);
  assert.equal(snapshot.fictional.time.formatted, '00:00:00');
  assert.equal(snapshot.fictional.season.name, 'Bones');
  assert.equal(snapshot.fictional.lunar.phase.name, 'Rebirth');
  assert.equal(snapshot.fictional.lunar.tide.name, 'Low');
  assert.equal(snapshot.fictional.orbits.bodies.length, 6);
  for (const body of snapshot.fictional.orbits.bodies.slice(0, 5)) {
    assert.deepEqual(Object.keys(body), [
      'id', 'name', 'symbol', 'orbitalPeriodDays', 'tieBreakPriorityRank',
      'orbit', 'dayOfOrbit', 'progressFraction', 'progressPercentage', 'formattedProgress'
    ]);
    assert.equal(body.orbit, 1);
    assert.equal(body.dayOfOrbit, 1);
    assert.equal(body.progressFraction, 0);
    assert.equal(body.progressPercentage, 0);
    assert.equal(body.formattedProgress, '0.000000%');
  }
  const dominantPull = snapshot.fictional.orbits.dominantPull;
  const moon = snapshot.fictional.orbits.bodies.at(-1);
  assert.deepEqual(Object.keys(moon), [
    'id', 'name', 'symbol', 'orbitalPeriodLunarDays', 'tieBreakPriorityRank',
    'orbit', 'dayOfOrbit', 'progressFraction', 'progressPercentage', 'formattedProgress'
  ]);
  assert.equal(moon.orbit, 1);
  assert.equal(moon.dayOfOrbit, 1);
  assert.equal(moon.progressFraction, 0);
  assert.equal(moon.progressPercentage, 0);
  assert.equal(moon.formattedProgress, '0.000000%');
  assert.deepEqual(memberIds(dominantPull), ['moon', 'venus', 'mars']);
  assert.equal(dominantPull.selectionMethod, 'smallest_circular_arc');
  assert.equal(dominantPull.evaluatedCombinationCount, 20);
  assert.equal(dominantPull.spanFraction, 0);
  assert.equal(dominantPull.spanPercentage, 0);
  assert.equal(dominantPull.formattedSpan, '0.000000%');
  assert.equal(dominantPull.alignmentPercentage, 100);
  assert.equal(dominantPull.formattedAlignment, '100.000000%');
  assert.deepEqual(dominantPull.tieBreak, {
    applied: true, method: 'fixed_priority', tiedCombinationCount: 20
  });
  assert.deepEqual(
    { id: moon.id, orbitalPeriodLunarDays: moon.orbitalPeriodLunarDays, tieBreakPriorityRank: moon.tieBreakPriorityRank },
    { id: 'moon', orbitalPeriodLunarDays: 13, tieBreakPriorityRank: 1 }
  );
  assert.equal(snapshot.fictional.progress.hour.fraction, 0);
});

test('invalid orbital inputs are rejected', () => {
  for (const invalidValue of [NaN, Infinity, -1, '0', 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculateOrbitalState(invalidValue), /totalFictionalSeconds/);
  }
});
