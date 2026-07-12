import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCelestialOrbitsRenderer,
  createOrbitalPullsRenderer,
  createOutcomeRenderer,
  createSeasonRenderer
} from '../public/renderers.js';

function rootMissing(selectorToOmit) {
  return {
    querySelector(selector) {
      return selector === selectorToOmit ? null : {};
    }
  };
}

function createOutcomeRoot() {
  const elements = new Map([
    '#outcome-body',
    '#outcome-type',
    '#outcome-attempts',
    '#outcome-progress',
    '#outcome-source',
    '#outcome-rule',
    '#outcome-tiebreak'
  ].map((selector) => [selector, { textContent: '', hidden: false }]));
  return {
    elements,
    querySelector(selector) {
      return elements.get(selector) ?? null;
    }
  };
}

test('Outcome renderer requires the complete canonical card', () => {
  assert.throws(
    () => createOutcomeRenderer(rootMissing('#outcome-type')),
    /Missing required element: #outcome-type/
  );
});

test('Outcome renderer displays every current outcome type', () => {
  const root = createOutcomeRoot();
  const renderOutcome = createOutcomeRenderer(root);
  for (const [id, name, attemptsUntilRare] of [
    ['common', 'Common', 100],
    ['uncommon', 'Uncommon', 14],
    ['rare', 'Rare', 0]
  ]) {
    renderOutcome({
      body: { symbol: '☾', name: 'Moon', formattedProgress: '0.000000%' },
      outcomeType: { id, name, attemptsUntilRare },
      tide: { name: 'Low' },
      sourcePull: { name: 'Minor Pull' },
      selectionRule: 'furthest_from_completion',
      tieBreak: { applied: true }
    });
    assert.equal(root.elements.get('#outcome-type').textContent, `Outcome: ${name}`);
    assert.equal(
      root.elements.get('#outcome-attempts').textContent,
      `Attempts until Rare: ${attemptsUntilRare}`
    );
  }
});

test('Season renderer requires next and progress elements', () => {
  for (const selector of [
    '[data-season-next]',
    '[data-season-progress]',
    '[data-season-progress-bar]'
  ]) {
    assert.throws(
      () => createSeasonRenderer(rootMissing(selector)),
      /Missing required element/,
      selector
    );
  }
});

test('Celestial Orbits renderer requires all six body cards', () => {
  const nestedCard = { querySelector: () => ({}) };
  const root = {
    querySelector(selector) {
      return selector === '[data-orbital-body="moon"]' ? null : nestedCard;
    }
  };
  assert.throws(
    () => createCelestialOrbitsRenderer(root),
    /Missing required element: \[data-orbital-body="moon"\]/
  );
});

test('Orbital Pulls renderer requires all three pull cards', () => {
  const nestedCard = { querySelector: () => ({}) };
  const root = {
    querySelector(selector) {
      return selector === '[data-pull-key="negativePull"]' ? null : nestedCard;
    }
  };
  assert.throws(
    () => createOrbitalPullsRenderer(root),
    /Missing required element: \[data-pull-key="negativePull"\]/
  );
});
