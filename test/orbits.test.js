import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CALENDAR_EPOCH_UNIX_MS,
  CELESTIAL_BODIES,
  FICTIONAL_SECONDS_PER_DAY,
  FICTIONAL_SECONDS_PER_HOUR,
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

test('celestial definitions preserve canonical and Earth-proximity order', () => {
  assert.equal(CELESTIAL_BODIES.length, 5);
  assert.deepEqual(CELESTIAL_BODIES.map((body) => body.id), [
    'mercury', 'venus', 'mars', 'jupiter', 'saturn'
  ]);
  assert.deepEqual(CELESTIAL_BODIES.map((body) => body.orbitalPeriodDays), [89, 223, 683, 4337, 7919]);
  assert.equal(new Set(CELESTIAL_BODIES.map((body) => body.id)).size, 5);
  assert.ok(CELESTIAL_BODIES.every((body) => Number.isSafeInteger(body.orbitalPeriodDays) && body.orbitalPeriodDays > 0));
  assert.deepEqual(
    [...CELESTIAL_BODIES].sort((first, second) => first.earthProximityRank - second.earthProximityRank).map((body) => body.id),
    ['venus', 'mars', 'mercury', 'jupiter', 'saturn']
  );
  assert.deepEqual(
    [...CELESTIAL_BODIES].map((body) => body.earthProximityRank).sort((first, second) => first - second),
    [1, 2, 3, 4, 5]
  );
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
    const orbitalPeriodSeconds = body.orbitalPeriodDays * FICTIONAL_SECONDS_PER_DAY;
    approximatelyEqual(body.progressFraction, FICTIONAL_SECONDS_PER_HOUR / orbitalPeriodSeconds);
  }
});

test('one fictional calendar day advances each body by its period fraction', () => {
  const orbitalState = calculateOrbitalState(FICTIONAL_SECONDS_PER_DAY);
  for (const body of orbitalState.bodies) {
    approximatelyEqual(body.progressFraction, 1 / body.orbitalPeriodDays);
    assert.equal(body.dayOfOrbit, 2);
  }
});

