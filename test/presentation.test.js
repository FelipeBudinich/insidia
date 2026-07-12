import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { calculateCalendarState } from '../public/core/mechanics.js';
import { validateLocale } from '../public/locale-loader.js';
import { createPresentationContext } from '../public/nomenclature.js';
import { createCalendarJson, createDisplayData } from '../public/presentation.js';
import { formatAttemptsUntilRare } from '../public/renderers.js';
import { validateUniversePack } from '../public/universe-loader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (...parts) => JSON.parse(await readFile(path.join(root, ...parts), 'utf8'));

async function loadPack(universeId) {
  const directory = ['public', 'universes', universeId];
  const pack = { id: universeId, manifest: await readJson(...directory, 'manifest.json') };
  for (const [key, file] of Object.entries(pack.manifest.files)) pack[key] = await readJson(...directory, file.replace('./', ''));
  validateUniversePack(pack);
  return pack;
}

async function context(universeId = 'insidia', localeId = 'en', requestedUniverseId = universeId, requestedLocaleId = localeId) {
  const pack = await loadPack(universeId);
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

test('universe manifests and directories contain no Outcome-type category', async () => {
  for (const universeId of ['insidia', 'demonstration']) {
    const directory = path.join(root, 'public', 'universes', universeId);
    const manifest = await readJson('public', 'universes', universeId, 'manifest.json');
    assert.equal(Object.hasOwn(manifest.files, 'outcomeTypes'), false);
    assert.ok(!(await readdir(directory)).includes('outcome-types.json'));
    await assert.rejects(access(path.join(directory, 'outcome-types.json')));
  }
});

test('universe packs contain no Outcome-type names', async () => {
  for (const universeId of ['insidia', 'demonstration']) {
    const directory = path.join(root, 'public', 'universes', universeId);
    const sources = await Promise.all((await readdir(directory)).filter((file) => file.endsWith('.json')).map((file) => readFile(path.join(directory, file), 'utf8')));
    assert.doesNotMatch(sources.join('\n'), /Common|Uncommon|Rare|Común|Poco común|Raro|Basic|Unusual|Scarce/);
  }
});

test('universe validation rejects an unexpected Outcome-types category', async () => {
  const pack = await loadPack('insidia');
  assert.throws(() => validateUniversePack({ ...pack, outcomeTypes: { schemaVersion: 1, items: [] } }), /must not contain outcomeTypes/);
  const manifest = structuredClone(pack.manifest);
  manifest.files.outcomeTypes = './outcome-types.json';
  assert.throws(() => validateUniversePack({ ...pack, manifest }), /every required category/);
});

test('Outcome types resolve exactly from English and Spanish locales', async () => {
  const english = await context('insidia', 'en');
  const spanish = await context('insidia', 'es');
  assert.deepEqual(['outcome-tier-01','outcome-tier-02','outcome-tier-03'].map((id) => english.getOutcomeType(id).name), ['Common','Uncommon','Rare']);
  assert.deepEqual(['outcome-tier-01','outcome-tier-02','outcome-tier-03'].map((id) => spanish.getOutcomeType(id).name), ['Común','Poco común','Raro']);
});

test('same locale resolves identical Outcome types across universes', async () => {
  for (const localeId of ['en', 'es']) {
    const insidia = await context('insidia', localeId);
    const demonstration = await context('demonstration', localeId);
    for (const id of ['outcome-tier-01','outcome-tier-02','outcome-tier-03']) {
      assert.deepEqual(insidia.getOutcomeType(id), demonstration.getOutcomeType(id));
    }
  }
});

test('locale changes generic language but not universe names', async () => {
  const state = calculateCalendarState(0);
  const english = createDisplayData(state, await context('insidia', 'en'));
  const spanish = createDisplayData(state, await context('insidia', 'es'));
  assert.equal(english.season.name, spanish.season.name);
  assert.notEqual(english.formattedDate, spanish.formattedDate);
  assert.equal(english.outcomeType.name, 'Common');
  assert.equal(spanish.outcomeType.name, 'Común');
  assert.equal(JSON.stringify(state), JSON.stringify(calculateCalendarState(0)));
});

test('Attempts text uses the localized outcome-tier-03 name', async () => {
  const outcome = calculateCalendarState(0).outcome;
  assert.equal(formatAttemptsUntilRare(outcome, await context('insidia', 'en')), 'Attempts until Rare: 100');
  assert.equal(formatAttemptsUntilRare(outcome, await context('demonstration', 'es')), 'Intentos hasta Raro: 100');
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
  assert.deepEqual(value.display.outcomeType, { id: 'outcome-tier-01', name: 'Common' });
});

test('v9 display Outcome type changes by locale but not universe while state stays identical', async () => {
  const state = calculateCalendarState(0);
  const combinations = await Promise.all([
    context('insidia','en'), context('demonstration','en'), context('insidia','es'), context('demonstration','es')
  ]);
  const values = combinations.map((current) => createCalendarJson(state, 0, current));
  assert.equal(values.every((value) => value.calendarVersion === 'v9'), true);
  assert.equal(values[0].display.outcomeType.name, 'Common');
  assert.equal(values[1].display.outcomeType.name, 'Common');
  assert.equal(values[2].display.outcomeType.name, 'Común');
  assert.equal(values[3].display.outcomeType.name, 'Común');
  assert.equal(new Set(values.map((value) => JSON.stringify(value.state))).size, 1);
});

test('static HTML contains no Insidia presentation proper nouns', async () => {
  const names = ['Bones','Tears','Rebirth','Mercury','Venus','Mars','Jupiter','Saturn','Moon','Dominant Pull','Minor Pull','Negative Pull'];
  for (const file of ['calendar.html','outcome.html','weather.html']) {
    const html = await readFile(path.join(root, 'public', file), 'utf8');
    for (const name of names) assert.ok(!html.includes(name), `${file}: ${name}`);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /data-version>v7\.1/);
  }
});

test('core source contains no universe display names', async () => {
  const source = await readFile(path.join(root, 'public', 'core', 'rules.js'), 'utf8') + await readFile(path.join(root, 'public', 'core', 'mechanics.js'), 'utf8');
  for (const name of ['Bones','Tears','Mercury','Venus','Mars','Jupiter','Saturn','Moon','Rebirth']) assert.ok(!source.includes(name));
});
