import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { bootstrapPage } from '../public/app-bootstrap.js';
import { loadLocale, validateLocale } from '../public/locale-loader.js';
import { loadNomenclature, NOMENCLATURE_PATH, validateNomenclature } from '../public/nomenclature-loader.js';
import { requestedPresentationOptions } from '../public/presentation-context-loader.js';
import { formatTemplate } from '../public/templates.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDirectory = path.join(root, 'public');
const nomenclaturePath = path.join(publicDirectory, 'config', 'nomenclature.json');
const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

function localFetch(overrides = new Map(), requests = []) {
  return async (url, options) => {
    assert.equal(options.cache, 'no-cache');
    const pathname = new URL(url).pathname;
    requests.push(pathname);
    if (overrides.has(pathname)) {
      const override = overrides.get(pathname);
      if (override === 'malformed') return { ok: true, json: async () => { throw new SyntaxError('bad JSON'); } };
      if (override === 'missing') return { ok: false, json: async () => null };
      return { ok: true, json: async () => structuredClone(override) };
    }
    try {
      return { ok: true, json: async () => readJson(path.join(publicDirectory, pathname)) };
    } catch {
      return { ok: false, json: async () => null };
    }
  };
}

test('there is exactly one production nomenclature JSON file and no universe infrastructure', async () => {
  const configJson = (await readdir(path.join(publicDirectory, 'config'))).filter((file) => file.endsWith('.json'));
  assert.deepEqual(configJson, ['nomenclature.json']);
  await access(nomenclaturePath);
  await assert.rejects(access(path.join(publicDirectory, 'universes')));
  await assert.rejects(access(path.join(publicDirectory, 'universe-loader.js')));
});

test('loadNomenclature always requests the one fixed same-origin path', async () => {
  const requests = [];
  const result = await loadNomenclature({ fetchFn: localFetch(new Map(), requests), baseUrl: 'http://app.test/outcome.html?anything=config' });
  assert.equal(NOMENCLATURE_PATH, '/config/nomenclature.json');
  assert.deepEqual(requests, ['/config/nomenclature.json']);
  assert.equal(result.nomenclature.application.displayName, 'Insidia');
});

test('nomenclature loader rejects IDs, alternate paths, and other source options', async () => {
  const fetchFn = localFetch();
  for (const unsupported of [
    { requestedId: 'other' }, { universeId: 'other' }, { path: '/other.json' }, { url: '/other.json' }
  ]) {
    await assert.rejects(() => loadNomenclature({ fetchFn, baseUrl: 'http://app.test/', ...unsupported }), /Unsupported nomenclature loader option/);
  }
});

test('query parameters cannot change the nomenclature request', async () => {
  for (const query of ['?locale=es', '?nomenclature=other', '?universe=other&locale=es', '?path=/evil.json']) {
    const requests = [];
    await loadNomenclature({ fetchFn: localFetch(new Map(), requests), baseUrl: `http://app.test/calendar.html${query}` });
    assert.deepEqual(requests, ['/config/nomenclature.json']);
  }
});

test('production nomenclature validates complete neutral ID coverage', async () => {
  const value = validateNomenclature(await readJson(nomenclaturePath));
  assert.equal(value.calendar.months.length, 11);
  assert.equal(value.calendar.weekdays.length, 7);
  assert.equal(value.calendar.interRegna.length, 11);
  assert.equal(value.seasons.length, 2);
  assert.equal(value.lunarPhases.length, 13);
  assert.equal(value.tides.length, 3);
  assert.equal(value.celestialBodies.length, 6);
  assert.equal(value.pulls.length, 3);
});

test('nomenclature validation rejects missing, duplicate, unknown, and invalid entities', async () => {
  const valid = await readJson(nomenclaturePath);
  const missing = structuredClone(valid); missing.seasons.pop();
  const duplicate = structuredClone(valid); duplicate.seasons[1].id = 'season-01';
  const unknown = structuredClone(valid); unknown.seasons[1].id = 'season-99';
  const empty = structuredClone(valid); empty.seasons[0].name = '';
  const nonString = structuredClone(valid); nonString.celestialBodies[0].symbol = 7;
  const wrongSchema = structuredClone(valid); wrongSchema.schemaVersion = 2;
  for (const invalid of [missing, duplicate, unknown, empty, nonString, wrongSchema]) {
    assert.throws(() => validateNomenclature(invalid));
  }
});

