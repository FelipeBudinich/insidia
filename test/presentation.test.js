import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyCommonDocumentPresentation } from '../public/app-bootstrap.js';
import { calculateCalendarState } from '../public/core/mechanics.js';
import { validateLocale } from '../public/locale-loader.js';
import { validateNomenclature } from '../public/nomenclature-loader.js';
import { createPresentationContext } from '../public/nomenclature.js';
import { createCalendarJson, createDisplayData } from '../public/presentation.js';
import { formatAttemptsUntilRare } from '../public/renderers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (...parts) => JSON.parse(await readFile(path.join(root, ...parts), 'utf8'));

async function productionNomenclature() {
  return validateNomenclature(await readJson('public', 'config', 'nomenclature.json'));
}

async function context(localeId = 'en', nomenclature, requestedLocaleId = localeId) {
  const activeNomenclature = nomenclature ?? await productionNomenclature();
  const locale = validateLocale(await readJson('public', 'locales', `${localeId}.json`));
  return createPresentationContext({
    nomenclatureResult: { schemaVersion: 1, nomenclature: activeNomenclature },
    localeResult: { requestedLocaleId, resolvedLocaleId: localeId, schemaVersion: 1, locale }
  });
}

function renamedNomenclature(value) {
  const renamed = structuredClone(value);
  renamed.application.displayName = 'Renamed World';
  renamed.seasons.find(({ id }) => id === 'season-01').name = 'Dry';
  renamed.seasons.find(({ id }) => id === 'season-02').name = 'Rainy';
  renamed.celestialBodies.find(({ id }) => id === 'body-01').name = 'Swift';
  renamed.celestialBodies.find(({ id }) => id === 'body-06').name = 'Luna';
  return validateNomenclature(renamed);
}

test('production nomenclature reproduces every intended proper noun group', async () => {
  const value = await productionNomenclature();
  assert.equal(value.application.displayName, 'Insidia');
  assert.deepEqual(value.calendar.months.map(({ name }) => name), Array.from({ length: 11 }, (_, index) => `Month ${index + 1}`));
  assert.deepEqual(value.seasons.map(({ name }) => name), ['Bones', 'Tears']);
  assert.deepEqual(value.lunarPhases.map(({ name }) => name), ['Rebirth','Horn','Crescent','Passage','Growing','Waxing','Ascent','Apex','Bite','Waning','Receding','Veil','Death']);
  assert.deepEqual(value.tides.map(({ name }) => name), ['Low','High','Parted']);
  assert.deepEqual(value.celestialBodies.map(({ name }) => name), ['Mercury','Venus','Mars','Jupiter','Saturn','Moon']);
  assert.deepEqual(value.pulls.map(({ name }) => name), ['Dominant Pull','Minor Pull','Negative Pull']);
});

test('in-memory nomenclature renaming changes display and never mechanics', async () => {
  const production = await productionNomenclature();
  const renamed = renamedNomenclature(production);
  const timestamp = 0;
  const firstRaw = calculateCalendarState(timestamp);
  const secondRaw = calculateCalendarState(timestamp);
  assert.deepEqual(secondRaw, firstRaw);
  assert.equal(firstRaw.season.id, secondRaw.season.id);
  assert.equal(firstRaw.lunar.phaseId, secondRaw.lunar.phaseId);
  assert.equal(firstRaw.lunar.tide.id, secondRaw.lunar.tide.id);
  assert.deepEqual(firstRaw.orbits, secondRaw.orbits);
  assert.deepEqual(firstRaw.outcome, secondRaw.outcome);
  assert.deepEqual(firstRaw.progress, secondRaw.progress);
  const firstDisplay = createDisplayData(firstRaw, await context('en', production));
  const secondDisplay = createDisplayData(secondRaw, await context('en', renamed));
  assert.equal(firstDisplay.season.name, 'Bones');
  assert.equal(secondDisplay.season.name, 'Dry');
  assert.equal(firstDisplay.orbits.bodies.find(({ id }) => id === 'body-06').name, 'Moon');
  assert.equal(secondDisplay.orbits.bodies.find(({ id }) => id === 'body-06').name, 'Luna');
  assert.deepEqual(firstDisplay.outcomeType, secondDisplay.outcomeType);
});

test('Outcome types are locale-owned and unaffected by nomenclature renaming', async () => {
  const production = await productionNomenclature();
  const renamed = renamedNomenclature(production);
  for (const nomenclature of [production, renamed]) {
    const english = await context('en', nomenclature);
    const spanish = await context('es', nomenclature);
    assert.deepEqual(['outcome-tier-01','outcome-tier-02','outcome-tier-03'].map((id) => english.getOutcomeType(id).name), ['Common','Uncommon','Rare']);
    assert.deepEqual(['outcome-tier-01','outcome-tier-02','outcome-tier-03'].map((id) => spanish.getOutcomeType(id).name), ['Común','Poco común','Raro']);
  }
});

