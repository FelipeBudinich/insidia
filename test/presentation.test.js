import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { calculateCalendarState, calculateMonthRulershipState } from '../public/core/mechanics.js';
import {
  FICTIONAL_SECONDS_PER_DAY,
  LUNAR_DAYS_PER_CYCLE,
  LUNAR_SECONDS_PER_DAY,
  REAL_MS_PER_FICTIONAL_SECOND,
  REAL_MS_PER_LUNAR_SECOND
} from '../public/core/rules.js';
import { validateNomenclature } from '../public/nomenclature-loader.js';
import { createPresentationContext } from '../public/nomenclature.js';
import { NAVIGATION_GROUP_IDS, PAGE_DEFINITIONS, PAGE_IDS, PAGE_SECTION_IDS } from '../public/page-definitions.js';
import {
  createCalendarJson,
  createDisplayData,
  formatCalendarDayDesignation,
  formatFictionalYear,
  formatLunarSummary,
  formatMonthReignName
} from '../public/presentation.js';
import {
  createOutcomeRenderer,
  createSeasonRenderer,
  createTideProgressRenderer,
  createWeatherProgressRenderer,
  formatAttemptsUntilRare
} from '../public/renderers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (...parts) => JSON.parse(await readFile(path.join(root, ...parts), 'utf8'));
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const containsProperNoun = (source, name) => new RegExp(`(?<![\\p{L}])${escapeRegExp(name)}(?![\\p{L}])`, 'u').test(source);
const weekdayDayMilliseconds = FICTIONAL_SECONDS_PER_DAY * REAL_MS_PER_FICTIONAL_SECOND;
const representativeLunarDays = ((1234 - 1) * LUNAR_DAYS_PER_CYCLE) + 8;
const representativeLunarTimestamp = representativeLunarDays
  * LUNAR_SECONDS_PER_DAY
  * REAL_MS_PER_LUNAR_SECOND;
const LUNAR_PHASE_NAMES = Object.freeze([
  'Renascimento', 'Corno', 'Falce', 'Passage', 'Ascrescimento', 'Crescente', 'Ascenso',
  'Apice', 'Morditura', 'Decrescente', 'Recedente', 'Velo', 'Morte'
]);
const MONTH_RULERS = Object.freeze([
  { id: 'ruler-01', name: 'Orgolio' }, { id: 'ruler-02', name: 'Rabia' },
  { id: 'ruler-03', name: 'Gula' }, { id: 'ruler-04', name: 'Invidia' },
  { id: 'ruler-05', name: 'Avaritia' }, { id: 'ruler-06', name: 'Vanitate' },
  { id: 'ruler-07', name: 'Luxuria' }, { id: 'ruler-08', name: 'Pigritia' }
]);
const REIGN_ORDINALS = Object.freeze([
  { id: 'reign-ordinal-01', name: 'Prime' }, { id: 'reign-ordinal-02', name: 'Secunde' },
  { id: 'reign-ordinal-03', name: 'Tertie' }, { id: 'reign-ordinal-04', name: 'Quarte' },
  { id: 'reign-ordinal-05', name: 'Quinte' }, { id: 'reign-ordinal-06', name: 'Sexte' },
  { id: 'reign-ordinal-07', name: 'Septime' }, { id: 'reign-ordinal-08', name: 'Octave' },
  { id: 'reign-ordinal-09', name: 'None' }, { id: 'reign-ordinal-10', name: 'Decime' },
  { id: 'reign-ordinal-11', name: 'Undecime' }
]);
const WEEKDAYS = Object.freeze([
  { id: 'weekday-01', name: 'Dies Lunae' },
  { id: 'weekday-02', name: 'Dies Martis' },
  { id: 'weekday-03', name: 'Dies Mercurii' },
  { id: 'weekday-04', name: 'Dies Iovis' },
  { id: 'weekday-05', name: 'Dies Veneris' },
  { id: 'weekday-06', name: 'Dies Saturni' },
  { id: 'weekday-07', name: 'Dies Solis' }
]);
const NAMED_DAYS = Object.freeze([
  { id: 'named-day-01', name: 'Kalendis' },
  { id: 'named-day-02', name: 'Nonis' },
  { id: 'named-day-03', name: 'Idibus' },
  { id: 'named-day-04', name: 'Liminis' },
  { id: 'named-day-05', name: 'Interregis' }
]);
const INTERREGNOS = Object.freeze([
  { id: 'interregnum-01', name: 'Primus Interregno' },
  { id: 'interregnum-02', name: 'Secundus Interregno' },
  { id: 'interregnum-03', name: 'Tertius Interregno' },
  { id: 'interregnum-04', name: 'Quartus Interregno' },
  { id: 'interregnum-05', name: 'Quintus Interregno' },
  { id: 'interregnum-06', name: 'Sextus Interregno' },
  { id: 'interregnum-07', name: 'Septimus Interregno' },
  { id: 'interregnum-08', name: 'Octavus Interregno' },
  { id: 'interregnum-09', name: 'Nonus Interregno' },
  { id: 'interregnum-10', name: 'Decimus Interregno' },
  { id: 'interregnum-11', name: 'Undecimus Interregno' }
]);

async function productionNomenclature() {
  return validateNomenclature(await readJson('public', 'config', 'nomenclature.json'));
}

async function context(nomenclature) {
  const activeNomenclature = nomenclature ?? await productionNomenclature();
  return createPresentationContext({
    nomenclatureResult: { schemaVersion: activeNomenclature.schemaVersion, nomenclature: activeNomenclature }
  });
}

function createSeasonRendererRoot() {
  const elements = new Map([
    '[data-season-name]',
    '[data-season-metadata]',
    '[data-season-cycle-metadata]',
    '[data-season-next]',
    '[data-season-progress]',
    '[data-season-progress-bar]'
  ].map((selector) => [selector, { textContent: '', value: 0 }]));
  return {
    elements,
    querySelector(selector) { return elements.get(selector) ?? null; }
  };
}

function createRendererRoot(selectors) {
  const elements = new Map(selectors.map((selector) => [selector, {
    textContent: '', value: 0, hidden: false
  }]));
  return {
    elements,
    querySelector(selector) { return elements.get(selector) ?? null; },
    querySelectorAll() { return []; }
  };
}

