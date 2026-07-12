import {
  CELESTIAL_BODY_RULES,
  INTER_REGNUM_IDS,
  LUNAR_PHASE_RULES,
  MONTH_IDS,
  OUTCOME_TYPE_RULES,
  PULL_RULES,
  SEASON_RULES,
  TIDE_RULES,
  WEEKDAY_IDS
} from './core/rules.js';

const REQUIRED_FILES = Object.freeze([
  'app', 'calendar', 'seasons', 'lunarPhases', 'tides',
  'celestialBodies', 'pulls', 'outcomeTypes'
]);
const FORBIDDEN_MECHANICAL_KEYS = new Set([
  'durationDays', 'durationHours', 'orbitalPeriod', 'orbitalPeriodDays',
  'orbitalPeriodLunarDays', 'threshold', 'maximumPercentage', 'tieBreakPriorityRank'
]);

async function fetchJson(url, fetchFn) {
  const response = await fetchFn(url.href, { cache: 'no-cache' });
  if (!response?.ok) throw new Error(`Unable to load JSON: ${url.pathname}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`Malformed JSON: ${url.pathname}`);
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertSchema(value, label) {
  assertObject(value, label);
  if (value.schemaVersion !== 1) throw new Error(`${label} schemaVersion must be 1`);
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`);
}

function assertNoMechanicalFields(value, path = 'universe') {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_MECHANICAL_KEYS.has(key)) throw new Error(`${path}.${key} is mechanical data`);
    assertNoMechanicalFields(nested, `${path}.${key}`);
  }
}

function validateExactItems(category, expectedIds, label, { symbol = false } = {}) {
  assertSchema(category, label);
  if (!Array.isArray(category.items)) throw new TypeError(`${label}.items must be an array`);
  const ids = category.items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicate IDs`);
  const expected = [...expectedIds].sort();
  const actual = [...ids].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} must contain exact required IDs`);
  category.items.forEach((item, index) => {
    assertObject(item, `${label}.items[${index}]`);
    assertNonEmptyString(item.name, `${label}.items[${index}].name`);
    if (symbol) assertNonEmptyString(item.symbol, `${label}.items[${index}].symbol`);
  });
}

function validateCalendar(category) {
  assertSchema(category, 'calendar');
  for (const [key, expectedIds] of [
    ['months', MONTH_IDS], ['weekdays', WEEKDAY_IDS], ['interRegna', INTER_REGNUM_IDS]
  ]) {
    if (!Array.isArray(category[key])) throw new TypeError(`calendar.${key} must be an array`);
    const ids = category[key].map((item) => item.id);
    if (new Set(ids).size !== ids.length) throw new Error(`calendar.${key} contains duplicate IDs`);
    if (JSON.stringify([...ids].sort()) !== JSON.stringify([...expectedIds].sort())) {
      throw new Error(`calendar.${key} must contain exact required IDs`);
    }
    category[key].forEach((item, index) => {
      assertNonEmptyString(item.name, `calendar.${key}[${index}].name`);
      if (key !== 'interRegna') assertNonEmptyString(item.shortName, `calendar.${key}[${index}].shortName`);
    });
  }
}

export function validateUniverseIndex(index) {
  assertSchema(index, 'universe index');
  assertNonEmptyString(index.defaultUniverseId, 'defaultUniverseId');
  if (!Array.isArray(index.universes) || index.universes.length === 0) throw new Error('universes must not be empty');
  const ids = index.universes.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error('Universe IDs must be unique');
  index.universes.forEach((entry, indexValue) => {
    assertNonEmptyString(entry.id, `universes[${indexValue}].id`);
    assertNonEmptyString(entry.manifest, `universes[${indexValue}].manifest`);
  });
  if (!ids.includes(index.defaultUniverseId)) throw new Error('Default universe is not indexed');
}

export function validateUniversePack(pack) {
  assertSchema(pack.manifest, 'universe manifest');
  if (pack.manifest.id !== pack.id) throw new Error('Manifest ID does not match selected universe');
  assertObject(pack.manifest.files, 'manifest.files');
  if (JSON.stringify(Object.keys(pack.manifest.files).sort()) !== JSON.stringify([...REQUIRED_FILES].sort())) {
    throw new Error('Manifest must contain every required category');
  }
  assertSchema(pack.app, 'app');
  assertNonEmptyString(pack.app.displayName, 'app.displayName');
  validateCalendar(pack.calendar);
  validateExactItems(pack.seasons, SEASON_RULES.map((rule) => rule.id), 'seasons');
  validateExactItems(pack.lunarPhases, LUNAR_PHASE_RULES.map((rule) => rule.id), 'lunarPhases');
  validateExactItems(pack.tides, TIDE_RULES.map((rule) => rule.id), 'tides');
  validateExactItems(pack.celestialBodies, CELESTIAL_BODY_RULES.map((rule) => rule.id), 'celestialBodies', { symbol: true });
  validateExactItems(pack.pulls, PULL_RULES.map((rule) => rule.id), 'pulls');
  validateExactItems(pack.outcomeTypes, OUTCOME_TYPE_RULES.map((rule) => rule.id), 'outcomeTypes');
  assertNoMechanicalFields(pack);
  return pack;
}

function safeConfiguredUrl(path, baseUrl, label) {
  const url = new URL(path, baseUrl);
  const base = new URL(baseUrl);
  if (url.origin !== base.origin) throw new Error(`${label} must be same-origin`);
  return url;
}

export async function loadUniverse({ requestedId, fetchFn = window.fetch.bind(window), baseUrl = window.location.href }) {
  const indexUrl = safeConfiguredUrl('/universes/index.json', baseUrl, 'Universe index');
  const index = await fetchJson(indexUrl, fetchFn);
  validateUniverseIndex(index);
  const requestedUniverseId = requestedId || index.defaultUniverseId;
  const entry = index.universes.find((candidate) => candidate.id === requestedUniverseId)
    ?? index.universes.find((candidate) => candidate.id === index.defaultUniverseId);
  const resolvedUniverseId = entry.id;
  const manifestUrl = safeConfiguredUrl(entry.manifest, indexUrl, 'Universe manifest');
  const manifest = await fetchJson(manifestUrl, fetchFn);
  assertSchema(manifest, 'universe manifest');
  if (manifest.id !== resolvedUniverseId) throw new Error('Manifest ID does not match selected universe');
  const directory = new URL('./', manifestUrl);
  const fileUrls = {};
  for (const category of REQUIRED_FILES) {
    const configuredPath = manifest.files?.[category];
    assertNonEmptyString(configuredPath, `manifest.files.${category}`);
    const url = safeConfiguredUrl(configuredPath, manifestUrl, `Universe ${category}`);
    if (!url.pathname.startsWith(directory.pathname)) throw new Error(`Universe ${category} escapes selected directory`);
    fileUrls[category] = url;
  }
  const values = await Promise.all(REQUIRED_FILES.map((category) => fetchJson(fileUrls[category], fetchFn)));
  const pack = { id: resolvedUniverseId, manifest };
  REQUIRED_FILES.forEach((category, indexValue) => { pack[category] = values[indexValue]; });
  validateUniversePack(pack);
  return { requestedUniverseId, resolvedUniverseId, schemaVersion: manifest.schemaVersion, pack };
}
