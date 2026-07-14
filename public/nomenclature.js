import { formatTemplate } from './templates.js';
import {
  INTERFACE_LANGUAGE_TAG,
  INTERFACE_MESSAGES,
  INTERFACE_TEMPLATES
} from './interface-text.js';

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

export function createPresentationContext({ nomenclatureResult }) {
  const nomenclature = nomenclatureResult.nomenclature;
  const maps = {
    pages: mapItems(nomenclature.pages),
    navigationGroups: mapItems(nomenclature.navigationGroups),
    pageSections: mapItems(nomenclature.pageSections),
    monthRulers: mapItems(nomenclature.calendar.monthReign.rulers),
    reignOrdinals: mapItems(nomenclature.calendar.monthReign.ordinals),
    weekdays: mapItems(nomenclature.calendar.weekdays),
    namedDays: mapItems(nomenclature.calendar.namedDays),
    interRegna: mapItems(nomenclature.calendar.interRegna),
    seasons: mapItems(nomenclature.seasons),
    lunarPhases: mapItems(nomenclature.lunarPhases),
    tides: mapItems(nomenclature.tides),
    celestialBodies: mapItems(nomenclature.celestialBodies),
    pulls: mapItems(nomenclature.pulls),
    outcomeTypes: mapItems(nomenclature.outcomeTypes)
  };
  const context = {
    applicationDisplayName: nomenclature.application.displayName,
    calendarYearName: nomenclature.calendar.yearName,
    monthReignName: nomenclature.calendar.monthReign.name,
    lunarCycleName: nomenclature.lunarCycle.name,
    nomenclatureSchemaVersion: nomenclatureResult.schemaVersion,
    languageTag: INTERFACE_LANGUAGE_TAG,
    getPage: (id) => requireMapped(maps.pages, id, 'page'),
    getNavigationGroup: (id) => requireMapped(maps.navigationGroups, id, 'navigation group'),
    getPageSection: (id) => requireMapped(maps.pageSections, id, 'page section'),
    getMonthRuler: (id) => requireMapped(maps.monthRulers, id, 'month ruler'),
    getReignOrdinal: (id) => requireMapped(maps.reignOrdinals, id, 'reign ordinal'),
    getWeekday: (id) => requireMapped(maps.weekdays, id, 'weekday'),
    getNamedDay: (id) => requireMapped(maps.namedDays, id, 'named day'),
    getInterRegnum: (id) => requireMapped(maps.interRegna, id, 'interregnum'),
    getSeason: (id) => requireMapped(maps.seasons, id, 'season'),
    getLunarPhase: (id) => requireMapped(maps.lunarPhases, id, 'phase'),
    getTide: (id) => requireMapped(maps.tides, id, 'tide'),
    getCelestialBody: (id) => requireMapped(maps.celestialBodies, id, 'body'),
    getPull: (id) => requireMapped(maps.pulls, id, 'pull'),
    getOutcomeType: (id) => requireMapped(maps.outcomeTypes, id, 'outcome type'),
    message(key) {
      const value = INTERFACE_MESSAGES[key];
      if (value === undefined) throw new Error(`Missing interface message: ${key}`);
      return value;
    },
    format(key, values) {
      const template = INTERFACE_TEMPLATES[key];
      if (template === undefined) throw new Error(`Missing interface template: ${key}`);
      return formatTemplate(template, values);
    }
  };
  return Object.freeze(context);
}