function renamedNomenclature(value) {
  const renamed = structuredClone(value);
  renamed.application.displayName = 'Renamed World';
  renamed.calendar.yearName = 'Renamed Era';
  renamed.calendar.monthReign.name = 'Dominion of';
  renamed.calendar.monthReign.rulers.find(({ id }) => id === 'ruler-01').name = 'First Ruler';
  renamed.calendar.monthReign.rulers.find(({ id }) => id === 'ruler-07').name = 'Seventh Ruler';
  renamed.calendar.monthReign.rulers.find(({ id }) => id === 'ruler-08').name = 'Eighth Ruler';
  renamed.calendar.namedDays.find(({ id }) => id === 'named-day-01').name = 'First Named Day';
  renamed.calendar.interRegna[0].name = 'Renamed Interregno';
  renamed.lunarCycle.name = 'Renamed Cycle';
  renamed.lunarPhases.find(({ id }) => id === 'phase-01').name = 'Renamed Phase';
  renamed.pages.find(({ id }) => id === 'page-01').name = 'Chronica';
  renamed.pages.find(({ id }) => id === 'page-02').name = 'Fatum';
  renamed.navigationGroups[0].name = 'Renamed Almanac';
  renamed.navigationGroups[1].name = 'Renamed Personage';
  renamed.navigationGroups[2].name = 'Renamed Location';
  renamed.pageSections.find(({ id }) => id === 'page-section-01').name = 'Renamed Section';
  renamed.outcomeTypes.find(({ id }) => id === 'outcome-tier-01').name = 'Renamed Outcome';
  renamed.seasons.find(({ id }) => id === 'season-01').name = 'Dry';
  renamed.seasons.find(({ id }) => id === 'season-02').name = 'Rainy';
  renamed.celestialBodies.find(({ id }) => id === 'body-01').name = 'Swift';
  renamed.celestialBodies.find(({ id }) => id === 'body-06').name = 'Selene';
  return validateNomenclature(renamed);
}

test('production nomenclature reproduces every intended proper noun group', async () => {
  const value = await productionNomenclature();
  assert.equal(value.schemaVersion, 12);
  assert.equal(value.application.displayName, 'Insidia');
  assert.equal(value.calendar.yearName, 'Annus Solis');
  assert.deepEqual(value.lunarCycle, { name: 'Cyclus Lunae' });
  assert.deepEqual(value.pages, [
    { id: 'page-01', name: 'Calendario' },
    { id: 'page-02', name: 'Destino' },
    { id: 'page-03', name: 'Tempore' },
    { id: 'page-04', name: 'Identitate' },
    { id: 'page-05', name: 'Inventario' },
    { id: 'page-06', name: 'Subordinatos' },
    { id: 'page-07', name: 'Locus' },
    { id: 'page-08', name: 'Rutas' },
    { id: 'page-09', name: 'Explorar' }
  ]);
  assert.deepEqual(value.navigationGroups, [
    { id: 'navigation-group-01', name: 'Almanac' },
    { id: 'navigation-group-02', name: 'Personage' },
    { id: 'navigation-group-03', name: 'Location' }
  ]);
  assert.deepEqual(value.pageSections.map(({ name }) => name), [
    'Titulo', 'Nomine', 'Epitheto', 'Equipamento', 'Observationes', 'Decisiones',
    'Memorias', 'Campiones', 'Miniones', 'Deposito'
  ]);
  for (const removed of ['Personage', 'Pensamentos', 'Commandamento', 'Mappa', 'Observationes', 'Decisiones']) {
    assert.equal(value.pages.some(({ name }) => name === removed), false, removed);
  }
  for (const removed of ['Inventario', 'Investigationes', 'Ordines']) {
    assert.equal(value.pageSections.some(({ name }) => name === removed), false, removed);
  }
  assert.deepEqual(value.outcomeTypes, [
    { id: 'outcome-tier-01', name: 'Commune' },
    { id: 'outcome-tier-02', name: 'Infrequens' },
    { id: 'outcome-tier-03', name: 'Rarum' }
  ]);
  assert.equal(Object.hasOwn(value, 'location'), false);
  assert.equal(Object.hasOwn(value, 'mappa'), false);
  assert.equal(Object.hasOwn(value.calendar, 'months'), false);
  assert.equal(value.calendar.monthReign.name, 'Regno de');
  assert.deepEqual(value.calendar.monthReign.rulers, MONTH_RULERS);
  assert.deepEqual(value.calendar.monthReign.ordinals, REIGN_ORDINALS);
  assert.deepEqual(value.calendar.weekdays, WEEKDAYS);
  assert.deepEqual(value.calendar.namedDays, NAMED_DAYS);
  assert.deepEqual(value.calendar.interRegna, INTERREGNOS);
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
  const presentationContext = await context();
  for (let dayIndex = 0; dayIndex <= 7; dayIndex += 1) {
    const state = calculateCalendarState(dayIndex * weekdayDayMilliseconds);
    const expected = WEEKDAYS[dayIndex % WEEKDAYS.length];
    assert.equal(state.calendar.weekdayId, expected.id, `day index ${dayIndex}`);
    assert.deepEqual(createDisplayData(state, presentationContext).calendar.weekday, expected, `day index ${dayIndex}`);
  }
});

test('named calendar days and ordinary Roman days render exact configured dates', async () => {
  const presentationContext = await context();
  const cases = [
    [0, 'named-day-01', 'Kalendis', 'Dies Lunae Kalendis · Regno de Pigritia', 'I'],
    [6, 'named-day-02', 'Nonis', 'Dies Solis Nonis · Regno de Pigritia', 'VII'],
    [14, 'named-day-03', 'Idibus', 'Dies Lunae Idibus · Regno de Pigritia', 'XV'],
    [22, 'named-day-04', 'Liminis', 'Dies Martis Liminis · Regno de Pigritia', 'XXIII'],
    [18, null, 'XIX', 'Dies Veneris XIX · Regno de Pigritia', null],
    [29, 'named-day-05', 'Interregis', 'Dies Martis Interregis · Primus Interregno', 'I'],
    [30, null, 'II', 'Dies Mercurii II · Primus Interregno', null]
  ];

  for (const [dayIndex, namedDayId, designation, periodLabel, replacedRoman] of cases) {
    const state = calculateCalendarState(dayIndex * weekdayDayMilliseconds);
    const display = createDisplayData(state, presentationContext);
    assert.equal(state.calendar.period.namedDayId, namedDayId, `day index ${dayIndex}`);
    assert.equal(formatCalendarDayDesignation(state.calendar.period, presentationContext), designation);
    assert.equal(display.calendar.dayDesignation, designation);
    assert.equal(display.calendar.periodLabel, periodLabel);
    assert.equal(display.formattedDate, `Annus Solis I · ${periodLabel}`);
    assert.doesNotMatch(periodLabel, /^Dies \p{L}+ · /u);
    if (replacedRoman) assert.equal(periodLabel.includes(` ${replacedRoman} `), false);
  }
});

