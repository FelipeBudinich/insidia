import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { bootstrapPage, bootstrapStaticPage } from '../public/app-bootstrap.js';
import {
  INTERFACE_LANGUAGE_TAG,
  INTERFACE_MESSAGES,
  INTERFACE_TEMPLATES
} from '../public/interface-text.js';
import { loadNomenclature, NOMENCLATURE_PATH, validateNomenclature } from '../public/nomenclature-loader.js';
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

test('localization resources and presentation orchestrator are removed', async () => {
  for (const removedPath of ['locales', 'locale-loader.js', 'presentation-context-loader.js']) {
    await assert.rejects(access(path.join(publicDirectory, removedPath)));
  }
  assert.equal(INTERFACE_LANGUAGE_TAG, 'ia');
  assert.equal(Object.isFrozen(INTERFACE_MESSAGES), true);
  assert.equal(Object.isFrozen(INTERFACE_TEMPLATES), true);
});

test('loadNomenclature always requests the one fixed same-origin path', async () => {
  const requests = [];
  const result = await loadNomenclature({ fetchFn: localFetch(new Map(), requests), baseUrl: 'http://app.test/destino.html?anything=config' });
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
    await loadNomenclature({ fetchFn: localFetch(new Map(), requests), baseUrl: `http://app.test/calendario.html${query}` });
    assert.deepEqual(requests, ['/config/nomenclature.json']);
  }
});

test('production nomenclature validates complete neutral ID coverage', async () => {
  const value = validateNomenclature(await readJson(nomenclaturePath));
  assert.equal(value.schemaVersion, 12);
  assert.deepEqual(value.lunarCycle, { name: 'Cyclus Lunae' });
  assert.deepEqual(Object.keys(value.lunarCycle), ['name']);
  assert.equal(value.calendar.yearName, 'Annus Solis');
  assert.deepEqual(Object.keys(value.calendar).sort(), ['interRegna', 'monthReign', 'namedDays', 'weekdays', 'yearName']);
  assert.equal(Object.hasOwn(value.calendar, 'months'), false);
  assert.deepEqual(value.pages.map(({ id }) => id), ['page-01', 'page-02', 'page-03', 'page-04', 'page-05', 'page-06', 'page-07', 'page-08', 'page-09']);
  assert.deepEqual(value.pages.map(({ name }) => name), [
    'Calendario', 'Destino', 'Tempore', 'Identitate', 'Inventario', 'Subordinatos',
    'Locus', 'Rutas', 'Explorar'
  ]);
  assert.deepEqual(value.navigationGroups, [
    { id: 'navigation-group-01', name: 'Almanac' },
    { id: 'navigation-group-02', name: 'Personage' },
    { id: 'navigation-group-03', name: 'Location' }
  ]);
  assert.deepEqual(value.pageSections.map(({ id }) => id), [
    'page-section-01', 'page-section-02', 'page-section-03', 'page-section-04',
    'page-section-06', 'page-section-07', 'page-section-09', 'page-section-11',
    'page-section-12', 'page-section-13'
  ]);
  assert.deepEqual(value.outcomeTypes, [
    { id: 'outcome-tier-01', name: 'Commune' },
    { id: 'outcome-tier-02', name: 'Infrequens' },
    { id: 'outcome-tier-03', name: 'Rarum' }
  ]);
  assert.equal(Object.hasOwn(value, 'location'), false);
  assert.equal(Object.hasOwn(value, 'mappa'), false);
  assert.equal(value.calendar.weekdays.length, 7);
  assert.equal(value.calendar.namedDays.length, 5);
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
  const wrongSchema = structuredClone(valid); wrongSchema.schemaVersion = 6;
  for (const invalid of [missing, duplicate, unknown, empty, nonString, wrongSchema]) {
    assert.throws(() => validateNomenclature(invalid));
  }
});

