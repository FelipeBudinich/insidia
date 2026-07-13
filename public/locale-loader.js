export const MESSAGE_KEYS = Object.freeze([
  'nav.aria',
  'section.time', 'section.season', 'section.tide', 'section.pulls', 'section.orbits', 'section.progress', 'section.json',
  'label.year', 'label.month', 'label.week', 'label.day', 'label.hour', 'label.cycle', 'label.orbit', 'label.seasonalDay', 'label.next', 'label.progress',
  'label.currentFictionalTime', 'label.currentLunarTime', 'label.currentLunarDay', 'label.currentDay', 'label.currentHour', 'label.currentTideProgress',
  'label.attemptsUntilRare', 'label.orbitalProgress', 'label.circularSpan', 'label.alignment', 'label.currentLocation', 'label.epoch', 'label.copyJson',
  'status.copied', 'status.copyFailure', 'status.tieBreakApplied',
  'selection.selection-rule-01', 'selection.selection-rule-02', 'selection.selection-rule-03',
  'clarification.pulls', 'accessibility.applicationVersion', 'accessibility.seasonProgress', 'accessibility.copyStatus', 'error.configuration'
]);

export const TEMPLATE_KEYS = Object.freeze([
  'document.title', 'document.page-01Description', 'document.page-02Description', 'document.page-03Description',
  'document.page-04Description', 'document.page-05Description', 'document.page-06Description', 'document.page-07Description',
  'document.page-08Description', 'document.page-09Description',
  'accessibility.version', 'accessibility.orbitProgress',
  'calendar.formattedYear', 'calendar.firstMonthReign', 'calendar.repeatedMonthReign',
  'calendar.monthPeriod', 'calendar.interPeriod', 'calendar.formattedDate',
  'lunar.summary', 'season.metadata', 'season.cycle', 'season.next', 'season.progress',
  'tide.metadata', 'tide.time', 'outcome.attempts', 'outcome.source', 'outcome.progress',
  'orbit.calendarPeriod', 'orbit.lunarPeriod', 'orbit.metadata',
  'pull.members', 'pull.span', 'pull.alignment', 'pull.tie', 'pull.noTie', 'footer.epoch'
]);

export const DEFAULT_LOCALE_ID = 'en';

export const LOCALE_FILES = Object.freeze({
  en: '/locales/en.json',
  es: '/locales/es.json'
});

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

function assertExactObjectKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    throw new Error(`${label} must contain exact required keys`);
  }
}

export function validateLocale(locale) {
  assertExactObjectKeys(locale, ['schemaVersion', 'id', 'languageTag', 'messages', 'templates'], 'locale');
  if (locale.schemaVersion !== 9) throw new Error('locale schemaVersion must be 9');
  assertNonEmpty(locale.id, 'locale.id');
  assertNonEmpty(locale.languageTag, 'locale.languageTag');
  assertExactKeys(locale.messages, MESSAGE_KEYS, 'locale.messages');
  assertExactKeys(locale.templates, TEMPLATE_KEYS, 'locale.templates');
  return locale;
}

async function fetchJson(url, fetchFn) {
  const response = await fetchFn(url.href, { cache: 'no-cache' });
  if (!response?.ok) throw new Error(`Unable to load JSON: ${url.pathname}`);
  try { return await response.json(); } catch { throw new Error(`Malformed JSON: ${url.pathname}`); }
}

export async function loadLocale({ requestedId, fetchFn = window.fetch.bind(window), baseUrl = window.location.href }) {
  const base = new URL(baseUrl);
  const requestedLocaleId = requestedId || DEFAULT_LOCALE_ID;
  const resolvedLocaleId = Object.hasOwn(LOCALE_FILES, requestedLocaleId)
    ? requestedLocaleId
    : DEFAULT_LOCALE_ID;
  const fileUrl = new URL(LOCALE_FILES[resolvedLocaleId], base);
  if (fileUrl.origin !== base.origin) throw new Error('Locale file must be same-origin');
  const locale = validateLocale(await fetchJson(fileUrl, fetchFn));
  if (locale.id !== resolvedLocaleId) throw new Error('Locale ID does not match registry');
  return { requestedLocaleId, resolvedLocaleId, schemaVersion: locale.schemaVersion, locale };
}