test('representative year 62 date uses configured names and Roman numerals', async () => {
  const dayIndex = (61 * 353) + 82;
  const state = calculateCalendarState(dayIndex * weekdayDayMilliseconds);
  const display = createDisplayData(state, await context());
  assert.equal(state.calendar.year, 62);
  assert.equal(state.calendar.period.monthId, 'month-03');
  assert.equal(state.calendar.period.day, 19);
  assert.equal(state.calendar.period.namedDayId, null);
  assert.equal(state.calendar.weekdayId, 'weekday-07');
  assert.equal(display.calendar.formattedYear, 'Annus Solis LXII');
  assert.equal(formatFictionalYear(state, await context()), 'Annus Solis LXII');
  assert.equal(state.calendar.period.rulership.effectiveRulerId, 'ruler-07');
  assert.equal(state.calendar.period.rulership.reignNumber, 1);
  assert.equal(display.calendar.namedDay, null);
  assert.equal(display.calendar.dayDesignation, 'XIX');
  assert.equal(display.calendar.periodLabel, 'Dies Solis XIX · Regno de Luxuria');
  assert.equal(display.formattedDate, 'Annus Solis LXII · Dies Solis XIX · Regno de Luxuria');
  assert.doesNotMatch(display.calendar.periodLabel, /^Dies Solis · XIX /);
  assert.equal(display.calendar.month.id, 'month-03');
  assert.equal(display.calendar.month.index, 3);
  assert.equal(display.calendar.month.name, 'Regno de Luxuria');
  assert.deepEqual(display.calendar.month.rulership.opportunityRuler, { id: 'ruler-07', name: 'Luxuria' });
  assert.deepEqual(display.calendar.month.rulership.regularRuler, { id: 'ruler-07', name: 'Luxuria' });
  assert.deepEqual(display.calendar.month.rulership.effectiveRuler, { id: 'ruler-07', name: 'Luxuria' });
  assert.deepEqual(display.calendar.month.rulership.rotationSeason, { id: 'season-01', name: 'Ossos' });
  assert.equal(display.calendar.month.rulership.source, 'season_rotation');
  assert.equal(display.calendar.month.rulership.skippedRegularTurn, false);
  assert.equal(display.calendar.month.rulership.reignNumber, 1);
  assert.deepEqual(display.calendar.month.rulership.ordinal, { id: 'reign-ordinal-01', name: 'Prime' });
  assert.equal(display.calendar.month.rulership.decision.type, 'interregno_final_hour');
  assert.equal(display.calendar.month.rulership.decision.calendarHour, 22);
  assert.equal(display.calendar.month.rulership.decision.bodies.length, 6);
  assert.deepEqual(display.calendar.month.rulership.decision.bodies[0], {
    id: 'body-01', name: 'Mercurius', symbol: '☿',
    progressFraction: state.calendar.period.rulership.decision.bodyProgress[0].progressFraction,
    formattedProgress: '66.243282%'
  });
  assert.deepEqual(display.calendar.month.rulership.decision.qualifyingBodies, [
    { id: 'body-04', name: 'Jupiter', symbol: '♃' }
  ]);
  assert.deepEqual(display.calendar.month.rulership.replacement, {
    applied: false, method: null, selectedBody: null, fallbackReason: null
  });
  assert.deepEqual(Object.keys(display.calendar).sort(), [
    'dayDesignation', 'formattedYear', 'interRegnum', 'month', 'namedDay',
    'periodLabel', 'time', 'weekday', 'yearName'
  ]);
  assert.equal(Object.hasOwn(display.calendar, 'metadata'), false);

  const renamed = structuredClone(await productionNomenclature());
  renamed.calendar.monthReign.name = 'Dominion of';
  renamed.calendar.monthReign.rulers.find(({ id }) => id === 'ruler-07').name = 'Seventh Ruler';
  const renamedDisplay = createDisplayData(state, await context(validateNomenclature(renamed)));
  assert.equal(renamedDisplay.calendar.periodLabel, 'Dies Solis XIX · Dominion of Seventh Ruler');

  const rawBeforeMappedRename = structuredClone(state);
  const fullyRenamedDisplay = createDisplayData(
    state,
    await context(renamedNomenclature(await productionNomenclature()))
  );
  assert.deepEqual(fullyRenamedDisplay.calendar.month.rulership.rotationSeason, {
    id: 'season-01', name: 'Dry'
  });
  assert.equal(fullyRenamedDisplay.calendar.month.rulership.decision.bodies[0].name, 'Swift');
  assert.equal(fullyRenamedDisplay.calendar.month.rulership.decision.bodies[0].symbol, '☿');
  assert.deepEqual(state, rawBeforeMappedRename);
});

test('month reign formatting uses every ordinal but omits Prime for the first reign', async () => {
  const presentationContext = await context();
  const expected = [
    'Regno de Orgolio', 'Secunde Regno de Orgolio', 'Tertie Regno de Orgolio',
    'Quarte Regno de Orgolio', 'Quinte Regno de Orgolio', 'Sexte Regno de Orgolio',
    'Septime Regno de Orgolio', 'Octave Regno de Orgolio', 'None Regno de Orgolio',
    'Decime Regno de Orgolio', 'Undecime Regno de Orgolio'
  ];
  for (let index = 0; index < expected.length; index += 1) {
    assert.equal(formatMonthReignName({
      effectiveRulerId: 'ruler-01',
      reignNumber: index + 1,
      ordinalId: `reign-ordinal-${String(index + 1).padStart(2, '0')}`
    }, presentationContext), expected[index]);
  }
  assert.deepEqual(presentationContext.getReignOrdinal('reign-ordinal-01'), { id: 'reign-ordinal-01', name: 'Prime' });
  for (const reignNumber of [0, 12, 1.5]) {
    assert.throws(() => formatMonthReignName({ effectiveRulerId: 'ruler-01', reignNumber, ordinalId: 'reign-ordinal-01' }, presentationContext), RangeError);
  }
  assert.throws(() => formatMonthReignName({ effectiveRulerId: 'ruler-99', reignNumber: 1, ordinalId: 'reign-ordinal-01' }, presentationContext));
  assert.throws(() => formatMonthReignName({ effectiveRulerId: 'ruler-01', reignNumber: 1, ordinalId: 'reign-ordinal-99' }, presentationContext));
});