test('named-day nomenclature requires exact canonical entities and no mechanics', async () => {
  const valid = await readJson(nomenclaturePath);
  assert.deepEqual(validateNomenclature(valid).calendar.namedDays, [
    { id: 'named-day-01', name: 'Kalendis' },
    { id: 'named-day-02', name: 'Nonis' },
    { id: 'named-day-03', name: 'Idibus' },
    { id: 'named-day-04', name: 'Liminis' },
    { id: 'named-day-05', name: 'Interregis' }
  ]);

  const missing = structuredClone(valid); missing.calendar.namedDays.pop();
  const duplicate = structuredClone(valid); duplicate.calendar.namedDays[1].id = 'named-day-01';
  const unknown = structuredClone(valid); unknown.calendar.namedDays[1].id = 'named-day-99';
  const reordered = structuredClone(valid); reordered.calendar.namedDays.reverse();
  const emptyName = structuredClone(valid); emptyName.calendar.namedDays[0].name = '';
  const nonStringName = structuredClone(valid); nonStringName.calendar.namedDays[0].name = 1;
  const extraDay = structuredClone(valid); extraDay.calendar.namedDays[0].day = 1;
  const extraPeriodType = structuredClone(valid); extraPeriodType.calendar.namedDays[0].periodType = 'month';
  const oldCalendarShape = structuredClone(valid); delete oldCalendarShape.calendar.namedDays;
  for (const invalid of [
    missing, duplicate, unknown, reordered, emptyName, nonStringName,
    extraDay, extraPeriodType, oldCalendarShape
  ]) assert.throws(() => validateNomenclature(invalid));
});

test('month-reign nomenclature requires exact rulers, ordinals, and name-only entities', async () => {
  const valid = await readJson(nomenclaturePath);
  const monthReign = validateNomenclature(valid).calendar.monthReign;
  assert.equal(monthReign.name, 'Regno de');
  assert.deepEqual(monthReign.rulers, [
    { id: 'ruler-01', name: 'Orgolio' }, { id: 'ruler-02', name: 'Rabia' },
    { id: 'ruler-03', name: 'Gula' }, { id: 'ruler-04', name: 'Invidia' },
    { id: 'ruler-05', name: 'Avaritia' }, { id: 'ruler-06', name: 'Vanitate' },
    { id: 'ruler-07', name: 'Luxuria' }, { id: 'ruler-08', name: 'Pigritia' }
  ]);
  assert.deepEqual(monthReign.ordinals, [
    { id: 'reign-ordinal-01', name: 'Prime' }, { id: 'reign-ordinal-02', name: 'Secunde' },
    { id: 'reign-ordinal-03', name: 'Tertie' }, { id: 'reign-ordinal-04', name: 'Quarte' },
    { id: 'reign-ordinal-05', name: 'Quinte' }, { id: 'reign-ordinal-06', name: 'Sexte' },
    { id: 'reign-ordinal-07', name: 'Septime' }, { id: 'reign-ordinal-08', name: 'Octave' },
    { id: 'reign-ordinal-09', name: 'None' }, { id: 'reign-ordinal-10', name: 'Decime' },
    { id: 'reign-ordinal-11', name: 'Undecime' }
  ]);

  const missingRuler = structuredClone(valid); missingRuler.calendar.monthReign.rulers.pop();
  const duplicateRuler = structuredClone(valid); duplicateRuler.calendar.monthReign.rulers[1].id = 'ruler-01';
  const unknownRuler = structuredClone(valid); unknownRuler.calendar.monthReign.rulers[1].id = 'ruler-99';
  const emptyRuler = structuredClone(valid); emptyRuler.calendar.monthReign.rulers[0].name = '';
  const whitespaceRuler = structuredClone(valid); whitespaceRuler.calendar.monthReign.rulers[0].name = '   ';
  const nonStringRuler = structuredClone(valid); nonStringRuler.calendar.monthReign.rulers[0].name = 1;
  const reorderedRulers = structuredClone(valid); reorderedRulers.calendar.monthReign.rulers.reverse();
  const rulerShortName = structuredClone(valid); rulerShortName.calendar.monthReign.rulers[0].shortName = 'O';
  const missingOrdinal = structuredClone(valid); missingOrdinal.calendar.monthReign.ordinals.pop();
  const duplicateOrdinal = structuredClone(valid); duplicateOrdinal.calendar.monthReign.ordinals[1].id = 'reign-ordinal-01';
  const unknownOrdinal = structuredClone(valid); unknownOrdinal.calendar.monthReign.ordinals[1].id = 'reign-ordinal-99';
  const emptyOrdinal = structuredClone(valid); emptyOrdinal.calendar.monthReign.ordinals[0].name = '';
  const whitespaceOrdinal = structuredClone(valid); whitespaceOrdinal.calendar.monthReign.ordinals[0].name = '   ';
  const nonStringOrdinal = structuredClone(valid); nonStringOrdinal.calendar.monthReign.ordinals[0].name = 1;
  const reorderedOrdinals = structuredClone(valid); reorderedOrdinals.calendar.monthReign.ordinals.reverse();
  const missingName = structuredClone(valid); delete missingName.calendar.monthReign.name;
  const emptyName = structuredClone(valid); emptyName.calendar.monthReign.name = '';
  const whitespaceName = structuredClone(valid); whitespaceName.calendar.monthReign.name = '   ';
  const nonStringName = structuredClone(valid); nonStringName.calendar.monthReign.name = 1;
  const staticMonths = structuredClone(valid); staticMonths.calendar.months = [];
  const mechanicalSkip = structuredClone(valid); mechanicalSkip.calendar.monthReign.skippedRegularTurn = true;
  const mechanicalDuration = structuredClone(valid); mechanicalDuration.calendar.monthReign.durationDays = 29;
  for (const invalid of [
    missingRuler, duplicateRuler, unknownRuler, emptyRuler, whitespaceRuler, nonStringRuler, reorderedRulers, rulerShortName,
    missingOrdinal, duplicateOrdinal, unknownOrdinal, emptyOrdinal, whitespaceOrdinal, nonStringOrdinal, reorderedOrdinals,
    missingName, emptyName, whitespaceName, nonStringName,
    staticMonths, mechanicalSkip, mechanicalDuration
  ]) assert.throws(() => validateNomenclature(invalid));
});

