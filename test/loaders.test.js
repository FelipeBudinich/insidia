import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadLocale, validateLocale } from '../public/locale-loader.js';
import { formatTemplate } from '../public/templates.js';
import { loadUniverse } from '../public/universe-loader.js';

const publicDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

function localFetch(overrides = new Map()) {
  return async (url, options) => {
    assert.equal(options.cache, 'no-cache');
    const pathname = new URL(url).pathname;
    if (overrides.has(pathname)) return { ok: true, json: async () => structuredClone(overrides.get(pathname)) };
    try {
      const value = JSON.parse(await readFile(path.join(publicDirectory, pathname), 'utf8'));
      return { ok: true, json: async () => value };
    } catch {
      return { ok: false, json: async () => null };
    }
  };
}

test('loaders select known packs through configured same-origin paths', async () => {
  const fetchFn = localFetch();
  const universe = await loadUniverse({ requestedId: 'demonstration', fetchFn, baseUrl: 'http://app.test/calendar.html' });
  const locale = await loadLocale({ requestedId: 'es', fetchFn, baseUrl: 'http://app.test/calendar.html' });
  assert.equal(universe.resolvedUniverseId, 'demonstration');
  assert.equal(universe.pack.app.displayName, 'Demonstration');
  assert.equal(locale.resolvedLocaleId, 'es');
});

test('unknown requested IDs fall back while preserving requested IDs', async () => {
  const fetchFn = localFetch();
  const universe = await loadUniverse({ requestedId: 'unknown', fetchFn, baseUrl: 'http://app.test/' });
  const locale = await loadLocale({ requestedId: 'unknown', fetchFn, baseUrl: 'http://app.test/' });
  assert.deepEqual([universe.requestedUniverseId, universe.resolvedUniverseId], ['unknown', 'insidia']);
  assert.deepEqual([locale.requestedLocaleId, locale.resolvedLocaleId], ['unknown', 'en']);
});

test('known invalid universe fails instead of mixing with defaults', async () => {
  const badSeasons = { schemaVersion: 1, items: [{ id: 'season-01', name: 'Only one' }] };
  await assert.rejects(() => loadUniverse({
    requestedId: 'demonstration', fetchFn: localFetch(new Map([['/universes/demonstration/seasons.json', badSeasons]])), baseUrl: 'http://app.test/'
  }), /exact required IDs/);
});

test('configured cross-origin locale paths are rejected', async () => {
  const badIndex = { schemaVersion: 1, defaultLocaleId: 'en', locales: [{ id: 'en', file: 'https://evil.test/en.json' }] };
  await assert.rejects(() => loadLocale({ fetchFn: localFetch(new Map([['/locales/index.json', badIndex]])), baseUrl: 'http://app.test/' }), /same-origin/);
});

test('locale validation requires exact Outcome-type IDs', async () => {
  const locale = JSON.parse(await readFile(path.join(publicDirectory, 'locales/en.json'), 'utf8'));
  const missing = structuredClone(locale);
  delete missing.outcomeTypes['outcome-tier-02'];
  assert.throws(() => validateLocale(missing), /exact required IDs/);

  const unknown = structuredClone(locale);
  unknown.outcomeTypes['outcome-tier-04'] = { name: 'Unknown' };
  assert.throws(() => validateLocale(unknown), /exact required IDs/);
});

test('locale validation rejects empty and non-string Outcome-type names', async () => {
  const locale = JSON.parse(await readFile(path.join(publicDirectory, 'locales/en.json'), 'utf8'));
  for (const invalidName of ['', 3, null]) {
    const invalid = structuredClone(locale);
    invalid.outcomeTypes['outcome-tier-03'].name = invalidName;
    assert.throws(() => validateLocale(invalid), /must be a non-empty string/);
  }
});

test('known malformed locale fails without falling back to English', async () => {
  const spanish = JSON.parse(await readFile(path.join(publicDirectory, 'locales/es.json'), 'utf8'));
  delete spanish.outcomeTypes['outcome-tier-01'];
  await assert.rejects(() => loadLocale({
    requestedId: 'es',
    fetchFn: localFetch(new Map([['/locales/es.json', spanish]])),
    baseUrl: 'http://app.test/'
  }), /exact required IDs/);
});

test('template formatter replaces named values and rejects missing values', () => {
  assert.equal(formatTemplate('{dayLabel} {day}', { dayLabel: 'Day', day: 2 }), 'Day 2');
  assert.throws(() => formatTemplate('{dayLabel} {day}', { dayLabel: 'Day' }), /Missing template value/);
});