test('yearly reign names reset without resetting the underlying rotation', async () => {
  const presentationContext = await context();
  for (const [year, month, expected] of [
    [0, 0, 'Regno de Pigritia'], [0, 4, 'Secunde Regno de Vanitate'],
    [0, 5, 'Tertie Regno de Vanitate'], [0, 10, 'Secunde Regno de Rabia'],
    [1, 0, 'Regno de Gula']
  ]) assert.equal(formatMonthReignName(calculateMonthRulershipState(year, month), presentationContext), expected);
});

test('presentation context exposes cloned, deeply frozen nomenclature entities', async () => {
  const source = await productionNomenclature();
  const presentationContext = await context(source);
  const ruler = presentationContext.getMonthRuler('ruler-01');
  const ordinal = presentationContext.getReignOrdinal('reign-ordinal-01');
  const namedDay = presentationContext.getNamedDay('named-day-01');
  const navigationGroup = presentationContext.getNavigationGroup('navigation-group-01');
  const personageGroup = presentationContext.getNavigationGroup('navigation-group-02');
  const locationGroup = presentationContext.getNavigationGroup('navigation-group-03');
  const pageSection = presentationContext.getPageSection('page-section-01');
  const observationesSection = presentationContext.getPageSection('page-section-06');
  const decisionesSection = presentationContext.getPageSection('page-section-07');
  const outcomeType = presentationContext.getOutcomeType('outcome-tier-01');
  assert.notEqual(ruler, source.calendar.monthReign.rulers[0]);
  assert.notEqual(ordinal, source.calendar.monthReign.ordinals[0]);
  assert.notEqual(namedDay, source.calendar.namedDays[0]);
  assert.notEqual(navigationGroup, source.navigationGroups[0]);
  assert.notEqual(personageGroup, source.navigationGroups[1]);
  assert.notEqual(pageSection, source.pageSections[0]);
  assert.notEqual(observationesSection, source.pageSections[4]);
  assert.notEqual(decisionesSection, source.pageSections[5]);
  assert.notEqual(outcomeType, source.outcomeTypes[0]);
  assert.notEqual(locationGroup, source.navigationGroups[2]);
  assert.equal(Object.isFrozen(ruler), true);
  assert.equal(Object.isFrozen(ordinal), true);
  assert.equal(Object.isFrozen(namedDay), true);
  assert.equal(Object.isFrozen(navigationGroup), true);
  assert.equal(Object.isFrozen(personageGroup), true);
  assert.equal(Object.isFrozen(locationGroup), true);
  assert.equal(Object.isFrozen(pageSection), true);
  assert.equal(Object.isFrozen(observationesSection), true);
  assert.equal(Object.isFrozen(decisionesSection), true);
  assert.equal(Object.isFrozen(outcomeType), true);
  assert.throws(() => { ruler.name = 'Changed'; }, TypeError);
  assert.throws(() => { ordinal.name = 'Changed'; }, TypeError);
  assert.throws(() => { namedDay.name = 'Changed'; }, TypeError);
  assert.throws(() => { navigationGroup.name = 'Changed'; }, TypeError);
  assert.throws(() => { personageGroup.name = 'Changed'; }, TypeError);
  assert.throws(() => { locationGroup.name = 'Changed'; }, TypeError);
  assert.throws(() => { pageSection.name = 'Changed'; }, TypeError);
  assert.throws(() => { observationesSection.name = 'Changed'; }, TypeError);
  assert.throws(() => { decisionesSection.name = 'Changed'; }, TypeError);
  assert.throws(() => { outcomeType.name = 'Changed'; }, TypeError);
  assert.equal(presentationContext.getMonthRuler('ruler-01').name, 'Orgolio');
  assert.equal(presentationContext.getReignOrdinal('reign-ordinal-01').name, 'Prime');
  assert.equal(presentationContext.getNamedDay('named-day-01').name, 'Kalendis');
  assert.deepEqual(presentationContext.getNavigationGroup('navigation-group-01'), { id: 'navigation-group-01', name: 'Almanac' });
  assert.deepEqual(presentationContext.getNavigationGroup('navigation-group-02'), { id: 'navigation-group-02', name: 'Personage' });
  assert.deepEqual(presentationContext.getNavigationGroup('navigation-group-03'), { id: 'navigation-group-03', name: 'Location' });
  assert.equal(presentationContext.getPageSection('page-section-01').name, 'Titulo');
  assert.deepEqual(presentationContext.getPageSection('page-section-06'), { id: 'page-section-06', name: 'Observationes' });
  assert.deepEqual(presentationContext.getPageSection('page-section-07'), { id: 'page-section-07', name: 'Decisiones' });
  assert.equal(presentationContext.getOutcomeType('outcome-tier-01').name, 'Commune');
  assert.equal(Object.hasOwn(presentationContext, 'currentLocation'), false);
});

test('Interregno dates use the configured first-day name, then Roman days', async () => {
  const timestamp = 29 * weekdayDayMilliseconds;
  const state = calculateCalendarState(timestamp);
  const rawPeriod = {
    type: 'inter_regnum',
    interRegnumId: 'interregnum-01',
    fromMonthId: 'month-01',
    toMonthId: 'month-02',
    day: 1,
    length: 3,
    namedDayId: 'named-day-05'
  };
  const presentationContext = await context();
  const display = createDisplayData(state, presentationContext);
  const calendarJson = createCalendarJson(state, timestamp, presentationContext);
  const renamed = renamedNomenclature(await productionNomenclature());
  const renamedDisplay = createDisplayData(state, await context(renamed));

  assert.deepEqual(state.calendar.period, rawPeriod);
  assert.equal(state.calendar.weekdayId, 'weekday-02');
  assert.equal(Object.hasOwn(state.calendar.period, 'rulership'), false);
  assert.doesNotMatch(JSON.stringify(state), /Interregno/);
  assert.equal(display.calendar.month, null);
  assert.deepEqual(display.calendar.interRegnum, { id: 'interregnum-01', name: 'Primus Interregno' });
  assert.deepEqual(display.calendar.namedDay, { id: 'named-day-05', name: 'Interregis' });
  assert.equal(display.calendar.dayDesignation, 'Interregis');
  assert.equal(display.calendar.periodLabel, 'Dies Martis Interregis · Primus Interregno');
  assert.equal(calendarJson.calendarVersion, 'v20');
  assert.deepEqual(calendarJson.state.calendar.period, rawPeriod);
  assert.deepEqual(calendarJson.display.calendar.interRegnum, {
    id: 'interregnum-01',
    name: 'Primus Interregno'
  });
  assert.equal(calendarJson.display.calendar.periodLabel, 'Dies Martis Interregis · Primus Interregno');
  assert.deepEqual(calculateCalendarState(29 * weekdayDayMilliseconds).calendar.period, rawPeriod);
  assert.equal(renamedDisplay.calendar.periodLabel, 'Dies Martis Interregis · Renamed Interregno');

  const laterState = calculateCalendarState(30 * weekdayDayMilliseconds);
  const laterDisplay = createDisplayData(laterState, presentationContext);
  assert.equal(laterState.calendar.period.namedDayId, null);
  assert.equal(laterDisplay.calendar.namedDay, null);
  assert.equal(laterDisplay.calendar.dayDesignation, 'II');
  assert.equal(laterDisplay.calendar.periodLabel, 'Dies Mercurii II · Primus Interregno');
});

