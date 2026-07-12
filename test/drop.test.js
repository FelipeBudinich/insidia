import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CALENDAR_EPOCH_UNIX_MS,
  CELESTIAL_BODIES,
  calculateDropReward,
  calculateDropState,
  calculateFictionalCalendar,
  calculateOrbitalState,
  createCalendarJson,
  formatOrbitalPercentage
} from '../public/calendar.js';

test('Drop reward uses the exact raw hour-progress thresholds', () => {
  for (const [percentage, expectedId, expectedName] of [
    [0, 'common', 'Common'],
    [84.999, 'common', 'Common'],
    [85, 'common', 'Common'],
    [85.001, 'uncommon', 'Uncommon'],
    [98.999, 'uncommon', 'Uncommon'],
    [99, 'uncommon', 'Uncommon'],
    [99.001, 'rare', 'Rare']
  ]) {
    const reward = calculateDropReward(percentage / 100);
    assert.equal(reward.id, expectedId, `${percentage}% id`);
    assert.equal(reward.name, expectedName, `${percentage}% name`);
    assert.equal(reward.hourProgressFraction, percentage / 100);
    assert.equal(reward.hourProgressPercentage, percentage);
  }
});

test('attempts until Rare count whole percentage-point attempts needed to exceed 99%', () => {
  for (const [percentage, expectedAttempts] of [
    [0, 100], [50, 50], [85, 15], [85.1, 14],
    [98, 2], [98.2, 1], [99, 1], [99.1, 0]
  ]) {
    assert.equal(
      calculateDropReward(percentage / 100).attemptsUntilRare,
      expectedAttempts,
      `${percentage}%`
    );
  }
});

test('Drop reward compares raw progress rather than its six-decimal display', () => {
  const exactBoundary = 0.85;
  const justAboveBoundary = 0.850000000001;
  assert.equal(
    formatOrbitalPercentage(exactBoundary),
    formatOrbitalPercentage(justAboveBoundary)
  );
  assert.equal(calculateDropReward(exactBoundary).id, 'common');
  assert.equal(calculateDropReward(justAboveBoundary).id, 'uncommon');
});

test('Drop reward rejects fractions outside the finite half-open unit interval', () => {
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -0.001, 1]) {
    assert.throws(() => calculateDropReward(invalid), /hourProgressFraction/);
  }
  assert.throws(() => calculateDropReward('0.5'), /hourProgressFraction must be a number/);
});

const TIDES = Object.freeze({
  high: { id: 'high', name: 'High' },
  low: { id: 'low', name: 'Low' },
  parted: { id: 'parted', name: 'Parted' }
});

function createDropFixture(pullKey, trioIds, progressById) {
  const orbitalState = calculateOrbitalState(0);
  orbitalState.bodies = orbitalState.bodies.map((body) => {
    const progressFraction = progressById[body.id] ?? 0.75;
    return {
      ...body,
      progressFraction,
      progressPercentage: progressFraction * 100
    };
  });
  orbitalState[pullKey] = {
    ...orbitalState[pullKey],
    members: trioIds.map((id) => {
      const body = CELESTIAL_BODIES.find((candidate) => candidate.id === id);
      return { id: body.id, name: body.name, symbol: body.symbol };
    })
  };
  return orbitalState;
}

function selectedId(tideId, pullKey, trioIds, progressById) {
  return calculateDropState(
    TIDES[tideId],
    createDropFixture(pullKey, trioIds, progressById)
  ).body.id;
}

test('High selects the most-complete Dominant Pull member', () => {
  assert.equal(selectedId('high', 'dominantPull', ['moon', 'venus', 'mars'], {
    moon: 0.2, venus: 0.9, mars: 0.6
  }), 'venus');
});

test('High progress ties use fixed priority', () => {
  const state = calculateDropState(TIDES.high, createDropFixture(
    'dominantPull',
    ['venus', 'mars', 'mercury'],
    { venus: 0.9, mars: 0.9000000000005, mercury: 0.4 }
  ));
  assert.equal(state.body.id, 'venus');
  assert.deepEqual(state.tieBreak, {
    applied: true, method: 'fixed_priority', tiedBodyCount: 2
  });
});

test('Low selects the least-complete Minor Pull member', () => {
  assert.equal(selectedId('low', 'minorPull', ['moon', 'venus', 'mercury'], {
    moon: 0.3, venus: 0.6, mercury: 0.1
  }), 'mercury');
});

test('Low progress ties use fixed priority', () => {
  const state = calculateDropState(TIDES.low, createDropFixture(
    'minorPull',
    ['moon', 'venus', 'mercury'],
    { moon: 0.1, venus: 0.1, mercury: 0.8 }
  ));
  assert.equal(state.body.id, 'moon');
  assert.equal(state.tieBreak.applied, true);
  assert.equal(state.tieBreak.tiedBodyCount, 2);
});

test('Parted selects the median-progress Negative Pull member', () => {
  assert.equal(selectedId('parted', 'negativePull', ['moon', 'venus', 'mars'], {
    moon: 0.1, venus: 0.5, mars: 0.9
  }), 'venus');
});

