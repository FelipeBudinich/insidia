import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { renderNavigation } from '../public/app-bootstrap.js';
import {
  calculateCalendarioState,
  calculateCalendarState,
  calculateDestinoState,
  calculateTemporeState
} from '../public/core/mechanics.js';
import * as rules from '../public/core/rules.js';
import { NAVIGATION_GROUPS } from '../public/page-definitions.js';
import {
  createNavigationDocument,
  createProductionPresentationContext,
  PUBLIC_DIRECTORY,
  readPublic
} from './helpers.js';

const STATIC_IMPORT_PATTERN = /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"](\.\.?\/[^'"]+)['"]/g;

async function collectModuleGraph(entryPath, graph = new Set()) {
  if (graph.has(entryPath)) return graph;
  graph.add(entryPath);
  const source = await readPublic(entryPath);
  for (const match of source.matchAll(STATIC_IMPORT_PATTERN)) {
    const importedPath = path.posix.normalize(path.posix.join(path.posix.dirname(entryPath), match[1]));
    await collectModuleGraph(importedPath, graph);
  }
  return graph;
}

function withoutCalendarTime(calendar) {
  const { time: _unused, ...dateState } = calendar;
  return dateState;
}

test('static and location module graphs exclude live scheduling and mechanics', async () => {
  for (const entryPath of ['app-bootstrap.js', 'static-page.js', 'location-page.js']) {
    const graph = await collectModuleGraph(entryPath);
    assert.equal(graph.has('live-state.js'), false, entryPath);
    assert.equal(graph.has('core/mechanics.js'), false, entryPath);
  }
});

test('each live graph includes the focused mechanics and generic scheduler path', async () => {
  for (const entryPath of ['calendario-page.js', 'tempore-page.js', 'destino-page.js']) {
    const graph = await collectModuleGraph(entryPath);
    assert.equal(graph.has('live-page-bootstrap.js'), true, entryPath);
    assert.equal(graph.has('live-state.js'), true, entryPath);
    assert.equal(graph.has('core/mechanics.js'), true, entryPath);
  }
});

test('focused page calculators equal only their corresponding full-state subsets', () => {
  for (const timestamp of [0, Date.parse('2026-07-14T00:00:00.000Z')]) {
    const full = calculateCalendarState(timestamp);
    assert.deepEqual(calculateCalendarioState(timestamp), {
      calendar: withoutCalendarTime(full.calendar),
      season: { id: full.season.id },
      lunar: { cycle: full.lunar.cycle, phaseId: full.lunar.phaseId }
    });
    assert.deepEqual(calculateTemporeState(timestamp), {
      calendar: { time: full.calendar.time },
      lunar: { time: full.lunar.time },
      season: full.season,
      progress: {
        lunarPhase: full.progress.lunarPhase,
        season: full.progress.season,
        day: full.progress.day,
        hour: full.progress.hour
      }
    });
    assert.deepEqual(calculateDestinoState(timestamp), {
      lunar: full.lunar,
      orbits: full.orbits,
      outcome: full.outcome,
      progress: { tide: full.progress.tide }
    });
  }
});

test('focused states omit prohibited and unused subtrees', () => {
  const timestamp = Date.parse('2026-07-14T00:00:00.000Z');
  const calendario = calculateCalendarioState(timestamp);
  const tempore = calculateTemporeState(timestamp);
  const destino = calculateDestinoState(timestamp);
  assert.deepEqual(Object.keys(calendario), ['calendar', 'season', 'lunar']);
  assert.equal('time' in calendario.calendar, false);
  assert.equal('orbits' in calendario, false);
  assert.equal('outcome' in calendario, false);
  assert.equal('progress' in calendario, false);
  assert.deepEqual(Object.keys(tempore.calendar), ['time']);
  assert.deepEqual(Object.keys(tempore.lunar), ['time']);
  assert.equal('period' in tempore.calendar, false);
  assert.equal('orbits' in tempore, false);
  assert.equal('outcome' in tempore, false);
  assert.equal('calendar' in destino, false);
  assert.equal('season' in destino, false);
});

test('page cadence lists are derived, exact, and immutable', () => {
  assert.deepEqual(rules.CALENDARIO_BOUNDARY_MILLISECONDS, [
    rules.FICTIONAL_SECONDS_PER_DAY * rules.REAL_MS_PER_FICTIONAL_SECOND,
    rules.LUNAR_SECONDS_PER_DAY * rules.REAL_MS_PER_LUNAR_SECOND
  ]);
  assert.deepEqual(rules.TEMPORE_BOUNDARY_MILLISECONDS, [997, 1009]);
  assert.deepEqual(rules.DESTINO_BOUNDARY_MILLISECONDS, [997, 1009]);
  for (const boundaries of [
    rules.CALENDARIO_BOUNDARY_MILLISECONDS,
    rules.TEMPORE_BOUNDARY_MILLISECONDS,
    rules.DESTINO_BOUNDARY_MILLISECONDS
  ]) assert.equal(Object.isFrozen(boundaries), true);
});

test('navigation renders exact group/page order behavior for every page', async () => {
  const context = await createProductionPresentationContext();
  const expectedGroupNames = ['Personage', 'Almanac', 'Location'];
  const expectedGroupRoutes = ['/identitate.html', '/calendario.html', '/locus.html'];
  for (const activeGroup of NAVIGATION_GROUPS) {
    for (const pageId of activeGroup.pageIds) {
      const { documentRoot, navigation } = createNavigationDocument();
      renderNavigation(documentRoot, pageId, context);
      assert.equal(navigation.children.length, 2);
      const [categories, secondary] = navigation.children;
      assert.deepEqual(categories.children.map((link) => link.textContent), expectedGroupNames);
      assert.deepEqual(categories.children.map((link) => link.href), expectedGroupRoutes);
      assert.equal(categories.children.filter((link) => link.hasAttribute('data-active-section')).length, 1);
      assert.equal(categories.children.find((link) => link.hasAttribute('data-active-section')).dataset.navigationGroupId, activeGroup.id);
      assert.equal(secondary.children.length, 3);
      assert.deepEqual(secondary.children.map((link) => link.dataset.pageId), activeGroup.pageIds);
      assert.equal(secondary.children.filter((link) => link.hasAttribute('aria-current')).length, 1);
      assert.equal(secondary.children.find((link) => link.hasAttribute('aria-current')).dataset.pageId, pageId);
      assert.equal(secondary.getAttribute('aria-labelledby'), activeGroup.categoryElementId);
    }
  }
  const { documentRoot } = createNavigationDocument();
  assert.throws(() => renderNavigation(documentRoot, 'page-99', context), /Unknown page ID/);
});

test('shared page entries reject document IDs outside their allowed page classes', async () => {
  const originalDocument = globalThis.document;
  try {
    globalThis.document = { documentElement: { dataset: { currentPageId: 'page-01' } } };
    await assert.rejects(
      import(`../public/static-page.js?invalid=${Date.now()}`),
      /Unsupported static page ID: page-01/
    );
    globalThis.document = { documentElement: { dataset: { currentPageId: 'page-04' } } };
    await assert.rejects(
      import(`../public/location-page.js?invalid=${Date.now()}`),
      /Unsupported location page ID: page-04/
    );
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

function assertDeeplyFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const nested of Object.values(value)) assertDeeplyFrozen(nested);
}

test('every composite mechanical and navigation rule is deeply immutable', () => {
  for (const value of [
    rules.INTER_REGNUM_LENGTHS,
    rules.SEASON_MONTH_RULER_ROTATIONS,
    rules.ALTERNATING_SKIP_REPLACEMENT_RULES,
    rules.CALENDAR_NAMED_DAY_RULES,
    rules.SEASON_RULES,
    rules.LUNAR_PHASE_RULES,
    rules.TIDE_RULES,
    rules.CELESTIAL_BODY_RULES,
    rules.PULL_RULES,
    rules.OUTCOME_TIDE_RULES,
    rules.OUTCOME_TYPE_RULES,
    NAVIGATION_GROUPS
  ]) assertDeeplyFrozen(value);
  assert.throws(() => { rules.CELESTIAL_BODY_RULES[0].orbitalPeriod.value = 1; }, TypeError);
  assert.equal(rules.CELESTIAL_BODY_RULES[0].orbitalPeriod.value, 89);
});

test('Calendario does not construct the full display tree', async () => {
  const source = await readPublic('calendario-page.js');
  assert.doesNotMatch(source, /createDisplayData/);
  assert.match(source, /createCalendarioDisplayData/);
});

test('one centralized production scan rejects prohibited runtime capabilities', async () => {
  const publicFiles = (await readdir(PUBLIC_DIRECTORY, { recursive: true }))
    .filter((fileName) => fileName.endsWith('.js'));
  const sources = await Promise.all(publicFiles.map(async (fileName) => [fileName, await readPublic(fileName)]));
  sources.push(['server.js', await import('node:fs/promises').then(({ readFile }) => readFile(path.join(PUBLIC_DIRECTORY, '..', 'server.js'), 'utf8'))]);
  for (const [fileName, source] of sources) {
    assert.doesNotMatch(source, /innerHTML|\beval\s*\(|new Function|document\.cookie|localStorage|cookieStore/, fileName);
    assert.doesNotMatch(source, /searchParams\.get\(.locale.|searchParams\.get\(.universe.|requestedLocaleId|resolvedLocaleId|loadLocale|loadUniverse/, fileName);
  }
});