test('shared season renderer uses fixed Interlingua prose while preserving configured names and numeric state', async () => {
  const state = calculateCalendarState(0);
  const seasonBeforeRender = structuredClone(state.season);
  const rootElement = createSeasonRendererRoot();
  createSeasonRenderer(rootElement, await context())(state);
  assert.deepEqual(state.season, seasonBeforeRender);
  assert.equal(rootElement.elements.get('[data-season-name]').textContent, 'Ossos');
  assert.equal(rootElement.elements.get('[data-season-metadata]').textContent, 'Die 1 de 179 · Cyclo 1');
  assert.equal(rootElement.elements.get('[data-season-cycle-metadata]').textContent, 'Die seasonal 1 de 358');
  assert.equal(rootElement.elements.get('[data-season-next]').textContent, 'Sequente: Lacrimas');
  assert.equal(rootElement.elements.get('[data-season-progress]').textContent, 'Progresso: 0.000000%');
  assert.equal(rootElement.elements.get('[data-season-progress-bar]').value, 0);
});

test('representative lunar state produces one exact configured Roman summary', async () => {
  const state = calculateCalendarState(representativeLunarTimestamp);
  const presentationContext = await context();
  const display = createDisplayData(state, presentationContext);
  assert.equal(state.lunar.cycle, 1234);
  assert.equal(state.lunar.day, 9);
  assert.equal(state.lunar.cycleLengthDays, 13);
  assert.equal(state.lunar.phaseId, 'phase-09');
  assert.deepEqual(display.lunar.phase, { id: 'phase-09', name: 'Morditura' });
  assert.equal(display.lunar.cycleName, 'Cyclus Lunae');
  assert.equal(display.lunar.formattedCycle, 'MCCXXXIV');
  assert.equal(display.lunar.formattedSummary, 'Morditura • Cyclus Lunae MCCXXXIV');
  assert.equal(formatLunarSummary(state, presentationContext), display.lunar.formattedSummary);
  assert.equal([...display.lunar.formattedSummary].filter((character) => character === '•').length, 1);
  assert.equal(display.lunar.formattedSummary.includes('·'), false);
  assert.equal(presentationContext.languageTag, 'ia');
  assert.equal(presentationContext.message('nav.aria'), 'Navigation principal');

  const rawLunar = state.lunar;
  assert.equal(rawLunar.cycle, 1234);
  assert.equal(rawLunar.day, 9);
  assert.equal(rawLunar.cycleLengthDays, 13);
  assert.equal(rawLunar.phaseId, 'phase-09');
  assert.doesNotMatch(JSON.stringify(rawLunar), /Morditura|Cyclus Lunae|MCCXXXIV|formattedCycle|formattedSummary/);

  const calendarJson = createCalendarJson(state, representativeLunarTimestamp, presentationContext);
  assert.equal(calendarJson.calendarVersion, 'v20');
  assert.deepEqual(calendarJson.nomenclature, { schemaVersion: 12, applicationDisplayName: 'Insidia' });
  assert.equal(Object.hasOwn(calendarJson, 'locale'), false);
  assert.equal(calendarJson.display.lunar.formattedSummary, 'Morditura • Cyclus Lunae MCCXXXIV');
});

test('stable page IDs map to fixed non-configurable routes', () => {
  assert.equal(Object.isFrozen(PAGE_DEFINITIONS), true);
  assert.equal(Object.isFrozen(PAGE_IDS), true);
  assert.equal(Object.isFrozen(NAVIGATION_GROUP_IDS), true);
  assert.equal(Object.isFrozen(PAGE_SECTION_IDS), true);
  assert.deepEqual(PAGE_IDS, ['page-01','page-02','page-03','page-04','page-05','page-06','page-07','page-08','page-09']);
  assert.deepEqual(NAVIGATION_GROUP_IDS, ['navigation-group-01', 'navigation-group-02', 'navigation-group-03']);
  assert.deepEqual(PAGE_SECTION_IDS, ['page-section-01','page-section-02','page-section-03','page-section-04','page-section-06','page-section-07','page-section-09','page-section-11','page-section-12','page-section-13']);
  assert.deepEqual(PAGE_IDS.map((id) => PAGE_DEFINITIONS[id].route), ['/calendario.html','/destino.html','/tempore.html','/identitate.html','/inventario.html','/subordinatos.html','/locus.html','/rutas.html','/explorar.html']);
  assert.deepEqual(PAGE_IDS.map((id) => PAGE_DEFINITIONS[id].descriptionTemplateKey), [
    'document.page-01Description','document.page-02Description','document.page-03Description',
    'document.page-04Description','document.page-05Description','document.page-06Description',
    'document.page-07Description','document.page-08Description','document.page-09Description'
  ]);
  assert.equal(PAGE_DEFINITIONS['page-10'], undefined);
  assert.equal(PAGE_DEFINITIONS['page-11'], undefined);
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
  const firstDisplay = createDisplayData(firstRaw, await context(production));
  const secondDisplay = createDisplayData(secondRaw, await context(renamed));
  assert.equal(firstDisplay.season.name, 'Ossos');
  assert.equal(secondDisplay.season.name, 'Dry');
  assert.equal(firstDisplay.orbits.bodies.find(({ id }) => id === 'body-06').name, 'Luna');
  assert.equal(secondDisplay.orbits.bodies.find(({ id }) => id === 'body-06').name, 'Selene');
  assert.equal(firstDisplay.calendar.formattedYear, 'Annus Solis I');
  assert.equal(secondDisplay.calendar.formattedYear, 'Renamed Era I');
  assert.deepEqual(firstDisplay.calendar.namedDay, { id: 'named-day-01', name: 'Kalendis' });
  assert.deepEqual(secondDisplay.calendar.namedDay, { id: 'named-day-01', name: 'First Named Day' });
  assert.equal(firstDisplay.calendar.dayDesignation, 'Kalendis');
  assert.equal(secondDisplay.calendar.dayDesignation, 'First Named Day');
  assert.equal(firstDisplay.calendar.periodLabel, 'Dies Lunae Kalendis · Regno de Pigritia');
  assert.equal(secondDisplay.calendar.periodLabel, 'Dies Lunae First Named Day · Dominion of Eighth Ruler');
  assert.equal(firstDisplay.calendar.month.name, 'Regno de Pigritia');
  assert.equal(secondDisplay.calendar.month.name, 'Dominion of Eighth Ruler');
  assert.equal(firstDisplay.lunar.formattedSummary, 'Renascimento • Cyclus Lunae I');
  assert.equal(secondDisplay.lunar.formattedSummary, 'Renamed Phase • Renamed Cycle I');
  assert.deepEqual(firstDisplay.outcomeType, { id: 'outcome-tier-01', name: 'Commune' });
  assert.deepEqual(secondDisplay.outcomeType, { id: 'outcome-tier-01', name: 'Renamed Outcome' });
  assert.equal((await context(production)).getPage('page-01').name, 'Calendario');
  assert.equal((await context(renamed)).getPage('page-01').name, 'Chronica');
});