test('Parted lower median ties use fixed priority', () => {
  const state = calculateDropState(TIDES.parted, createDropFixture(
    'negativePull',
    ['moon', 'venus', 'mars'],
    { moon: 0.2, venus: 0.2, mars: 0.9 }
  ));
  assert.equal(state.body.id, 'moon');
  assert.equal(state.tieBreak.applied, true);
  assert.equal(state.tieBreak.tiedBodyCount, 2);
});

test('Parted upper median ties use fixed priority', () => {
  const state = calculateDropState(TIDES.parted, createDropFixture(
    'negativePull',
    ['moon', 'venus', 'mars'],
    { moon: 0.1, venus: 0.8, mars: 0.8 }
  ));
  assert.equal(state.body.id, 'venus');
  assert.equal(state.tieBreak.applied, true);
  assert.equal(state.tieBreak.tiedBodyCount, 2);
});

test('fully tied Parted state selects the highest-priority available body', () => {
  const withMoon = calculateDropState(TIDES.parted, createDropFixture(
    'negativePull', ['moon', 'venus', 'mars'], { moon: 0, venus: 0, mars: 0 }
  ));
  const withoutMoon = calculateDropState(TIDES.parted, createDropFixture(
    'negativePull', ['venus', 'mars', 'mercury'], { venus: 0, mars: 0, mercury: 0 }
  ));
  assert.equal(withMoon.body.id, 'moon');
  assert.equal(withMoon.tieBreak.tiedBodyCount, 3);
  assert.equal(withoutMoon.body.id, 'venus');
});

test('Drop maps each tide to its exact source pull and rule', () => {
  const expected = {
    high: ['dominant', 'Dominant Pull', 'closest_to_completion'],
    low: ['minor', 'Minor Pull', 'furthest_from_completion'],
    parted: ['negative', 'Negative Pull', 'median_progress']
  };
  for (const [tideId, pullKey] of [
    ['high', 'dominantPull'], ['low', 'minorPull'], ['parted', 'negativePull']
  ]) {
    const state = calculateDropState(TIDES[tideId], createDropFixture(
      pullKey, ['moon', 'venus', 'mars'], { moon: 0.1, venus: 0.5, mars: 0.9 }
    ));
    assert.deepEqual(
      [state.sourcePull.id, state.sourcePull.name, state.selectionRule],
      expected[tideId]
    );
  }
});

test('Drop compares raw fractions rather than formatted percentages', () => {
  const state = calculateDropState(TIDES.high, createDropFixture(
    'dominantPull',
    ['moon', 'venus', 'mars'],
    { moon: 0.9, venus: 0.9000000000015, mars: 0.4 }
  ));
  assert.equal(formatOrbitalPercentage(0.9), formatOrbitalPercentage(0.9000000000015));
  assert.equal(state.body.id, 'venus');
  assert.equal(state.tieBreak.applied, false);
});

test('Drop calculation does not mutate tide, pulls, or bodies', () => {
  const tide = { ...TIDES.low };
  const orbits = createDropFixture(
    'minorPull', ['moon', 'venus', 'mercury'], { moon: 0.2, venus: 0.4, mercury: 0.1 }
  );
  const before = JSON.stringify({ tide, orbits });
  calculateDropState(tide, orbits);
  assert.equal(JSON.stringify({ tide, orbits }), before);
});

test('unsupported tides and missing pull members are rejected clearly', () => {
  const orbits = createDropFixture(
    'minorPull', ['moon', 'venus', 'mercury'], { moon: 0.2, venus: 0.4, mercury: 0.1 }
  );
  assert.throws(
    () => calculateDropState({ id: 'unknown', name: 'Unknown' }, orbits),
    /Unsupported tide id/
  );
  orbits.minorPull.members[0] = { id: 'missing' };
  assert.throws(() => calculateDropState(TIDES.low, orbits), /missing from orbital bodies/);
});

test('epoch integrates Low Drop from Minor Pull without changing public JSON', () => {
  const value = calculateFictionalCalendar(CALENDAR_EPOCH_UNIX_MS);
  assert.equal(value.lunar.tide.id, 'low');
  assert.deepEqual(value.drop.tide, { id: 'low', name: 'Low' });
  assert.deepEqual(value.drop.sourcePull, { id: 'minor', name: 'Minor Pull' });
  assert.equal(value.drop.body.id, 'moon');
  assert.equal(value.drop.body.formattedProgress, '0.000000%');
  assert.deepEqual(value.drop.reward, {
    id: 'common',
    name: 'Common',
    hourProgressFraction: 0,
    hourProgressPercentage: 0,
    attemptsUntilRare: 100
  });
  assert.equal(value.progress.hour.formatted, '0.000000%');
  assert.equal(value.drop.tieBreak.applied, true);
  assert.equal(value.drop.tieBreak.tiedBodyCount, 3);

  const snapshot = createCalendarJson(value, CALENDAR_EPOCH_UNIX_MS);
  assert.equal(snapshot.calendarVersion, 'v8');
  assert.equal('drop' in snapshot.fictional, false);
  assert.deepEqual(Object.keys(snapshot.fictional), [
    'totalSeconds', 'year', 'dayOfYear', 'weekOfYear', 'dayOfWeek',
    'period', 'time', 'season', 'lunar', 'orbits', 'progress', 'formattedDate'
  ]);
});
