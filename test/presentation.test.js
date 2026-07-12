import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { calculateCalendarState } from '../public/core/mechanics.js';
import { validateLocale } from '../public/locale-loader.js';
import { createPresentationContext } from '../public/nomenclature.js';
import { createCalendarJson, createDisplayData } from '../public/presentation.js';
import { validateUniversePack } from '../public/universe-loader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (...parts) => JSON.parse(await readFile(path.join(root, ...parts), 'utf8'));

async function context(universeId = 'insidia', localeId = 'en', requestedUniverseId = universeId, requestedLocaleId = localeId) {
  const directory = ['public', 'universes', universeId];
  const pack = { id: universeId, manifest: await readJson(...directory, 'manifest.json') };
  for (const [key, file] of Object.entries(pack.manifest.files)) pack[key] = await readJson(...directory, file.replace('./', ''));
  validateUniversePack(pack);
  const locale = validateLocale(await readJson('public', 'locales', `${localeId}.json`));
  return createPresentationContext({
    universeResult: { requestedUniverseId, resolvedUniverseId: universeId, schemaVersion: 1, pack },
    localeResult: { requestedLocaleId, resolvedLocaleId: localeId, schemaVersion: 1, locale }
  });
}

test('both universe packs and both locale packs validate', async () => {
  for (const universe of ['insidia', 'demonstration']) for (const locale of ['en', 'es']) await context(universe, locale);
});

test('nomenclature changes display without changing mechanics', async () => {
  const state = calculateCalendarState(0);
  const insidia = createDisplayData(state, await context('insidia'));
  const demo = createDisplayData(state, await context('demonstration'));
  assert.equal(insidia.calendar.month.name, 'Month 1');
  assert.equal(demo.calendar.month.name, 'Month A');
  assert.notEqual(insidia.season.name, demo.season.name);
  assert.equal(JSON.stringify(state), JSON.stringify(calculateCalendarState(0)));
});

test('locale changes generic language but not universe names', async () => {
  const state = calculateCalendarState(0);
  const english = createDisplayData(state, await context('insidia', 'en'));
  const spanish = createDisplayData(state, await context('insidia', 'es'));
  assert.equal(english.season.name, spanish.season.name);
  assert.notEqual(english.formattedDate, spanish.formattedDate);
});

test('v9 JSON records requested/resolved context and separates raw state from display', async () => {
  const state = calculateCalendarState(0);
  const value = createCalendarJson(state, 0, await context('insidia', 'en', 'unknown', 'unknown'));
  assert.equal(value.calendarVersion, 'v9');
  assert.deepEqual(value.source, { unixMilliseconds: 0, isoUtc: '1970-01-01T00:00:00.000Z' });
  assert.equal(value.universe.requestedId, 'unknown');
  assert.equal(value.universe.resolvedId, 'insidia');
  assert.equal(value.locale.requestedId, 'unknown');
  assert.doesNotMatch(JSON.stringify(value.state), /"(?:name|symbol|formatted)"/);
  assert.equal(value.display.calendar.time, '00:00:00');
});

test('static HTML contains no Insidia presentation proper nouns', async () => {
  const names = ['Bones','Tears','Rebirth','Mercury','Venus','Mars','Jupiter','Saturn','Moon','Dominant Pull','Minor Pull','Negative Pull'];
  for (const file of ['calendar.html','outcome.html','weather.html']) {
    const html = await readFile(path.join(root, 'public', file), 'utf8');
    for (const name of names) assert.ok(!html.includes(name), `${file}: ${name}`);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /data-version>v7/);
  }
});

test('core source contains no universe display names', async () => {
  const source = await readFile(path.join(root, 'public', 'core', 'rules.js'), 'utf8') + await readFile(path.join(root, 'public', 'core', 'mechanics.js'), 'utf8');
  for (const name of ['Bones','Tears','Mercury','Venus','Mars','Jupiter','Saturn','Moon','Rebirth']) assert.ok(!source.includes(name));
});