test('Outcome types are nomenclature-owned', async () => {
  const production = await productionNomenclature();
  const renamed = renamedNomenclature(production);
  for (const nomenclature of [production, renamed]) {
    const presentationContext = await context(nomenclature);
    const expected = nomenclature === production
      ? ['Commune','Infrequens','Rarum']
      : ['Renamed Outcome','Infrequens','Rarum'];
    assert.deepEqual(
      ['outcome-tier-01','outcome-tier-02','outcome-tier-03'].map((id) => presentationContext.getOutcomeType(id).name),
      expected
    );
  }
});

test('fixed Interlingua context leaves nomenclature and raw state presentation-neutral', async () => {
  const raw = calculateCalendarState(0);
  const presentationContext = await context();
  const display = createDisplayData(raw, presentationContext);
  for (const [ids, getter] of [
    [Array.from({ length: 13 }, (_, index) => `phase-${String(index + 1).padStart(2, '0')}`), 'getLunarPhase'],
    [Array.from({ length: 3 }, (_, index) => `tide-${String(index + 1).padStart(2, '0')}`), 'getTide'],
    [Array.from({ length: 2 }, (_, index) => `season-${String(index + 1).padStart(2, '0')}`), 'getSeason'],
    [Array.from({ length: 3 }, (_, index) => `pull-${String(index + 1).padStart(2, '0')}`), 'getPull'],
    [Array.from({ length: 6 }, (_, index) => `body-${String(index + 1).padStart(2, '0')}`), 'getCelestialBody'],
    [MONTH_RULERS.map(({ id }) => id), 'getMonthRuler'],
    [REIGN_ORDINALS.map(({ id }) => id), 'getReignOrdinal'],
    [WEEKDAYS.map(({ id }) => id), 'getWeekday'],
    [NAMED_DAYS.map(({ id }) => id), 'getNamedDay'],
    [PAGE_IDS, 'getPage'],
    [Array.from({ length: 3 }, (_, index) => `outcome-tier-${String(index + 1).padStart(2, '0')}`), 'getOutcomeType'],
    [PAGE_SECTION_IDS, 'getPageSection']
  ]) {
    assert.equal(ids.every((id) => presentationContext[getter](id).id === id), true);
  }
  assert.equal(presentationContext.languageTag, 'ia');
  assert.equal(presentationContext.message('label.progress'), 'Progresso');
  assert.equal(presentationContext.format('route.fictionalMinutes', { value: 7 }), '7 minutas fictional');
  for (const removedProperty of ['requestedLocaleId', 'resolvedLocaleId', 'localeSchemaVersion']) {
    assert.equal(Object.hasOwn(presentationContext, removedProperty), false, removedProperty);
  }
  assert.equal(display.outcomeType.name, 'Commune');
  assert.equal(Object.hasOwn(presentationContext, 'currentLocation'), false);
  assert.equal(presentationContext.getPage('page-02').name, 'Destino');
  assert.equal(display.calendar.formattedYear, 'Annus Solis I');
  assert.deepEqual(display.calendar.namedDay, { id: 'named-day-01', name: 'Kalendis' });
  assert.equal(display.calendar.dayDesignation, 'Kalendis');
  assert.equal(display.calendar.periodLabel, 'Dies Lunae Kalendis · Regno de Pigritia');
  assert.equal(display.formattedDate, 'Annus Solis I · Dies Lunae Kalendis · Regno de Pigritia');
  assert.deepEqual(raw, calculateCalendarState(0));
});

test('Attempts text uses fixed Interlingua prose around the configured Rarum name', async () => {
  const outcome = calculateCalendarState(0).outcome;
  assert.equal(formatAttemptsUntilRare(outcome, await context()), 'Tentativas usque a Rarum: 100');
});

test('Destino tide renderer uses tide progress while Tempore keeps calendar-hour progress', () => {
  const tideRoot = createRendererRoot(['#tide-progress', '#tide-progress-value']);
  const weatherRoot = createRendererRoot([
    '#lunar-day-progress', '#lunar-day-progress-value',
    '#day-progress', '#day-progress-value',
    '#hour-progress', '#hour-progress-value'
  ]);
  const state = {
    progress: {
      tide: { fraction: 0.875, percentage: 87.5 },
      lunarPhase: { fraction: 0.125, percentage: 12.5 },
      day: { fraction: 0.25, percentage: 25 },
      hour: { fraction: 0.375, percentage: 37.5 }
    }
  };

  createTideProgressRenderer(tideRoot)(state);
  assert.equal(tideRoot.elements.get('#tide-progress').value, 87.5);
  assert.equal(tideRoot.elements.get('#tide-progress-value').textContent, '87.500000%');

  createWeatherProgressRenderer(weatherRoot)(state);
  assert.equal(weatherRoot.elements.get('#hour-progress').value, 37.5);
  assert.equal(weatherRoot.elements.get('#hour-progress-value').textContent, '37.500000%');
  assert.notEqual(weatherRoot.elements.get('#hour-progress').value, state.progress.tide.percentage);
});

