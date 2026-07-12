import {
  CELESTIAL_BODY_RULES,
  INTER_REGNUM_IDS,
  LUNAR_PHASE_RULES,
  MONTH_IDS,
  PULL_RULES,
  SEASON_RULES,
  TIDE_RULES,
  WEEKDAY_IDS
} from './core/rules.js';
import { PAGE_IDS } from './page-definitions.js';

export const NOMENCLATURE_PATH = '/config/nomenclature.json';

const TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion', 'application', 'pages', 'calendar', 'seasons', 'lunarPhases',
  'tides', 'celestialBodies', 'pulls'
]);

const FORBIDDEN_KEYS = new Set([
  'durationDays', 'durationHours', 'orbitalPeriod', 'orbitalPeriodDays',
  'orbitalPeriodLunarDays', 'tieBreakPriorityRank', 'threshold',
  'maximumPercentage', 'outcomeTypes', 'messages', 'templates', 'route'
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

function assertNoForbiddenKeys(value, location = 'nomenclature') {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`${location}.${key} is not nomenclature data`);
    assertNoForbiddenKeys(nested, `${location}.${key}`);
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
  items.forEach((item, index) => {
    assertExactKeys(item, entityKeys, `${label}[${index}]`);
    assertNonEmptyString(item.id, `${label}[${index}].id`);
    assertNonEmptyString(item.name, `${label}[${index}].name`);
    if (entityKeys.includes('shortName')) assertNonEmptyString(item.shortName, `${label}[${index}].shortName`);
    if (entityKeys.includes('symbol')) assertNonEmptyString(item.symbol, `${label}[${index}].symbol`);
  });
}

export function validateNomenclature(nomenclature) {
  assertExactKeys(nomenclature, TOP_LEVEL_KEYS, 'nomenclature');
  if (nomenclature.schemaVersion !== 3) throw new Error('nomenclature schemaVersion must be 3');
  assertExactKeys(nomenclature.application, ['displayName'], 'nomenclature.application');
  assertNonEmptyString(nomenclature.application.displayName, 'nomenclature.application.displayName');
  validateEntities(nomenclature.pages, PAGE_IDS, 'nomenclature.pages', ['id', 'name']);
  assertExactKeys(nomenclature.calendar, ['months', 'weekdays', 'interRegna'], 'nomenclature.calendar');
  validateEntities(nomenclature.calendar.months, MONTH_IDS, 'nomenclature.calendar.months', ['id', 'name', 'shortName']);
  validateEntities(nomenclature.calendar.weekdays, WEEKDAY_IDS, 'nomenclature.calendar.weekdays', ['id', 'name']);
  validateEntities(nomenclature.calendar.interRegna, INTER_REGNUM_IDS, 'nomenclature.calendar.interRegna', ['id', 'name']);
  validateEntities(nomenclature.seasons, SEASON_RULES.map(({ id }) => id), 'nomenclature.seasons', ['id', 'name']);
  validateEntities(nomenclature.lunarPhases, LUNAR_PHASE_RULES.map(({ id }) => id), 'nomenclature.lunarPhases', ['id', 'name']);
  validateEntities(nomenclature.tides, TIDE_RULES.map(({ id }) => id), 'nomenclature.tides', ['id', 'name']);
  validateEntities(nomenclature.celestialBodies, CELESTIAL_BODY_RULES.map(({ id }) => id), 'nomenclature.celestialBodies', ['id', 'name', 'symbol']);
  validateEntities(nomenclature.pulls, PULL_RULES.map(({ id }) => id), 'nomenclature.pulls', ['id', 'name']);
  assertNoForbiddenKeys(nomenclature);
  return nomenclature;
}

export async function loadNomenclature(options = {}) {
  assertObject(options, 'loadNomenclature options');
  const unknownOptions = Object.keys(options).filter((key) => !['fetchFn', 'baseUrl'].includes(key));
  if (unknownOptions.length > 0) throw new Error(`Unsupported nomenclature loader option: ${unknownOptions[0]}`);
  const fetchFn = options.fetchFn ?? window.fetch.bind(window);
  const baseUrl = options.baseUrl ?? window.location.href;
  const base = new URL(baseUrl);
  const url = new URL(NOMENCLATURE_PATH, base);
  if (url.origin !== base.origin) throw new Error('Nomenclature file must be same-origin');
  const response = await fetchFn(url.href, { cache: 'no-cache' });
  if (!response?.ok) throw new Error(`Unable to load nomenclature: ${url.pathname}`);
  let nomenclature;
  try {
    nomenclature = await response.json();
  } catch {
    throw new Error(`Malformed JSON: ${url.pathname}`);
  }
  const validated = validateNomenclature(nomenclature);
  return { schemaVersion: validated.schemaVersion, nomenclature: validated };
}
