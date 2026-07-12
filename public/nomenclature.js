import { formatTemplate } from './templates.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function mapItems(items) {
  return new Map(items.map((item) => [item.id, deepFreeze({ ...item })]));
}

function requireMapped(map, id, category) {
  const value = map.get(id);
  if (!value) throw new Error(`Unknown ${category} ID: ${id}`);
  return value;
}

export function createPresentationContext({ universeResult, localeResult }) {
  const { pack } = universeResult;
  const locale = localeResult.locale;
  const maps = {
    months: mapItems(pack.calendar.months),
    weekdays: mapItems(pack.calendar.weekdays),
    interRegna: mapItems(pack.calendar.interRegna),
    seasons: mapItems(pack.seasons.items),
    lunarPhases: mapItems(pack.lunarPhases.items),
    tides: mapItems(pack.tides.items),
    celestialBodies: mapItems(pack.celestialBodies.items),
    pulls: mapItems(pack.pulls.items),
    outcomeTypes: mapItems(pack.outcomeTypes.items)
  };
  const context = {
    requestedUniverseId: universeResult.requestedUniverseId,
    resolvedUniverseId: universeResult.resolvedUniverseId,
    requestedLocaleId: localeResult.requestedLocaleId,
    resolvedLocaleId: localeResult.resolvedLocaleId,
    universeDisplayName: pack.app.displayName,
    universeSchemaVersion: universeResult.schemaVersion,
    localeSchemaVersion: localeResult.schemaVersion,
    languageTag: locale.languageTag,
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
