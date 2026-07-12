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
import { PAGE_DEFINITIONS, PAGE_IDS } from '../public/page-definitions.js';
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
    nomenclatureResult: { schemaVersion: activeNomenclature.schemaVersion, nomenclature: activeNomenclature },
    localeResult: { requestedLocaleId, resolvedLocaleId: localeId, schemaVersion: locale.schemaVersion, locale }
  });
}

function renamedNomenclature(value) {
  const renamed = structuredClone(value);
  renamed.application.displayName = 'Renamed World';
  renamed.pages.find(({ id }) => id === 'page-01').name = 'Chronica';
  renamed.seasons.find(({ id }) => id === 'season-01').name = 'Dry';
  renamed.seasons.find(({ id }) => id === 'season-02').name = 'Rainy';
  renamed.celestialBodies.find(({ id }) => id === 'body-01').name = 'Swift';
  renamed.celestialBodies.find(({ id }) => id === 'body-06').name = 'Luna';
  return validateNomenclature(renamed);
}

test('production nomenclature reproduces every intended proper noun group', async () => {
  const value = await productionNomenclature();
  assert.equal(value.application.displayName, 'Insidia');
  assert.deepEqual(value.pages, [
    { id: 'page-01', name: 'Calendario' },
    { id: 'page-02', name: 'Destino' },
    { id: 'page-03', name: 'Tempore' }
  ]);
  assert.deepEqual(value.calendar.months.map(({ name }) => name), Array.from({ length: 11 }, (_, index) => `Month ${index + 1}`));
  assert.deepEqual(value.seasons.map(({ name }) => name), ['Bones', 'Tears']);
  assert.deepEqual(value.lunarPhases.map(({ name }) => name), ['Rebirth','Horn','Crescent','Passage','Growing','Waxing','Ascent','Apex','Bite','Waning','Receding','Veil','Death']);
  assert.deepEqual(value.tides.map(({ name }) => name), ['Low','High','Parted']);
  assert.deepEqual(value.celestialBodies.map(({ name }) => name), ['Mercury','Venus','Mars','Jupiter','Saturn','Moon']);
  assert.deepEqual(value.pulls.map(({ name }) => name), ['Dominant Pull','Minor Pull','Negative Pull']);
});

test('stable page IDs map to fixed non-configurable routes', () => {
  assert.deepEqual(PAGE_IDS, ['page-01','page-02','page-03']);
  assert.deepEqual(PAGE_IDS.map((id) => PAGE_DEFINITIONS[id].route), ['/calendario.html','/destino.html','/tempore.html']);
  assert.deepEqual(PAGE_IDS.map((id) => PAGE_DEFINITIONS[id].descriptionTemplateKey), [
    'document.page-01Description','document.page-02Description','document.page-03Description'
  ]);
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
  assert.equal((await context('en', production)).getPage('page-01').name, 'Calendario');
  assert.equal((await context('en', renamed)).getPage('page-01').name, 'Chronica');
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
  assert.equal((await context('en')).getPage('page-02').name, 'Destino');
  assert.equal((await context('es')).getPage('page-02').name, 'Destino');
  assert.deepEqual(raw, calculateCalendarState(0));
});

test('Attempts text uses the localized outcome-tier-03 name', async () => {
  const outcome = calculateCalendarState(0).outcome;
  assert.equal(formatAttemptsUntilRare(outcome, await context('en')), 'Attempts until Rare: 100');
  assert.equal(formatAttemptsUntilRare(outcome, await context('es')), 'Intentos hasta Raro: 100');
});

test('Destino classification uses nomenclature while Outcome types use locale', async () => {
  const english = await context('en');
  const spanish = await context('es');
  assert.equal(english.format('outcome.type', { pageName: english.getPage('page-02').name, name: english.getOutcomeType('outcome-tier-01').name }), 'Destino: Common');
  assert.equal(spanish.format('outcome.type', { pageName: spanish.getPage('page-02').name, name: spanish.getOutcomeType('outcome-tier-01').name }), 'Destino: Común');
});