test('Outcome renderer keeps selected-body orbital progress separate from tide progress', async () => {
  const root = createRendererRoot([
    '#outcome-body', '#outcome-type', '#outcome-attempts', '#outcome-progress',
    '#outcome-source', '#outcome-rule', '#outcome-tiebreak'
  ]);
  const outcome = structuredClone(calculateCalendarState(0).outcome);
  outcome.bodyState.progressFraction = 0.123456;
  outcome.tideProgressFraction = 0.999999;
  outcome.tideProgressPercentage = 99.9999;

  createOutcomeRenderer(root, await context(), 'page-02')(outcome);
  assert.equal(root.elements.get('#outcome-type').textContent, 'Destino Commune');
  assert.equal(root.elements.get('#outcome-progress').textContent, 'Progresso orbital: 12.345600%');
  assert.ok(!root.elements.get('#outcome-progress').textContent.includes('99.999900%'));
});

test('Destino renders fixed nomenclature Outcome types without a colon', async () => {
  const expectedById = new Map([
    ['outcome-tier-01', 'Destino Commune'],
    ['outcome-tier-02', 'Destino Infrequens'],
    ['outcome-tier-03', 'Destino Rarum']
  ]);
  const rendered = [];
  for (const [outcomeTypeId, expected] of expectedById) {
    const rootElement = createRendererRoot([
      '#outcome-body', '#outcome-type', '#outcome-attempts', '#outcome-progress',
      '#outcome-source', '#outcome-rule', '#outcome-tiebreak'
    ]);
    const outcome = structuredClone(calculateCalendarState(0).outcome);
    outcome.outcomeTypeId = outcomeTypeId;
    createOutcomeRenderer(rootElement, await context(), 'page-02')(outcome);
    const text = rootElement.elements.get('#outcome-type').textContent;
    rendered.push(text);
    assert.equal(text, expected);
  }
  assert.doesNotMatch(rendered.join('|'), /:|Common|Uncommon|Rare|Común|Poco común|Raro/);

  const raw = calculateCalendarState(0).outcome;
  const rawBefore = structuredClone(raw);
  const rootElement = createRendererRoot([
    '#outcome-body', '#outcome-type', '#outcome-attempts', '#outcome-progress',
    '#outcome-source', '#outcome-rule', '#outcome-tiebreak'
  ]);
  const renamed = renamedNomenclature(await productionNomenclature());
  createOutcomeRenderer(rootElement, await context(renamed), 'page-02')(raw);
  assert.equal(rootElement.elements.get('#outcome-type').textContent, 'Fatum Renamed Outcome');
  assert.deepEqual(raw, rawBefore);
});

test('JSON v20 omits locale metadata and exposes named-day state, ruler decisions, and neutral raw state', async () => {
  const raw = calculateCalendarState(0);
  const english = createCalendarJson(raw, 0, await context());
  assert.equal(english.calendarVersion, 'v20');
  assert.equal(english.state.totalSeconds, 0);
  assert.equal(english.state.totalLunarSeconds, 0);
  assert.deepEqual(english.state.lunar.time, {
    hour: 0,
    minute: 0,
    second: 0,
    realMillisecondsPerLunarSecond: 1009,
    secondsPerLunarMinute: 59,
    minutesPerLunarHour: 67,
    hoursPerLunarDay: 31
  });
  assert.equal(Object.hasOwn(english, 'universe'), false);
  assert.deepEqual(english.nomenclature, { schemaVersion: 12, applicationDisplayName: 'Insidia' });
  assert.equal(Object.hasOwn(english.nomenclature, 'requestedId'), false);
  assert.equal(Object.hasOwn(english.nomenclature, 'resolvedId'), false);
  assert.equal(Object.hasOwn(english, 'locale'), false);
  assert.deepEqual(Object.keys(english), ['calendarVersion', 'nomenclature', 'source', 'state', 'display']);
  assert.deepEqual(english.state.progress.tide, { fraction: 0, percentage: 0 });
  assert.deepEqual(english.state.progress.hour, { fraction: 0, percentage: 0 });
  assert.equal(english.display.progress.tide, '0.000000%');
  assert.equal(english.display.progress.hour, '0.000000%');
  for (const [key, progress] of Object.entries(english.state.progress)) {
    assert.deepEqual(Object.keys(progress).sort(), ['fraction', 'percentage'], key);
    assert.equal(typeof progress.fraction, 'number', key);
    assert.equal(typeof progress.percentage, 'number', key);
  }
  for (const key of ['year','weekOfYear','dayOfYear','dayOfWeek','weekdayId']) assert.ok(Object.hasOwn(english.state.calendar, key), key);
  assert.equal(english.state.calendar.period.day, 1);
  assert.equal(english.state.calendar.period.namedDayId, 'named-day-01');
  assert.equal(english.state.calendar.weekdayId, 'weekday-01');
  assert.doesNotMatch(JSON.stringify(english.state), /"(?:name|shortName|symbol|formatted)"/);
  assert.doesNotMatch(JSON.stringify(english.state), /Dies (?:Lunae|Martis|Mercurii|Iovis|Veneris|Saturni|Solis)/);
  assert.doesNotMatch(JSON.stringify(english.state), /Annus Solis|Regno de|Orgolio|Rabia|Gula|Invidia|Avaritia|Vanitate|Luxuria|Pigritia|Prime|Secunde|Tertie|Quarte|Quinte|Sexte|Septime|Octave|None|Decime|Undecime|Interregno|Kalendis|Nonis|Idibus|Liminis|Interregis|"[IVXLCDM]+"/);
  assert.equal(english.display.calendar.yearName, 'Annus Solis');
  assert.equal(english.display.calendar.formattedYear, 'Annus Solis I');
  assert.deepEqual(english.display.calendar.namedDay, { id: 'named-day-01', name: 'Kalendis' });
  assert.equal(english.display.calendar.dayDesignation, 'Kalendis');
  assert.equal(english.display.calendar.periodLabel, 'Dies Lunae Kalendis · Regno de Pigritia');
  assert.equal(english.display.calendar.month.name, 'Regno de Pigritia');
  assert.deepEqual(english.display.calendar.month.rulership.ordinal, { id: 'reign-ordinal-01', name: 'Prime' });
  for (const key of ['rotationSeasonId','opportunityRulerId','regularRulerId','effectiveRulerId','source','skippedRegularTurn','alternatingSkipOpportunityNumber','decision','replacement','reignNumber','ordinalId']) {
    assert.ok(Object.hasOwn(english.state.calendar.period.rulership, key), key);
  }
  assert.equal(Object.hasOwn(english.display.calendar, 'metadata'), false);
  assert.deepEqual(english.display.calendar.weekday, { id: 'weekday-01', name: 'Dies Lunae' });
  assert.deepEqual(Object.keys(english.display.calendar.weekday).sort(), ['id', 'name']);
  assert.equal(Object.hasOwn(english.display.calendar.weekday, 'shortName'), false);
  assert.equal(Object.hasOwn(english.display.calendar.weekday, 'symbol'), false);
  assert.deepEqual(english.display.season, {
    id: 'season-01',
    name: 'Ossos',
    next: { id: 'season-02', name: 'Lacrimas' }
  });
  assert.equal(english.display.lunar.phase.name, 'Renascimento');
  assert.equal(english.display.lunar.cycleName, 'Cyclus Lunae');
  assert.equal(english.display.lunar.formattedCycle, 'I');
  assert.equal(english.display.lunar.formattedSummary, 'Renascimento • Cyclus Lunae I');
  assert.doesNotMatch(JSON.stringify(english.state.lunar), /Cyclus Lunae|formattedCycle|formattedSummary/);
  assert.equal(english.display.orbits.bodies[5].id, 'body-06');
  assert.equal(english.display.orbits.bodies[5].name, 'Luna');
  assert.equal(english.state.lunar.phaseId, 'phase-01');
  assert.deepEqual(english.state.season, {
    id: 'season-01',
    cycle: 1,
    dayOfCycle: 1,
    cycleLengthDays: 358,
    day: 1,
    lengthDays: 179,
    nextId: 'season-02'
  });
  assert.equal(english.state.orbits.bodies[5].id, 'body-06');
  assert.deepEqual(english.display.outcomeType, { id: 'outcome-tier-01', name: 'Commune' });
  assert.doesNotMatch(JSON.stringify(english), /calendario\.html|destino\.html|tempore\.html|calendar\.html|outcome\.html|weather\.html/);
});