test('lunar-cycle nomenclature requires exactly one non-empty name', async () => {
  const valid = await readJson(nomenclaturePath);
  const missingCycle = structuredClone(valid); delete missingCycle.lunarCycle;
  const missingName = structuredClone(valid); delete missingName.lunarCycle.name;
  const empty = structuredClone(valid); empty.lunarCycle.name = '';
  const whitespace = structuredClone(valid); whitespace.lunarCycle.name = '   ';
  const nonString = structuredClone(valid); nonString.lunarCycle.name = 1234;
  const id = structuredClone(valid); id.lunarCycle.id = 'lunar-cycle-01';
  const label = structuredClone(valid); label.lunarCycle.label = 'Cycle';
  const cycleName = structuredClone(valid); cycleName.lunarCycle.cycleName = 'Cycle';
  const mechanical = structuredClone(valid); mechanical.lunarCycle.durationDays = 13;
  for (const invalid of [missingCycle, missingName, empty, whitespace, nonString, id, label, cycleName, mechanical]) {
    assert.throws(() => validateNomenclature(invalid));
  }
});

test('calendar nomenclature requires exactly one non-empty yearName', async () => {
  const valid = await readJson(nomenclaturePath);
  const missing = structuredClone(valid); delete missing.calendar.yearName;
  const empty = structuredClone(valid); empty.calendar.yearName = '';
  const whitespace = structuredClone(valid); whitespace.calendar.yearName = '   ';
  const nonString = structuredClone(valid); nonString.calendar.yearName = 62;
  const yearLabel = structuredClone(valid); yearLabel.calendar.yearLabel = 'Year';
  const eraName = structuredClone(valid); eraName.calendar.eraName = 'Era';
  for (const invalid of [missing, empty, whitespace, nonString, yearLabel, eraName]) {
    assert.throws(() => validateNomenclature(invalid));
  }
});