test('nomenclature rejects Outcome types, locale data, mechanics, and extra keys', async () => {
  const valid = await readJson(nomenclaturePath);
  for (const [key, value] of [
    ['outcomeTypes', {}], ['messages', {}], ['durationDays', 179],
    ['orbitalPeriod', { unit: 'day', value: 1 }], ['maximumPercentage', 99]
  ]) {
    const invalid = structuredClone(valid);
    invalid[key] = value;
    assert.throws(() => validateNomenclature(invalid));
  }
});

test('missing, malformed, and invalid nomenclature never fall back', async () => {
  const valid = await readJson(nomenclaturePath);
  const invalid = structuredClone(valid); invalid.pulls.pop();
  for (const replacement of ['missing', 'malformed', invalid]) {
    await assert.rejects(() => loadNomenclature({
      fetchFn: localFetch(new Map([[NOMENCLATURE_PATH, replacement]])),
      baseUrl: 'http://app.test/'
    }));
  }
});

function configurationErrorDocument() {
  const makeElement = () => ({
    attributes: {}, children: [], textContent: '', className: '',
    setAttribute(name, value) { this.attributes[name] = value; },
    append(child) { this.children.push(child); }
  });
  const documentElement = makeElement();
  documentElement.removeAttribute = function removeAttribute(name) { delete this.attributes[name]; };
  return { documentElement, body: makeElement(), createElement: makeElement };
}

test('missing or invalid nomenclature prevents rendering and shows an accessible error', async (t) => {
  t.mock.method(console, 'error', () => {});
  const valid = await readJson(nomenclaturePath);
  const invalid = structuredClone(valid); invalid.calendar.months.pop();
  for (const replacement of ['missing', invalid]) {
    const documentRoot = configurationErrorDocument();
    let rendererCreated = false;
    const result = await bootstrapPage('calendar', () => { rendererCreated = true; }, {
      documentRoot,
      locationLike: { href: 'http://app.test/calendar.html?locale=en' },
      fetchFn: localFetch(new Map([[NOMENCLATURE_PATH, replacement]]))
    });
    assert.equal(result, null);
    assert.equal(rendererCreated, false);
    assert.equal(documentRoot.documentElement.attributes['aria-busy'], undefined);
    assert.equal(documentRoot.body.children[0].attributes.role, 'alert');
    assert.equal(documentRoot.body.children[0].children[0].textContent, 'Unable to load the application or locale configuration.');
  }
});

test('locale-only query parsing defaults, resolves Spanish, and ignores all other parameters', () => {
  assert.deepEqual(requestedPresentationOptions('http://app.test/calendar.html'), { requestedLocaleId: undefined });
  assert.deepEqual(requestedPresentationOptions('http://app.test/calendar.html?locale=es'), { requestedLocaleId: 'es' });
  assert.deepEqual(requestedPresentationOptions('http://app.test/calendar.html?universe=other&locale=es&unused=x'), { requestedLocaleId: 'es' });
});

test('locale loader resolves Spanish and falls back from an unknown locale to English', async () => {
  const fetchFn = localFetch();
  assert.equal((await loadLocale({ requestedId: 'es', fetchFn, baseUrl: 'http://app.test/' })).resolvedLocaleId, 'es');
  const fallback = await loadLocale({ requestedId: 'unknown', fetchFn, baseUrl: 'http://app.test/' });
  assert.deepEqual([fallback.requestedLocaleId, fallback.resolvedLocaleId], ['unknown', 'en']);
});

test('locale Outcome types are exact and malformed known locales fail', async () => {
  const english = validateLocale(await readJson(path.join(publicDirectory, 'locales', 'en.json')));
  const spanish = validateLocale(await readJson(path.join(publicDirectory, 'locales', 'es.json')));
  assert.deepEqual(Object.values(english.outcomeTypes).map(({ name }) => name), ['Common', 'Uncommon', 'Rare']);
  assert.deepEqual(Object.values(spanish.outcomeTypes).map(({ name }) => name), ['Común', 'Poco común', 'Raro']);
  const invalid = structuredClone(spanish); delete invalid.outcomeTypes['outcome-tier-01'];
  await assert.rejects(() => loadLocale({ requestedId: 'es', fetchFn: localFetch(new Map([['/locales/es.json', invalid]])), baseUrl: 'http://app.test/' }));
});

test('template formatter replaces named values and rejects missing values', () => {
  assert.equal(formatTemplate('{dayLabel} {day}', { dayLabel: 'Day', day: 2 }), 'Day 2');
  assert.throws(() => formatTemplate('{dayLabel} {day}', { dayLabel: 'Day' }), /Missing template value/);
});
