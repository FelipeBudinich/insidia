import {
  CELESTIAL_BODY_IDS,
  INTER_REGNUM_IDS,
  LUNAR_PHASE_IDS,
  NAMED_DAY_IDS,
  MONTH_RULER_IDS,
  OUTCOME_TYPE_IDS,
  PULL_IDS,
  REIGN_ORDINAL_IDS,
  SEASON_IDS,
  TIDE_IDS,
  WEEKDAY_IDS
} from './neutral-ids.js';
import { loadJsonConfiguration } from './config-loader.js';
import { NAVIGATION_GROUP_IDS, PAGE_IDS, PAGE_SECTION_IDS } from './page-definitions.js';

export const NOMENCLATURE_PATH = '/config/nomenclature.json';

const TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion', 'application', 'pages', 'navigationGroups', 'pageSections', 'outcomeTypes',
  'calendar', 'seasons', 'lunarPhases', 'lunarCycle', 'tides', 'celestialBodies', 'pulls'
]);

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertExactKeys(value, expectedKeys, label) {
  assertObject(value, label);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must contain exact required keys`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function validateEntities(items, expectedIds, label, entityKeys) {
  if (!Array.isArray(items)) throw new TypeError(`${label} must be an array`);
  if (items.length !== expectedIds.length) throw new Error(`${label} has an incorrect entity count`);
  const ids = items.map((item) => item?.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicate IDs`);
  if (JSON.stringify([...ids].sort()) !== JSON.stringify([...expectedIds].sort())) {
    throw new Error(`${label} must contain exact required IDs`);
  }
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
    throw new Error(`${label} must use canonical ID ordering`);
  }
  items.forEach((item, index) => {
    assertExactKeys(item, entityKeys, `${label}[${index}]`);
    assertNonEmptyString(item.id, `${label}[${index}].id`);
    assertNonEmptyString(item.name, `${label}[${index}].name`);
    if (entityKeys.includes('symbol')) assertNonEmptyString(item.symbol, `${label}[${index}].symbol`);
  });
}

export function validateNomenclature(nomenclature) {
  assertExactKeys(nomenclature, TOP_LEVEL_KEYS, 'nomenclature');
  if (nomenclature.schemaVersion !== 12) throw new Error('nomenclature schemaVersion must be 12');
  assertExactKeys(nomenclature.application, ['displayName'], 'nomenclature.application');
  assertNonEmptyString(nomenclature.application.displayName, 'nomenclature.application.displayName');
  validateEntities(nomenclature.pages, PAGE_IDS, 'nomenclature.pages', ['id', 'name']);
  validateEntities(nomenclature.navigationGroups, NAVIGATION_GROUP_IDS, 'nomenclature.navigationGroups', ['id', 'name']);
  validateEntities(nomenclature.pageSections, PAGE_SECTION_IDS, 'nomenclature.pageSections', ['id', 'name']);
  validateEntities(nomenclature.outcomeTypes, OUTCOME_TYPE_IDS, 'nomenclature.outcomeTypes', ['id', 'name']);
  assertExactKeys(nomenclature.calendar, ['yearName', 'monthReign', 'weekdays', 'namedDays', 'interRegna'], 'nomenclature.calendar');
  assertNonEmptyString(nomenclature.calendar.yearName, 'nomenclature.calendar.yearName');
  assertExactKeys(nomenclature.calendar.monthReign, ['name', 'rulers', 'ordinals'], 'nomenclature.calendar.monthReign');
  assertNonEmptyString(nomenclature.calendar.monthReign.name, 'nomenclature.calendar.monthReign.name');
  validateEntities(nomenclature.calendar.monthReign.rulers, MONTH_RULER_IDS, 'nomenclature.calendar.monthReign.rulers', ['id', 'name']);
  validateEntities(nomenclature.calendar.monthReign.ordinals, REIGN_ORDINAL_IDS, 'nomenclature.calendar.monthReign.ordinals', ['id', 'name']);
  validateEntities(nomenclature.calendar.weekdays, WEEKDAY_IDS, 'nomenclature.calendar.weekdays', ['id', 'name']);
  validateEntities(nomenclature.calendar.namedDays, NAMED_DAY_IDS, 'nomenclature.calendar.namedDays', ['id', 'name']);
  validateEntities(nomenclature.calendar.interRegna, INTER_REGNUM_IDS, 'nomenclature.calendar.interRegna', ['id', 'name']);
  validateEntities(nomenclature.seasons, SEASON_IDS, 'nomenclature.seasons', ['id', 'name']);
  assertExactKeys(nomenclature.lunarCycle, ['name'], 'nomenclature.lunarCycle');
  assertNonEmptyString(nomenclature.lunarCycle.name, 'nomenclature.lunarCycle.name');
  validateEntities(nomenclature.lunarPhases, LUNAR_PHASE_IDS, 'nomenclature.lunarPhases', ['id', 'name']);
  validateEntities(nomenclature.tides, TIDE_IDS, 'nomenclature.tides', ['id', 'name']);
  validateEntities(nomenclature.celestialBodies, CELESTIAL_BODY_IDS, 'nomenclature.celestialBodies', ['id', 'name', 'symbol']);
  validateEntities(nomenclature.pulls, PULL_IDS, 'nomenclature.pulls', ['id', 'name']);
  return nomenclature;
}

export async function loadNomenclature(options = {}) {
  assertObject(options, 'loadNomenclature options');
  const unknownOptions = Object.keys(options).filter((key) => !['fetchFn', 'baseUrl'].includes(key));
  if (unknownOptions.length > 0) throw new Error(`Unsupported nomenclature loader option: ${unknownOptions[0]}`);
  const fetchFn = options.fetchFn ?? window.fetch.bind(window);
  const baseUrl = options.baseUrl ?? window.location.href;
  const nomenclature = await loadJsonConfiguration({
    path: NOMENCLATURE_PATH,
    resourceName: 'nomenclature',
    fetchFn,
    baseUrl
  });
  const validated = validateNomenclature(nomenclature);
  return { schemaVersion: validated.schemaVersion, nomenclature: validated };
}