test('weekday nomenclature requires exact canonical id and name entities', async () => {
  const valid = await readJson(nomenclaturePath);
  assert.deepEqual(validateNomenclature(valid).calendar.weekdays, [
    { id: 'weekday-01', name: 'Dies Lunae' },
    { id: 'weekday-02', name: 'Dies Martis' },
    { id: 'weekday-03', name: 'Dies Mercurii' },
    { id: 'weekday-04', name: 'Dies Iovis' },
    { id: 'weekday-05', name: 'Dies Veneris' },
    { id: 'weekday-06', name: 'Dies Saturni' },
    { id: 'weekday-07', name: 'Dies Solis' }
  ]);
  assert.ok(valid.calendar.weekdays.every((weekday) => {
    const keys = Object.keys(weekday).sort();
    return keys.length === 2 && keys[0] === 'id' && keys[1] === 'name';
  }));

  const missing = structuredClone(valid); missing.calendar.weekdays.pop();
  const duplicate = structuredClone(valid); duplicate.calendar.weekdays[1].id = 'weekday-01';
  const unknown = structuredClone(valid); unknown.calendar.weekdays[1].id = 'weekday-99';
  const missingName = structuredClone(valid); delete missingName.calendar.weekdays[0].name;
  const emptyName = structuredClone(valid); emptyName.calendar.weekdays[0].name = '';
  const nonStringName = structuredClone(valid); nonStringName.calendar.weekdays[0].name = 7;
  const formerShortName = structuredClone(valid); formerShortName.calendar.weekdays[0].shortName = 'DL';
  const symbol = structuredClone(valid); symbol.calendar.weekdays[0].symbol = '☾';
  const additional = structuredClone(valid); additional.calendar.weekdays[0].description = 'first';
  for (const invalid of [missing, duplicate, unknown, missingName, emptyName, nonStringName, formerShortName, symbol, additional]) {
    assert.throws(() => validateNomenclature(invalid));
  }
});

test('nomenclature page names require exact IDs, valid names, and no route fields', async () => {
  const valid = await readJson(nomenclaturePath);
  const missing = structuredClone(valid); missing.pages.pop();
  const duplicate = structuredClone(valid); duplicate.pages[2].id = 'page-02';
  const unknown = structuredClone(valid); unknown.pages[2].id = 'page-99';
  const empty = structuredClone(valid); empty.pages[0].name = '';
  const nonString = structuredClone(valid); nonString.pages[0].name = 7;
  const route = structuredClone(valid); route.pages[0].route = '/other.html';
  const page10 = structuredClone(valid); page10.pages.push({ id: 'page-10', name: 'Observationes' });
  const page11 = structuredClone(valid); page11.pages.push({ id: 'page-11', name: 'Decisiones' });
  for (const invalid of [missing, duplicate, unknown, empty, nonString, route, page10, page11]) {
    assert.throws(() => validateNomenclature(invalid));
  }
});

test('navigation-group nomenclature requires exact canonical name-only entities', async () => {
  const valid = await readJson(nomenclaturePath);
  assert.deepEqual(validateNomenclature(valid).navigationGroups, [
    { id: 'navigation-group-01', name: 'Almanac' },
    { id: 'navigation-group-02', name: 'Personage' },
    { id: 'navigation-group-03', name: 'Location' }
  ]);
  const missingCollection = structuredClone(valid); delete missingCollection.navigationGroups;
  const missingEntity = structuredClone(valid); missingEntity.navigationGroups.pop();
  const duplicate = structuredClone(valid); duplicate.navigationGroups[1].id = 'navigation-group-01';
  const unknown = structuredClone(valid); unknown.navigationGroups[0].id = 'navigation-group-99';
  const reordered = structuredClone(valid); reordered.navigationGroups.reverse();
  const empty = structuredClone(valid); empty.navigationGroups[0].name = '';
  const nonString = structuredClone(valid); nonString.navigationGroups[0].name = 1;
  const additional = structuredClone(valid); additional.navigationGroups[0].description = 'Group';
  const route = structuredClone(valid); route.navigationGroups[0].route = '/almanac.html';
  const children = structuredClone(valid); children.navigationGroups[0].pageIds = ['page-01'];
  for (const invalid of [missingCollection, missingEntity, duplicate, unknown, reordered, empty, nonString, additional, route, children]) {
    assert.throws(() => validateNomenclature(invalid));
  }
});

