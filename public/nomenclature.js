import { formatTemplate } from './templates.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function mapItems(items) {
  return new Map(items.map((item) => [item.id, deepFreeze({ ...item })]));
}

function mapRecord(record) {
  return new Map(Object.entries(record).map(([id, item]) => [id, deepFreeze({ id, ...item })]));
}

function requireMapped(map, id, category) {
  const value = map.get(id);
  if (!value) throw new Error(`Unknown ${category} ID: ${id}`);
  return value;
}

export function createPresentationContext({ nomenclatureResult, localeResult }) {
  const nomenclature = nomenclatureResult.nomenclature;
  const locale = localeResult.locale;
  const maps = {
    pages: mapItems(nomenclature.pages),
    months: mapItems(nomenclature.calendar.months),
    weekdays: mapItems(nomenclature.calendar.weekdays),
    interRegna: mapItems(nomenclature.calendar.interRegna),
    seasons: mapItems(nomenclature.seasons),
    lunarPhases: mapItems(nomenclature.lunarPhases),
    tides: mapItems(nomenclature.tides),
    celestialBodies: mapItems(nomenclature.celestialBodies),
    pulls: mapItems(nomenclature.pulls),
    outcomeTypes: mapRecord(locale.outcomeTypes)
  };
  const context = {
    requestedLocaleId: localeResult.requestedLocaleId,
    resolvedLocaleId: localeResult.resolvedLocaleId,
    applicationDisplayName: nomenclature.application.displayName,
    calendarYearName: nomenclature.calendar.yearName,
    nomenclatureSchemaVersion: nomenclatureResult.schemaVersion,
    localeSchemaVersion: localeResult.schemaVersion,
    languageTag: locale.languageTag,
    getPage: (id) => requireMapped(maps.pages, id, 'page'),
    getMonth: (id) => requireMapped(maps.months, id, 'month'),
    getWeekday: (id) => requireMapped(maps.weekdays, id, 'weekday'),
    getInterRegnum: (id) => requireMapped(maps.interRegna, id, 'interregnum'),
    getSeason: (id) => requireMapped(maps.seasons, id, 'season'),
    getLunarPhase: (id) => requireMapped(maps.lunarPhases, id, 'phase'),
    getTide: (id) => requireMapped(maps.tides, id, 'tide'),
    getCelestialBody: (id) => requireMapped(maps.celestialBodies, id, 'body'),
    getPull: (id) => requireMapped(maps.pulls, id, 'pull'),
    getOutcomeType: (id) => requireMapped(maps.outcomeTypes, id, 'outcome type'),
    message(key) {
      const value = locale.messages[key];
      if (value === undefined) throw new Error(`Missing locale message: ${key}`);
      return value;
    },
    format(key, values) {
      const template = locale.templates[key];
      if (template === undefined) throw new Error(`Missing locale template: ${key}`);
      return formatTemplate(template, values);
    }
  };
  return Object.freeze(context);
}
