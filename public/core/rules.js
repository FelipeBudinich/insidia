import {
  CELESTIAL_BODY_IDS,
  INTER_REGNUM_IDS,
  LUNAR_PHASE_IDS,
  MONTH_IDS,
  MONTH_RULER_IDS,
  NAMED_DAY_IDS,
  OUTCOME_TYPE_IDS,
  PULL_IDS,
  REIGN_ORDINAL_IDS,
  SEASON_IDS,
  TIDE_IDS,
  WEEKDAY_IDS
} from '../neutral-ids.js';

export {
  INTER_REGNUM_IDS,
  MONTH_IDS,
  MONTH_RULER_IDS,
  NAMED_DAY_IDS,
  REIGN_ORDINAL_IDS,
  WEEKDAY_IDS
};

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const nestedValue of Object.values(value)) deepFreeze(nestedValue);
    Object.freeze(value);
  }
  return value;
}

export const CALENDAR_EPOCH_UNIX_MS = 0;
export const REAL_MS_PER_FICTIONAL_SECOND = 997;
export const FICTIONAL_SECONDS_PER_MINUTE = 59;
export const FICTIONAL_MINUTES_PER_HOUR = 61;
export const FICTIONAL_HOURS_PER_DAY = 23;
export const FICTIONAL_DAYS_PER_WEEK = 7;
export const MONTHS_PER_YEAR = 11;
export const DAYS_PER_MONTH = 29;
export const INTER_REGNUM_LENGTHS = deepFreeze([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4]);
export const DAYS_PER_YEAR = 353;
export const FICTIONAL_SECONDS_PER_HOUR = FICTIONAL_SECONDS_PER_MINUTE * FICTIONAL_MINUTES_PER_HOUR;
export const FICTIONAL_SECONDS_PER_DAY = FICTIONAL_SECONDS_PER_HOUR * FICTIONAL_HOURS_PER_DAY;
export const SEASON_LENGTH_DAYS = 179;
export const SEASONS_PER_CYCLE = 2;
// Lunar seconds intentionally have a different real duration from calendar seconds.
export const REAL_MS_PER_LUNAR_SECOND = 1009;
export const LUNAR_SECONDS_PER_MINUTE = 59;
export const LUNAR_MINUTES_PER_HOUR = 67;
export const LUNAR_HOURS_PER_DAY = 31;
export const LUNAR_DAYS_PER_CYCLE = 13;
export const LUNAR_SECONDS_PER_HOUR = LUNAR_SECONDS_PER_MINUTE * LUNAR_MINUTES_PER_HOUR;
export const LUNAR_SECONDS_PER_DAY = LUNAR_SECONDS_PER_HOUR * LUNAR_HOURS_PER_DAY;
export const LUNAR_SECONDS_PER_CYCLE = LUNAR_SECONDS_PER_DAY * LUNAR_DAYS_PER_CYCLE;
export const ORBITAL_SPAN_TIE_EPSILON = 1e-12;
export const REAL_MS_PER_FICTIONAL_DAY = FICTIONAL_SECONDS_PER_DAY * REAL_MS_PER_FICTIONAL_SECOND;
export const REAL_MS_PER_LUNAR_DAY = LUNAR_SECONDS_PER_DAY * REAL_MS_PER_LUNAR_SECOND;
export const CALENDARIO_BOUNDARY_MILLISECONDS = deepFreeze([
  REAL_MS_PER_FICTIONAL_DAY,
  REAL_MS_PER_LUNAR_DAY
]);
export const TEMPORE_BOUNDARY_MILLISECONDS = deepFreeze([
  REAL_MS_PER_FICTIONAL_SECOND,
  REAL_MS_PER_LUNAR_SECOND
]);
export const DESTINO_BOUNDARY_MILLISECONDS = deepFreeze([
  REAL_MS_PER_FICTIONAL_SECOND,
  REAL_MS_PER_LUNAR_SECOND
]);

export const ALTERNATING_SKIP_RULER_ID = 'ruler-08';
export const MONTH_RULER_DECISION_HOUR = FICTIONAL_HOURS_PER_DAY - 1;
export const SEASON_MONTH_RULER_ROTATIONS = deepFreeze({
  'season-01': ['ruler-08', 'ruler-06', 'ruler-07', 'ruler-01'],
  'season-02': ['ruler-02', 'ruler-03', 'ruler-04', 'ruler-05']
});
export const ALTERNATING_SKIP_ORBITAL_THRESHOLD = 0.95;
export const ALTERNATING_SKIP_REPLACEMENT_RULES = deepFreeze([
  { bodyId: 'body-03', rulerId: 'ruler-02' },
  { bodyId: 'body-01', rulerId: 'ruler-05' },
  { bodyId: 'body-04', rulerId: 'ruler-03' },
  { bodyId: 'body-02', rulerId: 'ruler-04' },
  { bodyId: 'body-05', rulerId: 'ruler-01' },
  { bodyId: 'body-06', rulerId: 'ruler-06' }
]);
export const CALENDAR_NAMED_DAY_RULES = deepFreeze({
  month: [
    { day: 1, namedDayId: 'named-day-01' },
    { day: 7, namedDayId: 'named-day-02' },
    { day: 15, namedDayId: 'named-day-03' },
    { day: 23, namedDayId: 'named-day-04' }
  ],
  inter_regnum: [
    { day: 1, namedDayId: 'named-day-05' }
  ]
});