test('page sections and Outcome types are exact nomenclature while location data is excluded', async () => {
  const valid = await readJson(nomenclaturePath);
  const value = validateNomenclature(valid);
  assert.deepEqual(value.pageSections.map(({ name }) => name), [
    'Titulo', 'Nomine', 'Epitheto', 'Equipamento', 'Observationes', 'Decisiones',
    'Memorias', 'Campiones', 'Miniones', 'Deposito'
  ]);
  for (const removed of ['Inventario', 'Investigationes', 'Ordines']) {
    assert.equal(value.pageSections.some(({ name }) => name === removed), false, removed);
  }
  assert.deepEqual(value.outcomeTypes.map(({ name }) => name), ['Commune', 'Infrequens', 'Rarum']);
  assert.equal(Object.hasOwn(value, 'location'), false);
  assert.equal(Object.hasOwn(value, 'mappa'), false);

  const invalidValues = [];
  for (const key of ['pageSections', 'outcomeTypes']) {
    const missing = structuredClone(valid); missing[key].pop(); invalidValues.push(missing);
    const duplicate = structuredClone(valid); duplicate[key][1].id = duplicate[key][0].id; invalidValues.push(duplicate);
    const reordered = structuredClone(valid); reordered[key].reverse(); invalidValues.push(reordered);
    const empty = structuredClone(valid); empty[key][0].name = ''; invalidValues.push(empty);
    const extra = structuredClone(valid); extra[key][0].mechanics = true; invalidValues.push(extra);
  }
  const legacyLocation = structuredClone(valid); legacyLocation.location = { currentLocation: { id: 'location-01', name: 'Santiago' } }; invalidValues.push(legacyLocation);
  const mappaCompatibility = structuredClone(valid); mappaCompatibility.mappa = { currentLocation: { id: 'location-01', name: 'Santiago' } }; invalidValues.push(mappaCompatibility);
  const missingObservationes = structuredClone(valid); missingObservationes.pageSections.splice(4, 1); invalidValues.push(missingObservationes);
  const missingDecisiones = structuredClone(valid); missingDecisiones.pageSections.splice(5, 1); invalidValues.push(missingDecisiones);
  const investigationes = structuredClone(valid); investigationes.pageSections.push({ id: 'page-section-08', name: 'Investigationes' }); invalidValues.push(investigationes);
  const ordines = structuredClone(valid); ordines.pageSections.push({ id: 'page-section-10', name: 'Ordines' }); invalidValues.push(ordines);
  for (const invalid of invalidValues) assert.throws(() => validateNomenclature(invalid));
});