test('navigation nomenclature retains all three fixed group identifiers', () => {
  assert.deepEqual(NAVIGATION_GROUP_IDS, [
    'navigation-group-01',
    'navigation-group-02',
    'navigation-group-03'
  ]);
});

test('static HTML uses fixed Interlingua shells, neutral IDs, and nomenclature placeholders', async () => {
  const properNouns = ['Insidia','Almanac','Calendario','Destino','Tempore','Personage','Location','Locus','Rutas','Explorar','Identitate','Inventario','Subordinatos','Observationes','Decisiones','Titulo','Nomine','Epitheto','Memorias','Equipamento','Deposito','Campiones','Miniones','Santiago','Commune','Infrequens','Rarum','Annus Solis','Cyclus Lunae','MCCXXXIV','Regno de',...MONTH_RULERS.map(({ name }) => name),...REIGN_ORDINALS.map(({ name }) => name),...NAMED_DAYS.map(({ name }) => name),...INTERREGNOS.map(({ name }) => name),'Ossos','Lacrimas',...LUNAR_PHASE_NAMES,'Mercurius','Venus','Mars','Jupiter','Saturnus','Luna','Attraction dominante','Attraction minor','Attraction divergente', ...WEEKDAYS.map(({ name }) => name)];
  for (const file of ['calendario.html','destino.html','tempore.html','identitate.html','inventario.html','subordinatos.html','locus.html','rutas.html','explorar.html']) {
    const html = await readFile(path.join(root, 'public', file), 'utf8');
    for (const properNoun of properNouns) assert.ok(!containsProperNoun(html, properNoun), `${file}: ${properNoun}`);
    assert.match(html, /<html lang="ia" aria-busy="true" data-current-page-id="page-\d{2}">/);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /aria-label="Navigation principal"/);
    assert.match(html, /data-version><\/span>/);
    assert.doesNotMatch(html, /\b(?:Live|Current|Character|Equipment|Storage|Champions|Local routes|Navegación|Tiempo|Ubicación|Información|Observaciones)\b/u);
    assert.doesNotMatch(html, /data-universe-name/);
    assert.doesNotMatch(html, /data-page-link|data-message-key="page\./);
    assert.doesNotMatch(html, /<select|name=["'](?:universe|nomenclature)["']/i);
  }
});

test('core source remains proper-noun free', async () => {
  const source = await readFile(path.join(root, 'public', 'core', 'rules.js'), 'utf8') + await readFile(path.join(root, 'public', 'core', 'mechanics.js'), 'utf8');
  for (const name of ['Insidia','Annus Solis','Cyclus Lunae','Regno de',...MONTH_RULERS.map(({ name }) => name),...REIGN_ORDINALS.map(({ name }) => name),...NAMED_DAYS.map(({ name }) => name),...INTERREGNOS.map(({ name }) => name),'Ossos','Lacrimas','Mercurius','Venus','Mars','Jupiter','Saturnus','Luna',...LUNAR_PHASE_NAMES,'Marea basse','Attraction dominante', ...WEEKDAYS.map(({ name }) => name)]) assert.ok(!containsProperNoun(source, name), name);
});

test('month-reign and named-day proper nouns occur only in nomenclature, tests, and documentation', async () => {
  const forbiddenProductionFiles = [
    'core/rules.js', 'core/mechanics.js',
    'calendario.html', 'destino.html', 'tempore.html',
    'calendario-page.js', 'destino-page.js', 'tempore-page.js', 'renderers.js',
    'presentation.js', 'nomenclature.js', 'nomenclature-loader.js'
  ];
  const calendarProperNouns = [
    'Regno de', ...MONTH_RULERS.map(({ name }) => name),
    ...REIGN_ORDINALS.map(({ name }) => name), ...NAMED_DAYS.map(({ name }) => name)
  ];
  for (const file of forbiddenProductionFiles) {
    const source = await readFile(path.join(root, 'public', file), 'utf8');
    for (const properNoun of calendarProperNouns) {
      assert.equal(containsProperNoun(source, properNoun), false, `${file}: ${properNoun}`);
    }
  }
});

test('production sources contain no static month-name presentation model', async () => {
  const sourceFiles = [
    'config/nomenclature.json', 'presentation.js', 'nomenclature.js', 'nomenclature-loader.js'
  ];
  const sources = await Promise.all(sourceFiles.map(async (file) => [
    file,
    await readFile(path.join(root, 'public', file), 'utf8')
  ]));
  const staleExpressions = ['context.getMonth(', 'maps.months', 'getMonth:'];
  for (const [file, source] of sources) {
    for (const expression of staleExpressions) {
      assert.equal(source.includes(expression), false, `${file}: ${expression}`);
    }
    for (let index = 1; index <= 11; index += 1) {
      assert.equal(containsProperNoun(source, `Month ${index}`), false, `${file}: stale month ${index}`);
    }
  }
  const configuration = JSON.parse(sources.find(([file]) => file === 'config/nomenclature.json')[1]);
  assert.equal(Object.hasOwn(configuration.calendar, 'months'), false);
  assert.equal(JSON.stringify(configuration).includes('shortName'), false);
});