test('JSON v10 replaces universe selection metadata with fixed nomenclature metadata', async () => {
  const raw = calculateCalendarState(0);
  const english = createCalendarJson(raw, 0, await context('en'));
  const spanish = createCalendarJson(raw, 0, await context('es'));
  assert.equal(english.calendarVersion, 'v10');
  assert.equal(Object.hasOwn(english, 'universe'), false);
  assert.deepEqual(english.nomenclature, { schemaVersion: 2, applicationDisplayName: 'Insidia' });
  assert.equal(Object.hasOwn(english.nomenclature, 'requestedId'), false);
  assert.equal(Object.hasOwn(english.nomenclature, 'resolvedId'), false);
  assert.deepEqual(english.locale, { requestedId: 'en', resolvedId: 'en', languageTag: 'en', schemaVersion: 2 });
  assert.deepEqual(english.state, spanish.state);
  assert.doesNotMatch(JSON.stringify(english.state), /"(?:name|symbol|formatted)"/);
  assert.equal(english.display.season.name, 'Bones');
  assert.notEqual(english.display.formattedDate, spanish.display.formattedDate);
  assert.equal(english.display.outcomeType.name, 'Common');
  assert.equal(spanish.display.outcomeType.name, 'Común');
  assert.doesNotMatch(JSON.stringify(english), /calendario\.html|destino\.html|tempore\.html|calendar\.html|outcome\.html|weather\.html/);
});

test('navigation applies only resolved locale and fixed application metadata', async () => {
  const links = ['page-01','page-02','page-03'].map((pageId) => ({ dataset: { pageId }, textContent: '', attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } }));
  const applicationElements = [{ textContent: '' }];
  const pageNameElements = [{ textContent: '' }];
  const versionElements = [{ textContent: '', setAttribute(name, value) { this[name] = value; } }];
  const nav = { setAttribute(name, value) { this[name] = value; } };
  const meta = { setAttribute(name, value) { this[name] = value; } };
  const documentRoot = {
    documentElement: {}, title: '',
    querySelector(selector) { return selector === 'meta[name="description"]' ? meta : selector === '.primary-nav' ? nav : null; },
    querySelectorAll(selector) {
      if (selector === '[data-page-id]') return links;
      if (selector === '[data-page-name]') return pageNameElements;
      if (selector === '[data-application-name]') return applicationElements;
      if (selector === '[data-version]') return versionElements;
      return [];
    }
  };
  applyCommonDocumentPresentation(documentRoot, 'page-01', await context('es'));
  assert.equal(documentRoot.title, 'Calendario · Insidia');
  assert.deepEqual(links.map(({ attributes }) => attributes.href), ['/calendario.html?locale=es','/destino.html?locale=es','/tempore.html?locale=es']);
  assert.deepEqual(links.map(({ textContent }) => textContent), ['Calendario','Destino','Tempore']);
  assert.equal(pageNameElements[0].textContent, 'Calendario');
  assert.equal(applicationElements[0].textContent, 'Insidia');
  assert.equal(versionElements[0].textContent, 'v8.2');
  assert.equal(versionElements[0]['aria-label'], 'Versión de la aplicación 8.2');
});

test('static HTML remains neutral and uses v8.2 page IDs and application placeholders', async () => {
  const properNouns = ['Insidia','Calendario','Destino','Tempore','Bones','Tears','Rebirth','Mercury','Venus','Mars','Jupiter','Saturn','Moon','Dominant Pull','Minor Pull','Negative Pull','Month 1'];
  for (const file of ['calendario.html','destino.html','tempore.html']) {
    const html = await readFile(path.join(root, 'public', file), 'utf8');
    for (const properNoun of properNouns) assert.ok(!html.includes(properNoun), `${file}: ${properNoun}`);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /data-version>v8\.2/);
    assert.doesNotMatch(html, /data-universe-name/);
    assert.doesNotMatch(html, /data-page-link|data-message-key="page\./);
    assert.doesNotMatch(html, /<select|name=["'](?:universe|nomenclature)["']/i);
  }
});

test('production JavaScript has no runtime universe selection, cookies, or localStorage', async () => {
  const files = ['app-bootstrap.js','presentation-context-loader.js','nomenclature.js','presentation.js','calendario-page.js','destino-page.js','tempore-page.js','renderers.js'];
  const source = (await Promise.all(files.map((file) => readFile(path.join(root, 'public', file), 'utf8')))).join('\n');
  assert.doesNotMatch(source, /searchParams\.get\(['"]universe|requestedUniverseId|resolvedUniverseId|defaultUniverseId|loadUniverse|universe=/);
  assert.doesNotMatch(source, /localStorage|document\.cookie|cookieStore/);
});

test('core source remains proper-noun free', async () => {
  const source = await readFile(path.join(root, 'public', 'core', 'rules.js'), 'utf8') + await readFile(path.join(root, 'public', 'core', 'mechanics.js'), 'utf8');
  for (const name of ['Insidia','Bones','Tears','Mercury','Venus','Mars','Jupiter','Saturn','Moon','Rebirth']) assert.ok(!source.includes(name));
});