export const SEASON_RULES = deepFreeze([
  { id: SEASON_IDS[0], durationDays: SEASON_LENGTH_DAYS },
  { id: SEASON_IDS[1], durationDays: SEASON_LENGTH_DAYS }
]);

export const SEASONAL_CYCLE_LENGTH_DAYS = SEASON_RULES.reduce(
  (total, rule) => total + rule.durationDays,
  0
);

export const LUNAR_PHASE_RULES = deepFreeze([
  { id: LUNAR_PHASE_IDS[0], type: 'standard', stage: 'new', approximateIllumination: 0 },
  { id: LUNAR_PHASE_IDS[1], type: 'fictional', stage: 'waxing', approximateIllumination: 8 },
  { id: LUNAR_PHASE_IDS[2], type: 'standard', stage: 'waxing', approximateIllumination: 22 },
  { id: LUNAR_PHASE_IDS[3], type: 'fictional', stage: 'waxing', approximateIllumination: 38 },
  { id: LUNAR_PHASE_IDS[4], type: 'standard', stage: 'waxing', approximateIllumination: 50 },
  { id: LUNAR_PHASE_IDS[5], type: 'standard', stage: 'waxing', approximateIllumination: 75 },
  { id: LUNAR_PHASE_IDS[6], type: 'fictional', stage: 'waxing', approximateIllumination: 92 },
  { id: LUNAR_PHASE_IDS[7], type: 'standard', stage: 'full', approximateIllumination: 100 },
  { id: LUNAR_PHASE_IDS[8], type: 'fictional', stage: 'waning', approximateIllumination: 92 },
  { id: LUNAR_PHASE_IDS[9], type: 'standard', stage: 'waning', approximateIllumination: 75 },
  { id: LUNAR_PHASE_IDS[10], type: 'standard', stage: 'waning', approximateIllumination: 50 },
  { id: LUNAR_PHASE_IDS[11], type: 'standard', stage: 'waning', approximateIllumination: 22 },
  { id: LUNAR_PHASE_IDS[12], type: 'fictional', stage: 'waning', approximateIllumination: 8 }
]);

export const TIDE_RULES = deepFreeze([
  { id: TIDE_IDS[0], durationHours: 17 },
  { id: TIDE_IDS[1], durationHours: 13 },
  { id: TIDE_IDS[2], durationHours: 1 }
]);

export const CELESTIAL_BODY_RULES = deepFreeze([
  { id: CELESTIAL_BODY_IDS[0], kind: 'planet', orbitalPeriod: { unit: 'calendar_day', value: 89 }, tieBreakPriorityRank: 4 },
  { id: CELESTIAL_BODY_IDS[1], kind: 'planet', orbitalPeriod: { unit: 'calendar_day', value: 223 }, tieBreakPriorityRank: 2 },
  { id: CELESTIAL_BODY_IDS[2], kind: 'planet', orbitalPeriod: { unit: 'calendar_day', value: 683 }, tieBreakPriorityRank: 3 },
  { id: CELESTIAL_BODY_IDS[3], kind: 'planet', orbitalPeriod: { unit: 'calendar_day', value: 4337 }, tieBreakPriorityRank: 5 },
  { id: CELESTIAL_BODY_IDS[4], kind: 'planet', orbitalPeriod: { unit: 'calendar_day', value: 7919 }, tieBreakPriorityRank: 6 },
  { id: CELESTIAL_BODY_IDS[5], kind: 'satellite', orbitalPeriod: { unit: 'lunar_day', value: 13 }, tieBreakPriorityRank: 1 }
]);

export const PULL_RULES = deepFreeze([
  { id: PULL_IDS[0], selectionMethod: 'smallest_circular_arc' },
  { id: PULL_IDS[1], selectionMethod: 'second_ranked_circular_arc' },
  { id: PULL_IDS[2], selectionMethod: 'largest_circular_arc' }
]);

export const OUTCOME_TIDE_RULES = deepFreeze({
  'tide-02': { pullId: 'pull-01', selectionRuleId: 'selection-rule-01', target: 'maximum' },
  'tide-01': { pullId: 'pull-02', selectionRuleId: 'selection-rule-02', target: 'minimum' },
  'tide-03': { pullId: 'pull-03', selectionRuleId: 'selection-rule-03', target: 'median' }
});

export const OUTCOME_TYPE_RULES = deepFreeze([
  { id: OUTCOME_TYPE_IDS[0], maximumPercentage: 85 },
  { id: OUTCOME_TYPE_IDS[1], maximumPercentage: 99 },
  { id: OUTCOME_TYPE_IDS[2], maximumPercentage: null }
]);
