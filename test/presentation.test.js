import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { applyCommonDocumentPresentation } from '../public/app-bootstrap.js';
import { calculateCalendarState } from '../public/core/mechanics.js';
import { FICTIONAL_SECONDS_PER_DAY, REAL_MS_PER_FICTIONAL_SECOND } from '../public/core/rules.js';
import { validateLocale } from '../public/locale-loader.js';
import { validateNomenclature } from '../public/nomenclature-loader.js';
import { createPresentationContext } from '../public/nomenclature.js';
import { PAGE_DEFINITIONS, PAGE_IDS } from '../public/page-definitions.js';
import { createCalendarJson, createDisplayData } from '../public/presentation.js';
import { formatAttemptsUntilRare } from '../public/renderers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (...parts) => JSON.parse(await readFile(path.join(root, ...parts), 'utf8'));
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const containsProperNoun = (source, name) => new RegExp(`(?<![\\p{L}])${escapeRegExp(name)}(?![\\p{L}])`, 'u').test(source);
const weekdayDayMilliseconds = FICTIONAL_SECONDS_PER_DAY * REAL_MS_PER_FICTIONAL_SECOND;
const WEEKDAYS = Object.freeze([
  { id: 'weekday-01', name: 'Dies Lunae' },
  { id: 'weekday-02', name: 'Dies Martis' },
  { id: 'weekday-03', name: 'Dies Mercurii' },
  { id: 'weekday-04', name: 'Dies Iovis' },
  { id: 'weekday-05', name: 'Dies Veneris' },
  { id: 'weekday-06', name: 'Dies Saturni' },
  { id: 'weekday-07', name: 'Dies Solis' }
]);

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
  renamed.celestialBodies.find(({ id }) => id === 'body-06').name = 'Selene';
  return validateNomenclature(renamed);
}

test('production nomenclature reproduces every intended proper noun group', async () => {
  const value = await productionNomenclature();
  assert.equal(value.schemaVersion, 3);
  assert.equal(value.application.displayName, 'Insidia');
  assert.deepEqual(value.pages, [
    { id: 'page-01', name: 'Calendario' },
    { id: 'page-02', name: 'Destino' },
    { id: 'page-03', name: 'Tempore' }
  ]);
  assert.deepEqual(value.calendar.months.map(({ name }) => name), Array.from({ length: 11 }, (_, index) => `Month ${index + 1}`));
  assert.deepEqual(value.calendar.weekdays, WEEKDAYS);
  assert.deepEqual(value.seasons, [
    { id: 'season-01', name: 'Ossos' },
    { id: 'season-02', name: 'Lacrimas' }
  ]);
  assert.deepEqual(value.lunarPhases, [
    { id: 'phase-01', name: 'Renascimento' },
    { id: 'phase-02', name: 'Corno' },
    { id: 'phase-03', name: 'Falce' },
    { id: 'phase-04', name: 'Passage' },
    { id: 'phase-05', name: 'Ascrescimento' },
    { id: 'phase-06', name: 'Crescente' },
    { id: 'phase-07', name: 'Ascenso' },
    { id: 'phase-08', name: 'Apice' },
    { id: 'phase-09', name: 'Morditura' },
    { id: 'phase-10', name: 'Decrescente' },
    { id: 'phase-11', name: 'Recedente' },
    { id: 'phase-12', name: 'Velo' },
    { id: 'phase-13', name: 'Morte' }
  ]);
  assert.deepEqual(value.tides, [
    { id: 'tide-01', name: 'Marea basse' },
    { id: 'tide-02', name: 'Marea alte' },
    { id: 'tide-03', name: 'Marea dividite' }
  ]);
  assert.deepEqual(value.celestialBodies, [
    { id: 'body-01', name: 'Mercurius', symbol: '☿' },
    { id: 'body-02', name: 'Venus', symbol: '♀' },
    { id: 'body-03', name: 'Mars', symbol: '♂' },
    { id: 'body-04', name: 'Jupiter', symbol: '♃' },
    { id: 'body-05', name: 'Saturnus', symbol: '♄' },
    { id: 'body-06', name: 'Luna', symbol: '☾' }
  ]);
  assert.deepEqual(value.pulls, [
    { id: 'pull-01', name: 'Attraction dominante' },
    { id: 'pull-02', name: 'Attraction minor' },
    { id: 'pull-03', name: 'Attraction divergente' }
  ]);
});