test('every body independently resets and increments at its exact orbit boundary', () => {
  for (const definition of CELESTIAL_BODIES) {
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

test('epoch Dominant Pull uses Earth proximity across all ten tied trios', () => {
  const dominantPull = calculateOrbitalState(0).dominantPull;
  assert.deepEqual(memberIds(dominantPull), ['venus', 'mars', 'mercury']);
  assert.equal(dominantPull.spanFraction, 0);
  assert.equal(dominantPull.spanPercentage, 0);
  assert.equal(dominantPull.alignmentPercentage, 100);
  assert.equal(dominantPull.evaluatedCombinationCount, 10);
  assert.equal(dominantPull.tieBreak.applied, true);
  assert.equal(dominantPull.tieBreak.method, 'earth_proximity');
  assert.equal(dominantPull.tieBreak.tiedCombinationCount, 10);
});

test('Dominant Pull selects the basic closest trio', () => {
  const dominantPull = calculateDominantPull(createSyntheticStates([0, 0.01, 0.02, 0.40, 0.80]));
  assert.deepEqual(memberIds(dominantPull), ['venus', 'mars', 'mercury']);
  approximatelyEqual(dominantPull.spanFraction, 0.02);
});

test('Dominant Pull recognizes a trio across circular wrap-around', () => {
  const dominantPull = calculateDominantPull(createSyntheticStates([0.99, 0, 0.01, 0.40, 0.70]));
  assert.deepEqual(memberIds(dominantPull), ['venus', 'mars', 'mercury']);
  approximatelyEqual(dominantPull.spanFraction, 0.02);
});

test('required five-position example selects 0%, 10%, and 27%', () => {
  const states = createSyntheticStates([0.10, 0.27, 0.50, 0.80, 0]);
  const dominantPull = calculateDominantPull(states);
  const positionsById = new Map(states.map((body) => [body.id, body.progressFraction]));
  const winningPositions = memberIds(dominantPull).map((id) => positionsById.get(id)).sort((first, second) => first - second);
  assert.deepEqual(winningPositions, [0, 0.10, 0.27]);
  approximatelyEqual(dominantPull.spanFraction, 0.27);
  assert.notDeepEqual(winningPositions, [0.10, 0.27, 0.50]);
  assert.notDeepEqual(winningPositions, [0, 0.10, 0.80]);
});

test('clustered five-position tie selects Venus, Mars, and Mercury', () => {
  const dominantPull = calculateDominantPull(createSyntheticStates([0, 0.01, 0.02, 0.03, 0.04]));
  assert.deepEqual(memberIds(dominantPull), ['venus', 'mars', 'mercury']);
  assert.equal(dominantPull.tieBreak.applied, true);
  assert.ok(dominantPull.tieBreak.tiedCombinationCount > 1);
});

test('Earth-proximity tie-break minimizes the farthest member first', () => {
  const dominantPull = calculateDominantPull(createSyntheticStates([0, 1 / 12, 2 / 12, 0, 1 / 12]));
  assert.deepEqual(memberIds(dominantPull), ['venus', 'mercury', 'jupiter']);
  approximatelyEqual(dominantPull.spanFraction, 1 / 12);
  assert.equal(dominantPull.tieBreak.applied, true);
});

test('a strictly smaller farther trio overrides Earth proximity', () => {
  const dominantPull = calculateDominantPull(createSyntheticStates([0, 0.20, 0.50, 0.501, 0.502]));
  assert.deepEqual(memberIds(dominantPull), ['mars', 'jupiter', 'saturn']);
  approximatelyEqual(dominantPull.spanFraction, 0.002);
  assert.equal(dominantPull.tieBreak.applied, false);
});

test('span differences inside epsilon tie while larger differences do not', () => {
  const withinEpsilon = calculateDominantPull(createSyntheticStates([
    0.40 - (ORBITAL_SPAN_TIE_EPSILON / 2), 0.42, 0.50, 0.58, 0.60
  ]));
  assert.deepEqual(memberIds(withinEpsilon), ['venus', 'mars', 'mercury']);
  assert.equal(withinEpsilon.tieBreak.applied, true);

  const outsideEpsilon = calculateDominantPull(createSyntheticStates([
    0.40 - (ORBITAL_SPAN_TIE_EPSILON * 10), 0.42, 0.50, 0.58, 0.60
  ]));
  assert.deepEqual(memberIds(outsideEpsilon), ['mars', 'jupiter', 'saturn']);
  assert.equal(outsideEpsilon.tieBreak.applied, false);
});

test('actual one-day Dominant Pull is Mars, Jupiter, and Saturn', () => {
  const orbitalState = calculateOrbitalState(FICTIONAL_SECONDS_PER_DAY);
  assert.deepEqual(memberIds(orbitalState.dominantPull), ['mars', 'jupiter', 'saturn']);
  assert.equal(orbitalState.dominantPull.tieBreak.applied, false);
  for (const body of orbitalState.bodies) {
    approximatelyEqual(body.progressFraction, 1 / body.orbitalPeriodDays);
  }
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

test('schema v5 preserves existing data and the epoch orbital shape', () => {
  const snapshot = createCalendarJson(calculateFictionalCalendar(CALENDAR_EPOCH_UNIX_MS), CALENDAR_EPOCH_UNIX_MS);
  assert.equal(snapshot.calendarVersion, 'v5');
  assert.equal(snapshot.fictional.year, 1);
  assert.equal(snapshot.fictional.period.month, 1);
  assert.equal(snapshot.fictional.time.formatted, '00:00:00');
  assert.equal(snapshot.fictional.season.name, 'Bones');
  assert.equal(snapshot.fictional.lunar.phase.name, 'Rebirth');
  assert.equal(snapshot.fictional.lunar.tide.name, 'Low');
  assert.equal(snapshot.fictional.orbits.bodies.length, 5);
  for (const body of snapshot.fictional.orbits.bodies) {
    assert.deepEqual(Object.keys(body), [
      'id', 'name', 'symbol', 'orbitalPeriodDays', 'earthProximityRank',
      'orbit', 'dayOfOrbit', 'progressFraction', 'progressPercentage', 'formattedProgress'
    ]);
    assert.equal(body.orbit, 1);
    assert.equal(body.dayOfOrbit, 1);
    assert.equal(body.progressFraction, 0);
    assert.equal(body.progressPercentage, 0);
    assert.equal(body.formattedProgress, '0.000000%');
  }
  const dominantPull = snapshot.fictional.orbits.dominantPull;
  assert.deepEqual(memberIds(dominantPull), ['venus', 'mars', 'mercury']);
  assert.equal(dominantPull.selectionMethod, 'smallest_circular_arc');
  assert.equal(dominantPull.evaluatedCombinationCount, 10);
  assert.equal(dominantPull.spanFraction, 0);
  assert.equal(dominantPull.spanPercentage, 0);
  assert.equal(dominantPull.formattedSpan, '0.000000%');
  assert.equal(dominantPull.alignmentPercentage, 100);
  assert.equal(dominantPull.formattedAlignment, '100.000000%');
  assert.deepEqual(dominantPull.tieBreak, {
    applied: true, method: 'earth_proximity', tiedCombinationCount: 10
  });
});

test('invalid orbital inputs are rejected', () => {
  for (const invalidValue of [NaN, Infinity, -1, '0', 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculateOrbitalState(invalidValue), /totalFictionalSeconds/);
  }
});
