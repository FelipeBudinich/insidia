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

test('Outcome renderer requires the complete canonical card', () => {
  assert.throws(
    () => createOutcomeRenderer(rootMissing('#outcome-reward')),
    /Missing required element: #outcome-reward/
  );
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