test('Spanish changes generic language and Outcome types but not proper nouns or raw state', async () => {
  const raw = calculateCalendarState(0);
  const english = createDisplayData(raw, await context('en'));
  const spanish = createDisplayData(raw, await context('es'));
  assert.equal(english.season.name, spanish.season.name);
  assert.equal(english.orbits.bodies[0].name, spanish.orbits.bodies[0].name);
  assert.notEqual(english.formattedDate, spanish.formattedDate);
  assert.equal(english.outcomeType.name, 'Common');
  assert.equal(spanish.outcomeType.name, 'Común');
  assert.deepEqual(raw, calculateCalendarState(0));
});

test('Attempts text uses the localized outcome-tier-03 name', async () => {
  const outcome = calculateCalendarState(0).outcome;
  assert.equal(formatAttemptsUntilRare(outcome, await context('en')), 'Attempts until Rare: 100');
  assert.equal(formatAttemptsUntilRare(outcome, await context('es')), 'Intentos hasta Raro: 100');
});

test('JSON v10 replaces universe selection metadata with fixed nomenclature metadata', async () => {
  const raw = calculateCalendarState(0);
  const english = createCalendarJson(raw, 0, await context('en'));
  const spanish = createCalendarJson(raw, 0, await context('es'));
  assert.equal(english.calendarVersion, 'v10');
  assert.equal(Object.hasOwn(english, 'universe'), false);
  assert.deepEqual(english.nomenclature, { schemaVersion: 1, applicationDisplayName: 'Insidia' });
  assert.equal(Object.hasOwn(english.nomenclature, 'requestedId'), false);
  assert.equal(Object.hasOwn(english.nomenclature, 'resolvedId'), false);
  assert.deepEqual(english.locale, { requestedId: 'en', resolvedId: 'en', languageTag: 'en', schemaVersion: 1 });
  assert.deepEqual(english.state, spanish.state);
  assert.doesNotMatch(JSON.stringify(english.state), /"(?:name|symbol|formatted)"/);
  assert.equal(english.display.season.name, 'Bones');
  assert.notEqual(english.display.formattedDate, spanish.display.formattedDate);
  assert.equal(english.display.outcomeType.name, 'Common');
  assert.equal(spanish.display.outcomeType.name, 'Común');
});

test('navigation applies only resolved locale and fixed application metadata', async () => {
  const links = ['calendar','outcome','weather'].map((page) => ({ dataset: { pageLink: page }, textContent: '', attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } }));
  const applicationElements = [{ textContent: '' }];
  const versionElements = [{ textContent: '', setAttribute(name, value) { this[name] = value; } }];
  const nav = { setAttribute(name, value) { this[name] = value; } };
  const meta = { setAttribute(name, value) { this[name] = value; } };
  const documentRoot = {
    documentElement: {}, title: '',
    querySelector(selector) { return selector === 'meta[name="description"]' ? meta : selector === '.primary-nav' ? nav : null; },
    querySelectorAll(selector) {
      if (selector === '[data-page-link]') return links;
      if (selector === '[data-application-name]') return applicationElements;
      if (selector === '[data-version]') return versionElements;
      return [];
    }
  };
  applyCommonDocumentPresentation(documentRoot, 'calendar', await context('es'));
  assert.equal(documentRoot.title, 'Calendario ficticio · Insidia');
  assert.deepEqual(links.map(({ attributes }) => attributes.href), ['/calendar.html?locale=es','/outcome.html?locale=es','/weather.html?locale=es']);
  assert.equal(applicationElements[0].textContent, 'Insidia');
  assert.equal(versionElements[0].textContent, 'v8');
  assert.equal(versionElements[0]['aria-label'], 'Versión de la aplicación 8');
});

test('static HTML remains neutral and uses v8 application placeholders', async () => {
  const properNouns = ['Insidia','Bones','Tears','Rebirth','Mercury','Venus','Mars','Jupiter','Saturn','Moon','Dominant Pull','Minor Pull','Negative Pull','Month 1'];
  for (const file of ['calendar.html','outcome.html','weather.html']) {
    const html = await readFile(path.join(root, 'public', file), 'utf8');
    for (const properNoun of properNouns) assert.ok(!html.includes(properNoun), `${file}: ${properNoun}`);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /data-version>v8/);
    assert.doesNotMatch(html, /data-universe-name/);
    assert.doesNotMatch(html, /<select|name=["'](?:universe|nomenclature)["']/i);
  }
});

test('production JavaScript has no runtime universe selection, cookies, or localStorage', async () => {
  const files = ['app-bootstrap.js','presentation-context-loader.js','nomenclature.js','presentation.js','calendar-page.js','outcome-page.js','weather-page.js','renderers.js'];
  const source = (await Promise.all(files.map((file) => readFile(path.join(root, 'public', file), 'utf8')))).join('\n');
  assert.doesNotMatch(source, /searchParams\.get\(['"]universe|requestedUniverseId|resolvedUniverseId|defaultUniverseId|loadUniverse|universe=/);
  assert.doesNotMatch(source, /localStorage|document\.cookie|cookieStore/);
});

test('core source remains proper-noun free', async () => {
  const source = await readFile(path.join(root, 'public', 'core', 'rules.js'), 'utf8') + await readFile(path.join(root, 'public', 'core', 'mechanics.js'), 'utf8');
  for (const name of ['Insidia','Bones','Tears','Mercury','Venus','Mars','Jupiter','Saturn','Moon','Rebirth']) assert.ok(!source.includes(name));
});