test('nomenclature rejects locale data, mechanics, and extra keys', async () => {
  const valid = await readJson(nomenclaturePath);
  for (const [key, value] of [
    ['messages', {}], ['durationDays', 179],
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

test('missing or invalid nomenclature prevents rendering and shows the fixed Interlingua accessible error', async (t) => {
  t.mock.method(console, 'error', () => {});
  const valid = await readJson(nomenclaturePath);
  const invalid = structuredClone(valid); invalid.calendar.monthReign.rulers.pop();
  const invalidWeekday = structuredClone(valid); invalidWeekday.calendar.weekdays[0].symbol = '☾';
  const invalidYearName = structuredClone(valid); invalidYearName.calendar.yearName = '';
  const invalidLunarCycle = structuredClone(valid); invalidLunarCycle.lunarCycle.name = '';
  for (const replacement of ['missing', invalid, invalidWeekday, invalidYearName, invalidLunarCycle]) {
    const documentRoot = configurationErrorDocument();
    let rendererCreated = false;
    const result = await bootstrapPage('page-01', () => { rendererCreated = true; }, {
      documentRoot,
      locationLike: { href: 'http://app.test/calendario.html?locale=es' },
      fetchFn: localFetch(new Map([[NOMENCLATURE_PATH, replacement]]))
    });
    assert.equal(result, null);
    assert.equal(rendererCreated, false);
    assert.equal(documentRoot.documentElement.attributes['aria-busy'], undefined);
    assert.equal(documentRoot.documentElement.lang, 'ia');
    assert.equal(documentRoot.body.children[0].attributes.role, 'alert');
    assert.equal(
      documentRoot.body.children[0].children[0].textContent,
      'Impossibile cargar le configuration del application.'
    );
  }
});

test('app bootstrap loads fixed nomenclature directly without localization infrastructure', async () => {
  const source = await readFile(path.join(publicDirectory, 'app-bootstrap.js'), 'utf8');
  assert.match(source, /import \{ loadNomenclature \} from '\.\/nomenclature-loader\.js'/);
  assert.match(source, /import \{ createPresentationContext \} from '\.\/nomenclature\.js'/);
  assert.doesNotMatch(source, /loadLocale|loadPresentationContext|requestedPresentationOptions/);
});

test('static bootstrap applies shared presentation without starting a recurring timer', async (t) => {
  const makeElement = (dataset = {}) => ({
    dataset, attributes: {}, textContent: '',
    setAttribute(name, value) { this.attributes[name] = value; }
  });
  const links = Array.from({ length: 9 }, (_, index) => makeElement({
    pageId: `page-${String(index + 1).padStart(2, '0')}`
  }));
  const pageName = makeElement();
  const section = makeElement({ pageSectionId: 'page-section-01' });
  const message = makeElement({ messageKey: 'label.currentLocation' });
  const application = makeElement();
  const version = makeElement();
  const epoch = makeElement();
  const nav = makeElement();
  const meta = makeElement();
  const selectorLists = new Map([
    ['[data-page-id]', links], ['[data-page-name]', [pageName]],
    ['[data-page-section-id]', [section]],
    ['[data-message-key]', [message]], ['[data-application-name]', [application]],
    ['[data-version]', [version]], ['[data-epoch]', [epoch]]
  ]);
  const documentRoot = {
    title: '',
    documentElement: makeElement(),
    querySelector(selector) {
      if (selector === 'meta[name="description"]') return meta;
      if (selector === '.primary-nav') return nav;
      return null;
    },
    querySelectorAll(selector) { return selectorLists.get(selector) ?? []; }
  };
  const requests = [];
  const timeoutMock = t.mock.method(globalThis, 'setTimeout', () => assert.fail('static bootstrap must not schedule a timer'));
  const result = await bootstrapStaticPage('page-04', {
    documentRoot,
    locationLike: { href: 'http://app.test/identitate.html?locale=es' },
    fetchFn: localFetch(new Map(), requests)
  });
  assert.ok(result);
  assert.equal(timeoutMock.mock.callCount(), 0);
  assert.equal(documentRoot.documentElement.attributes['aria-busy'], 'false');
  assert.equal(documentRoot.documentElement.lang, 'ia');
  assert.equal(documentRoot.title, 'Identitate · Insidia');
  assert.equal(meta.attributes.content, 'Profilo e historia del persona pro Insidia.');
  assert.equal(links[6].textContent, 'Locus');
  assert.equal(links[6].attributes.href, '/locus.html');
  assert.equal(pageName.textContent, 'Identitate');
  assert.equal(section.textContent, 'Titulo');
  assert.equal(message.textContent, 'Loco actual');
  assert.equal(application.textContent, 'Insidia');
  assert.equal(version.textContent, 'v8.24');
  assert.match(epoch.textContent, /1970-01-01 00:00:00 UTC/);
  assert.deepEqual(requests, [NOMENCLATURE_PATH]);
});

test('fixed interface exports exactly the production-used Interlingua keys', () => {
  const expectedMessageKeys = [
    'nav.aria', 'section.time', 'section.season', 'section.tide', 'section.pulls',
    'section.orbits', 'section.progress', 'label.day', 'label.hour', 'label.cycle',
    'label.orbit', 'label.seasonalDay', 'label.next', 'label.progress',
    'label.currentFictionalTime', 'label.currentLunarTime', 'label.currentLunarDay',
    'label.currentDay', 'label.currentHour', 'label.currentTideProgress',
    'label.attemptsUntilRare', 'label.orbitalProgress', 'label.circularSpan',
    'label.alignment', 'label.currentLocation', 'label.region', 'label.elevation',
    'label.localRoutes', 'label.interRegionalRoutes', 'label.routesFrom',
    'label.destination', 'label.destinationRegion', 'label.exitPoint', 'label.entryPoint',
    'label.travelTime', 'label.elevationChange', 'label.epoch', 'status.tieBreakApplied',
    'status.noAvailableLocalRoutes', 'status.noAvailableInterRegionRoutes',
    'selection.selection-rule-01', 'selection.selection-rule-02', 'selection.selection-rule-03',
    'clarification.pulls', 'accessibility.applicationVersion',
    'accessibility.seasonProgress', 'error.configuration'
  ];
  const expectedTemplateKeys = [
    'document.title', 'document.page-01Description', 'document.page-02Description',
    'document.page-03Description', 'document.page-04Description',
    'document.page-05Description', 'document.page-06Description',
    'document.page-07Description', 'document.page-08Description',
    'document.page-09Description', 'accessibility.version',
    'accessibility.orbitProgress', 'calendar.formattedYear',
    'calendar.firstMonthReign', 'calendar.repeatedMonthReign',
    'calendar.monthPeriod', 'calendar.interPeriod', 'calendar.formattedDate',
    'lunar.summary', 'season.metadata', 'season.cycle', 'season.next',
    'season.progress', 'tide.metadata', 'tide.time', 'outcome.attempts',
    'outcome.source', 'outcome.progress', 'orbit.calendarPeriod',
    'orbit.lunarPeriod', 'orbit.metadata', 'pull.span', 'pull.alignment',
    'pull.tie', 'pull.noTie', 'route.fictionalMinutes', 'route.directionalPoint',
    'footer.epoch'
  ];
  assert.deepEqual(Object.keys(INTERFACE_MESSAGES), expectedMessageKeys);
  assert.deepEqual(Object.keys(INTERFACE_TEMPLATES), expectedTemplateKeys);
  assert.equal(INTERFACE_MESSAGES['nav.aria'], 'Navigation principal');
  assert.equal(INTERFACE_MESSAGES['label.currentLocation'], 'Loco actual');
  assert.equal(INTERFACE_TEMPLATES['route.fictionalMinutes'], '{value} minutas fictional');
  for (const removedKey of [
    'section.json', 'label.copyJson', 'status.copied', 'status.copyFailure',
    'accessibility.copyStatus', 'label.year', 'label.month', 'label.week', 'pull.members'
  ]) {
    assert.equal(Object.hasOwn(INTERFACE_MESSAGES, removedKey), false, removedKey);
    assert.equal(Object.hasOwn(INTERFACE_TEMPLATES, removedKey), false, removedKey);
  }
  assert.doesNotMatch(JSON.stringify({ INTERFACE_MESSAGES, INTERFACE_TEMPLATES }), /Morditura|Cyclus Lunae|Kalendis|Interregis/);
});

test('fixed interface values contain no nomenclature- or world-owned visible terms', async () => {
  const nomenclature = await readJson(nomenclaturePath);
  const world = await readJson(path.join(publicDirectory, 'regions', 'world.json'));
  const interfaceValues = Object.values({ ...INTERFACE_MESSAGES, ...INTERFACE_TEMPLATES }).join('\n');
  const visibleTerms = [
    nomenclature.application.displayName,
    nomenclature.calendar.yearName,
    nomenclature.calendar.monthReign.name,
    nomenclature.lunarCycle.name,
    ...[
      'pages', 'navigationGroups', 'pageSections', 'outcomeTypes', 'seasons',
      'lunarPhases', 'tides', 'celestialBodies', 'pulls'
    ].flatMap((key) => nomenclature[key].flatMap(({ name, symbol }) => [name, symbol].filter(Boolean))),
    ...['rulers', 'ordinals'].flatMap((key) => nomenclature.calendar.monthReign[key].map(({ name }) => name)),
    ...['weekdays', 'namedDays', 'interRegna'].flatMap((key) => nomenclature.calendar[key].map(({ name }) => name)),
    ...Object.values(world.regions).flatMap((region) => [
      region.regionName,
      region.description,
      ...Object.values(region.locations).flatMap(({ name, description }) => [name, description]),
      ...region.routes.map(({ name }) => name)
    ]),
    ...world.interRegionRoutes.map(({ routeName }) => routeName)
  ];
  for (const term of visibleTerms) {
    assert.equal(interfaceValues.includes(term), false, term);
  }
});

test('template formatter replaces named values and rejects missing values', () => {
  assert.equal(formatTemplate('{dayLabel} {day}', { dayLabel: 'Day', day: 2 }), 'Day 2');
  assert.throws(() => formatTemplate('{dayLabel} {day}', { dayLabel: 'Day' }), /Missing template value/);
});