test('seven consecutive days resolve exact weekday nomenclature and day eight wraps', async () => {
  const presentationContext = await context('en');
  for (let dayIndex = 0; dayIndex <= 7; dayIndex += 1) {
    const state = calculateCalendarState(dayIndex * weekdayDayMilliseconds);
    const expected = WEEKDAYS[dayIndex % WEEKDAYS.length];
    assert.equal(state.calendar.weekdayId, expected.id, `day index ${dayIndex}`);
    assert.deepEqual(createDisplayData(state, presentationContext).calendar.weekday, expected, `day index ${dayIndex}`);
  }
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
  assert.equal(firstDisplay.season.name, 'Ossos');
  assert.equal(secondDisplay.season.name, 'Dry');
  assert.equal(firstDisplay.orbits.bodies.find(({ id }) => id === 'body-06').name, 'Luna');
  assert.equal(secondDisplay.orbits.bodies.find(({ id }) => id === 'body-06').name, 'Selene');
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
  const englishContext = await context('en');
  const spanishContext = await context('es');
  const english = createDisplayData(raw, englishContext);
  const spanish = createDisplayData(raw, spanishContext);
  for (const [ids, getter] of [
    [Array.from({ length: 13 }, (_, index) => `phase-${String(index + 1).padStart(2, '0')}`), 'getLunarPhase'],
    [Array.from({ length: 3 }, (_, index) => `tide-${String(index + 1).padStart(2, '0')}`), 'getTide'],
    [Array.from({ length: 2 }, (_, index) => `season-${String(index + 1).padStart(2, '0')}`), 'getSeason'],
    [Array.from({ length: 3 }, (_, index) => `pull-${String(index + 1).padStart(2, '0')}`), 'getPull'],
    [Array.from({ length: 6 }, (_, index) => `body-${String(index + 1).padStart(2, '0')}`), 'getCelestialBody'],
    [WEEKDAYS.map(({ id }) => id), 'getWeekday']
  ]) {
    assert.deepEqual(ids.map((id) => englishContext[getter](id)), ids.map((id) => spanishContext[getter](id)));
  }
  assert.equal(english.season.name, spanish.season.name);
  assert.equal(english.orbits.bodies[0].name, spanish.orbits.bodies[0].name);
  assert.notEqual(english.formattedDate, spanish.formattedDate);
  assert.equal(english.outcomeType.name, 'Common');
  assert.equal(spanish.outcomeType.name, 'Común');
  assert.equal(englishContext.getPage('page-02').name, 'Destino');
  assert.equal(spanishContext.getPage('page-02').name, 'Destino');
  assert.equal(english.calendar.metadata, 'Week 1 · Dies Lunae · Day 1 of 353');
  assert.equal(spanish.calendar.metadata, 'Semana 1 · Dies Lunae · Día 1 de 353');
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

test('JSON v11 exposes the configured weekday while raw state remains neutral', async () => {
  const raw = calculateCalendarState(0);
  const english = createCalendarJson(raw, 0, await context('en'));
  const spanish = createCalendarJson(raw, 0, await context('es'));
  assert.equal(english.calendarVersion, 'v11');
  assert.equal(Object.hasOwn(english, 'universe'), false);
  assert.deepEqual(english.nomenclature, { schemaVersion: 3, applicationDisplayName: 'Insidia' });
  assert.equal(Object.hasOwn(english.nomenclature, 'requestedId'), false);
  assert.equal(Object.hasOwn(english.nomenclature, 'resolvedId'), false);
  assert.deepEqual(english.locale, { requestedId: 'en', resolvedId: 'en', languageTag: 'en', schemaVersion: 2 });
  assert.deepEqual(english.state, spanish.state);
  assert.equal(english.state.calendar.weekdayId, 'weekday-01');
  assert.doesNotMatch(JSON.stringify(english.state), /"(?:name|shortName|symbol|formatted)"/);
  assert.doesNotMatch(JSON.stringify(english.state), /Dies (?:Lunae|Martis|Mercurii|Iovis|Veneris|Saturni|Solis)/);
  assert.deepEqual(english.display.calendar.weekday, { id: 'weekday-01', name: 'Dies Lunae' });
  assert.deepEqual(spanish.display.calendar.weekday, english.display.calendar.weekday);
  assert.deepEqual(Object.keys(english.display.calendar.weekday).sort(), ['id', 'name']);
  assert.equal(Object.hasOwn(english.display.calendar.weekday, 'shortName'), false);
  assert.equal(Object.hasOwn(english.display.calendar.weekday, 'symbol'), false);
  assert.equal(english.display.season.name, 'Ossos');
  assert.equal(english.display.lunar.phase.name, 'Renascimento');
  assert.equal(english.display.orbits.bodies[5].id, 'body-06');
  assert.equal(english.display.orbits.bodies[5].name, 'Luna');
  assert.equal(english.state.lunar.phaseId, 'phase-01');
  assert.equal(english.state.season.id, 'season-01');
  assert.equal(english.state.orbits.bodies[5].id, 'body-06');
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
  assert.equal(versionElements[0].textContent, 'v8.5');
  assert.equal(versionElements[0]['aria-label'], 'Versión de la aplicación 8.5');
  applyCommonDocumentPresentation(documentRoot, 'page-01', await context('en'));
  assert.equal(versionElements[0]['aria-label'], 'Application version 8.5');
});

test('static HTML remains neutral and uses v8.5 page IDs and application placeholders', async () => {
  const properNouns = ['Insidia','Calendario','Destino','Tempore','Ossos','Lacrimas','Renascimento','Mercurius','Venus','Mars','Jupiter','Saturnus','Luna','Attraction dominante','Attraction minor','Attraction divergente','Month 1', ...WEEKDAYS.map(({ name }) => name)];
  for (const file of ['calendario.html','destino.html','tempore.html']) {
    const html = await readFile(path.join(root, 'public', file), 'utf8');
    for (const properNoun of properNouns) assert.ok(!containsProperNoun(html, properNoun), `${file}: ${properNoun}`);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /data-version>v8\.5/);
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
  for (const name of ['Insidia','Ossos','Lacrimas','Mercurius','Venus','Mars','Jupiter','Saturnus','Luna','Renascimento','Marea basse','Attraction dominante', ...WEEKDAYS.map(({ name }) => name)]) assert.ok(!containsProperNoun(source, name), name);
});
