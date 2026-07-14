import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { bootstrapPage, bootstrapStaticPage } from '../public/app-bootstrap.js';
import { DEFAULT_LOCALE_ID, LOCALE_FILES, MESSAGE_KEYS, TEMPLATE_KEYS, loadLocale, validateLocale } from '../public/locale-loader.js';
import { loadNomenclature, NOMENCLATURE_PATH, validateNomenclature } from '../public/nomenclature-loader.js';
import { loadPresentationContext, requestedPresentationOptions } from '../public/presentation-context-loader.js';
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

test('locale index is removed and supported locale files are fixed in the loader registry', async () => {
  await assert.rejects(access(path.join(publicDirectory, 'locales', 'index.json')));
  assert.equal(DEFAULT_LOCALE_ID, 'en');
  assert.deepEqual(LOCALE_FILES, { en: '/locales/en.json', es: '/locales/es.json' });
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

test('missing or invalid nomenclature prevents rendering and shows a localized accessible error', async (t) => {
  t.mock.method(console, 'error', () => {});
  const valid = await readJson(nomenclaturePath);
  const invalid = structuredClone(valid); invalid.calendar.monthReign.rulers.pop();
  const invalidWeekday = structuredClone(valid); invalidWeekday.calendar.weekdays[0].symbol = '☾';
  const invalidYearName = structuredClone(valid); invalidYearName.calendar.yearName = '';
  const invalidLunarCycle = structuredClone(valid); invalidLunarCycle.lunarCycle.name = '';
  for (const replacement of ['missing', invalid, invalidWeekday, invalidYearName, invalidLunarCycle]) {
    for (const [localeId, message, languageTag] of [
      ['en', 'Unable to load the application or locale configuration.', 'en'],
      ['es', 'No se pudo cargar la configuración de la aplicación o del idioma.', 'es']
    ]) {
      const documentRoot = configurationErrorDocument();
      let rendererCreated = false;
      const result = await bootstrapPage('page-01', () => { rendererCreated = true; }, {
        documentRoot,
        locationLike: { href: `http://app.test/calendario.html?locale=${localeId}` },
        fetchFn: localFetch(new Map([[NOMENCLATURE_PATH, replacement]]))
      });
      assert.equal(result, null);
      assert.equal(rendererCreated, false);
      assert.equal(documentRoot.documentElement.attributes['aria-busy'], undefined);
      assert.equal(documentRoot.documentElement.lang, languageTag);
      assert.equal(documentRoot.body.children[0].attributes.role, 'alert');
      assert.equal(documentRoot.body.children[0].children[0].textContent, message);
    }
  }
});

test('locale failure uses the minimal emergency English configuration error', async (t) => {
  t.mock.method(console, 'error', () => {});
  const documentRoot = configurationErrorDocument();
  const result = await bootstrapPage('page-01', () => assert.fail('renderer must not start'), {
    documentRoot,
    locationLike: { href: 'http://app.test/calendario.html?locale=es' },
    fetchFn: localFetch(new Map([['/locales/es.json', 'malformed']]))
  });
  assert.equal(result, null);
  assert.equal(documentRoot.documentElement.lang, 'en');
  assert.equal(documentRoot.body.children[0].children[0].textContent, 'Unable to load application configuration.');
});

test('locale-only query parsing defaults, resolves Spanish, and ignores all other parameters', () => {
  assert.deepEqual(requestedPresentationOptions('http://app.test/calendario.html'), { requestedLocaleId: undefined });
  assert.deepEqual(requestedPresentationOptions('http://app.test/calendario.html?locale=es'), { requestedLocaleId: 'es' });
  assert.deepEqual(requestedPresentationOptions('http://app.test/calendario.html?universe=other&locale=es&unused=x'), { requestedLocaleId: 'es' });
});

test('locale loader performs exactly one allowlisted request for default, Spanish, and unknown IDs', async () => {
  for (const [requestedId, expectedPath, expectedRequestedId, expectedResolvedId] of [
    [undefined, '/locales/en.json', 'en', 'en'],
    ['en', '/locales/en.json', 'en', 'en'],
    ['es', '/locales/es.json', 'es', 'es'],
    ['unknown', '/locales/en.json', 'unknown', 'en'],
    ['../config/nomenclature', '/locales/en.json', '../config/nomenclature', 'en']
  ]) {
    const requests = [];
    const result = await loadLocale({
      requestedId,
      fetchFn: localFetch(new Map(), requests),
      baseUrl: 'http://app.test/calendario.html'
    });
    assert.deepEqual(requests, [expectedPath]);
    assert.equal(result.requestedLocaleId, expectedRequestedId);
    assert.equal(result.resolvedLocaleId, expectedResolvedId);
  }
});

test('locale and nomenclature begin concurrently with exactly two configuration requests', async () => {
  const localeValues = {
    en: await readJson(path.join(publicDirectory, 'locales', 'en.json')),
    es: await readJson(path.join(publicDirectory, 'locales', 'es.json'))
  };
  const nomenclature = await readJson(nomenclaturePath);
  for (const localeId of ['en', 'es']) {
    const requests = [];
    const pending = new Map();
    const fetchFn = (url, options) => {
      assert.equal(options.cache, 'no-cache');
      const pathname = new URL(url).pathname;
      requests.push(pathname);
      return new Promise((resolve) => pending.set(pathname, resolve));
    };
    const contextPromise = loadPresentationContext(
      `http://app.test/calendario.html?locale=${localeId}`,
      { fetchFn }
    );
    assert.deepEqual(requests.sort(), [`/locales/${localeId}.json`, NOMENCLATURE_PATH].sort());
    assert.equal(requests.length, 2);
    assert.equal(requests.includes('/locales/index.json'), false);
    pending.get(`/locales/${localeId}.json`)({ ok: true, json: async () => structuredClone(localeValues[localeId]) });
    pending.get(NOMENCLATURE_PATH)({ ok: true, json: async () => structuredClone(nomenclature) });
    const context = await contextPromise;
    assert.equal(context.resolvedLocaleId, localeId);
    assert.equal(context.applicationDisplayName, 'Insidia');
  }
});

test('app bootstrap delegates presentation-resource loading to the shared orchestrator only', async () => {
  const source = await readFile(path.join(publicDirectory, 'app-bootstrap.js'), 'utf8');
  assert.match(source, /import \{ loadPresentationContext \} from '\.\/presentation-context-loader\.js'/);
  assert.doesNotMatch(source, /loadLocale|loadNomenclature|createPresentationContext|requestedPresentationOptions/);
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
  const timeoutMock = t.mock.method(globalThis, 'setTimeout', () => assert.fail('static bootstrap must not schedule a timer'));
  const result = await bootstrapStaticPage('page-04', {
    documentRoot,
    locationLike: { href: 'http://app.test/identitate.html?locale=es' },
    fetchFn: localFetch()
  });
  assert.ok(result);
  assert.equal(timeoutMock.mock.callCount(), 0);
  assert.equal(documentRoot.documentElement.attributes['aria-busy'], 'false');
  assert.equal(documentRoot.documentElement.lang, 'es');
  assert.equal(documentRoot.title, 'Identitate · Insidia');
  assert.equal(meta.attributes.content, 'Título, nombre, epíteto, memorias y decisiones del personaje para Insidia.');
  assert.equal(links[6].textContent, 'Locus');
  assert.equal(links[6].attributes.href, '/locus.html?locale=es');
  assert.equal(pageName.textContent, 'Identitate');
  assert.equal(section.textContent, 'Titulo');
  assert.equal(message.textContent, 'Ubicación actual');
  assert.equal(application.textContent, 'Insidia');
  assert.equal(version.textContent, 'v8.21');
  assert.match(epoch.textContent, /1970-01-01 00:00:00 UTC/);
});

test('locale schema 11 contains only localized UI language and exact page descriptions', async () => {
  const english = validateLocale(await readJson(path.join(publicDirectory, 'locales', 'en.json')));
  const spanish = validateLocale(await readJson(path.join(publicDirectory, 'locales', 'es.json')));
  assert.equal(english.schemaVersion, 11);
  assert.equal(spanish.schemaVersion, 11);
  assert.deepEqual(Object.keys(english).sort(), ['id', 'languageTag', 'messages', 'schemaVersion', 'templates']);
  assert.deepEqual(Object.keys(spanish).sort(), ['id', 'languageTag', 'messages', 'schemaVersion', 'templates']);
  assert.equal(Object.hasOwn(english, 'outcomeTypes'), false);
  assert.equal(Object.hasOwn(spanish, 'outcomeTypes'), false);
  assert.equal(english.messages['label.currentTideProgress'], 'Current Tide Progress');
  assert.equal(spanish.messages['label.currentTideProgress'], 'Progreso de la marea actual');
  assert.equal(english.messages['label.currentHour'], 'Current Hour');
  assert.equal(spanish.messages['label.currentHour'], 'Hora actual');
  assert.equal(english.messages['label.currentLocation'], 'Current Location');
  assert.equal(spanish.messages['label.currentLocation'], 'Ubicación actual');
  assert.deepEqual(
    [
      english.messages['label.region'], english.messages['label.elevation'],
      english.messages['label.routesFrom'], english.messages['label.destination'],
      english.messages['label.walkingTime'], english.messages['label.elevationChange'],
      english.messages['status.noAvailableRoutes']
    ],
    ['Region', 'Elevation', 'Routes from', 'Destination', 'Walking time', 'Elevation change', 'No available routes.']
  );
  assert.deepEqual(
    [
      spanish.messages['label.region'], spanish.messages['label.elevation'],
      spanish.messages['label.routesFrom'], spanish.messages['label.destination'],
      spanish.messages['label.walkingTime'], spanish.messages['label.elevationChange'],
      spanish.messages['status.noAvailableRoutes']
    ],
    ['Región', 'Elevación', 'Rutas desde', 'Destino', 'Tiempo a pie', 'Cambio de elevación', 'No hay rutas disponibles.']
  );
  assert.equal(
    english.templates['document.page-02Description'],
    'Live selected outcome, tides, tide progress, pulls, and celestial orbits for {applicationName}.'
  );
  assert.equal(
    spanish.templates['document.page-02Description'],
    'Resultado seleccionado, mareas, progreso de la marea, fuerzas y órbitas celestes en vivo para {applicationName}.'
  );
  assert.equal(MESSAGE_KEYS.includes('label.currentTideProgress'), true);
  assert.equal(MESSAGE_KEYS.includes('label.currentHour'), true);
  assert.equal(MESSAGE_KEYS.includes('label.currentLocation'), true);
  assert.deepEqual(
    [
      english.templates['document.page-04Description'],
      english.templates['document.page-05Description'],
      english.templates['document.page-06Description'],
      english.templates['document.page-07Description'],
      english.templates['document.page-08Description'],
      english.templates['document.page-09Description']
    ],
    [
      'Character title, name, epithet, memories, and decisions for {applicationName}.',
      'Character equipment and storage for {applicationName}.',
      "Champions and minions under the character's command for {applicationName}.",
      'Current location for {applicationName}.',
      'Routes from the current location for {applicationName}.',
      'Exploration observations for {applicationName}.'
    ]
  );
  assert.deepEqual(
    [
      spanish.templates['document.page-04Description'],
      spanish.templates['document.page-05Description'],
      spanish.templates['document.page-06Description'],
      spanish.templates['document.page-07Description'],
      spanish.templates['document.page-08Description'],
      spanish.templates['document.page-09Description']
    ],
    [
      'Título, nombre, epíteto, memorias y decisiones del personaje para {applicationName}.',
      'Equipo y depósito del personaje para {applicationName}.',
      'Campeones y esbirros bajo el mando del personaje para {applicationName}.',
      'Ubicación actual para {applicationName}.',
      'Rutas desde la ubicación actual para {applicationName}.',
      'Observaciones de exploración para {applicationName}.'
    ]
  );
  const calendarTemplates = {
    'calendar.formattedYear': '{yearName} {yearRoman}',
    'calendar.firstMonthReign': '{reignName} {rulerName}',
    'calendar.repeatedMonthReign': '{ordinalName} {reignName} {rulerName}',
    'calendar.monthPeriod': '{weekdayName} {dayDesignation} · {monthName}',
    'calendar.interPeriod': '{weekdayName} {dayDesignation} · {interRegnumName}',
    'calendar.formattedDate': '{formattedYear} · {periodLabel}'
  };
  for (const locale of [english, spanish]) {
    for (const [key, value] of Object.entries(calendarTemplates)) assert.equal(locale.templates[key], value, key);
    assert.equal(Object.hasOwn(locale.templates, 'calendar.metadata'), false);
    assert.equal(locale.templates['lunar.summary'], '{phaseName} • {cycleName} {cycleRoman}');
    assert.equal(Object.hasOwn(locale.templates, 'lunar.metadata'), false);
    assert.equal(Object.hasOwn(locale.templates, 'outcome.type'), false);
    for (const key of ['section.lunar', 'label.phase', 'label.lunarDay']) assert.equal(Object.hasOwn(locale.messages, key), false, key);
    assert.equal(locale.messages['label.cycle'] !== undefined, true);
    assert.doesNotMatch(JSON.stringify(locale), /Morditura|Cyclus Lunae/);
    assert.doesNotMatch(JSON.stringify(locale), /Kalendis|Nonis|Idibus|Liminis|Interregis|Primus Interregno/);
    assert.doesNotMatch(JSON.stringify(locale), /dayRoman/);
    for (const name of ['Personage','Identitate','Inventario','Subordinatos','Observationes','Decisiones','Equipamento','Deposito','Campiones','Miniones']) {
      assert.equal(Object.values(locale.messages).includes(name), false, name);
    }
  }
  for (const key of ['section.lunar', 'label.phase', 'label.lunarDay']) assert.equal(MESSAGE_KEYS.includes(key), false, key);
  assert.equal(MESSAGE_KEYS.includes('label.cycle'), true);
  assert.equal(TEMPLATE_KEYS.includes('lunar.metadata'), false);
  assert.equal(TEMPLATE_KEYS.includes('lunar.summary'), true);
  assert.equal(TEMPLATE_KEYS.includes('outcome.type'), false);
  for (const key of ['document.page-10Description', 'document.page-11Description']) {
    assert.equal(TEMPLATE_KEYS.includes(key), false, key);
    assert.equal(Object.hasOwn(english.templates, key), false, key);
    assert.equal(Object.hasOwn(spanish.templates, key), false, key);
  }
  for (const locale of [english, spanish]) {
    for (const key of ['nav.calendar','nav.outcome','nav.weather','page.calendar','page.outcome','page.weather','label.outcome']) {
      assert.equal(Object.hasOwn(locale.messages, key), false, key);
    }
  }
  for (const mutate of [
    (locale) => { locale.outcomeTypes = {}; },
    (locale) => { locale.extra = true; },
    (locale) => { delete locale.messages['label.currentLocation']; },
    (locale) => { locale.templates['outcome.type'] = '{name}'; },
    (locale) => { locale.templates['document.page-10Description'] = 'Unexpected'; },
    (locale) => { locale.templates['document.page-11Description'] = 'Unexpected'; },
    (locale) => { locale.schemaVersion = 10; }
  ]) {
    const invalid = structuredClone(spanish);
    mutate(invalid);
    await assert.rejects(() => loadLocale({ requestedId: 'es', fetchFn: localFetch(new Map([['/locales/es.json', invalid]])), baseUrl: 'http://app.test/' }));
  }
  const mismatched = structuredClone(spanish); mismatched.id = 'en';
  await assert.rejects(
    () => loadLocale({ requestedId: 'es', fetchFn: localFetch(new Map([['/locales/es.json', mismatched]])), baseUrl: 'http://app.test/' }),
    /Locale ID does not match registry/
  );
});

test('template formatter replaces named values and rejects missing values', () => {
  assert.equal(formatTemplate('{dayLabel} {day}', { dayLabel: 'Day', day: 2 }), 'Day 2');
  assert.throws(() => formatTemplate('{dayLabel} {day}', { dayLabel: 'Day' }), /Missing template value/);
});
