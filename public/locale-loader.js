export const MESSAGE_KEYS = Object.freeze([
  'nav.aria', 'nav.calendar', 'nav.outcome', 'nav.weather',
  'page.calendar', 'page.outcome', 'page.weather',
  'section.time', 'section.season', 'section.lunar', 'section.tide', 'section.pulls', 'section.orbits', 'section.progress', 'section.json',
  'label.phase', 'label.year', 'label.month', 'label.week', 'label.day', 'label.hour', 'label.lunarDay', 'label.cycle', 'label.orbit', 'label.seasonalDay', 'label.next', 'label.progress',
  'label.currentFictionalTime', 'label.currentLunarTime', 'label.currentLunarDay', 'label.currentDay', 'label.currentHour',
  'label.outcome', 'label.attemptsUntilRare', 'label.orbitalProgress', 'label.circularSpan', 'label.alignment', 'label.epoch', 'label.copyJson',
  'status.copied', 'status.copyFailure', 'status.tieBreakApplied',
  'selection.selection-rule-01', 'selection.selection-rule-02', 'selection.selection-rule-03',
  'clarification.pulls', 'accessibility.applicationVersion', 'accessibility.seasonProgress', 'accessibility.copyStatus', 'error.configuration'
]);

export const TEMPLATE_KEYS = Object.freeze([
  'document.title', 'document.calendarDescription', 'document.outcomeDescription', 'document.weatherDescription',
  'accessibility.version', 'accessibility.orbitProgress',
  'calendar.monthPeriod', 'calendar.interPeriod', 'calendar.formattedDate', 'calendar.metadata',
  'lunar.metadata', 'season.metadata', 'season.cycle', 'season.next', 'season.progress',
  'tide.metadata', 'tide.time', 'outcome.type', 'outcome.attempts', 'outcome.source', 'outcome.progress',
  'orbit.calendarPeriod', 'orbit.lunarPeriod', 'orbit.metadata',
  'pull.members', 'pull.span', 'pull.alignment', 'pull.tie', 'pull.noTie', 'footer.epoch'
]);

export const OUTCOME_TYPE_IDS = Object.freeze([
  'outcome-tier-01',
  'outcome-tier-02',
  'outcome-tier-03'
]);

function assertNonEmpty(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`);
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    throw new Error(`${label} must contain exact required keys`);
  }
  Object.entries(value).forEach(([key, text]) => assertNonEmpty(text, `${label}.${key}`));
}

function validateOutcomeTypes(outcomeTypes) {
  if (!outcomeTypes || typeof outcomeTypes !== 'object' || Array.isArray(outcomeTypes)) {
    throw new TypeError('locale.outcomeTypes must be an object');
  }
  if (JSON.stringify(Object.keys(outcomeTypes).sort()) !== JSON.stringify([...OUTCOME_TYPE_IDS].sort())) {
    throw new Error('locale.outcomeTypes must contain exact required IDs');
  }
  for (const id of OUTCOME_TYPE_IDS) {
    const outcomeType = outcomeTypes[id];
    if (!outcomeType || typeof outcomeType !== 'object' || Array.isArray(outcomeType)) {
      throw new TypeError(`locale.outcomeTypes.${id} must be an object`);
    }
    if (JSON.stringify(Object.keys(outcomeType)) !== JSON.stringify(['name'])) {
      throw new Error(`locale.outcomeTypes.${id} must contain only name`);
    }
    assertNonEmpty(outcomeType.name, `locale.outcomeTypes.${id}.name`);
  }
}

export function validateLocale(locale) {
  if (!locale || typeof locale !== 'object' || Array.isArray(locale)) throw new TypeError('locale must be an object');
  if (locale.schemaVersion !== 1) throw new Error('locale schemaVersion must be 1');
  assertNonEmpty(locale.id, 'locale.id');
  assertNonEmpty(locale.languageTag, 'locale.languageTag');
  validateOutcomeTypes(locale.outcomeTypes);
  assertExactKeys(locale.messages, MESSAGE_KEYS, 'locale.messages');
  assertExactKeys(locale.templates, TEMPLATE_KEYS, 'locale.templates');
  return locale;
}

export function validateLocaleIndex(index) {
  if (!index || typeof index !== 'object' || index.schemaVersion !== 1) throw new Error('locale index schemaVersion must be 1');
  if (!Array.isArray(index.locales) || index.locales.length === 0) throw new Error('locales must not be empty');
  const ids = index.locales.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error('Locale IDs must be unique');
  if (!ids.includes(index.defaultLocaleId)) throw new Error('Default locale is not indexed');
}

async function fetchJson(url, fetchFn) {
  const response = await fetchFn(url.href, { cache: 'no-cache' });
  if (!response?.ok) throw new Error(`Unable to load JSON: ${url.pathname}`);
  try { return await response.json(); } catch { throw new Error(`Malformed JSON: ${url.pathname}`); }
}

export async function loadLocale({ requestedId, fetchFn = window.fetch.bind(window), baseUrl = window.location.href }) {
  const base = new URL(baseUrl);
  const indexUrl = new URL('/locales/index.json', base);
  const index = await fetchJson(indexUrl, fetchFn);
  validateLocaleIndex(index);
  const requestedLocaleId = requestedId || index.defaultLocaleId;
  const entry = index.locales.find((candidate) => candidate.id === requestedLocaleId)
    ?? index.locales.find((candidate) => candidate.id === index.defaultLocaleId);
  const fileUrl = new URL(entry.file, indexUrl);
  if (fileUrl.origin !== base.origin) throw new Error('Locale file must be same-origin');
  const locale = validateLocale(await fetchJson(fileUrl, fetchFn));
  if (locale.id !== entry.id) throw new Error('Locale ID does not match index');
  return { requestedLocaleId, resolvedLocaleId: entry.id, schemaVersion: locale.schemaVersion, locale };
}
