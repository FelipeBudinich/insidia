export const CALENDAR_EPOCH_UNIX_MS = 0;
export const REAL_MS_PER_FICTIONAL_SECOND = 997;
export const FICTIONAL_SECONDS_PER_MINUTE = 59;
export const FICTIONAL_MINUTES_PER_HOUR = 61;
export const FICTIONAL_HOURS_PER_DAY = 23;
export const FICTIONAL_DAYS_PER_WEEK = 7;
export const MONTHS_PER_YEAR = 11;
export const DAYS_PER_MONTH = 29;
export const INTER_REGNUM_LENGTHS = Object.freeze([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4]);
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

export const MONTH_IDS = Object.freeze(Array.from({ length: 11 }, (_, index) => `month-${String(index + 1).padStart(2, '0')}`));
export const MONTH_RULER_IDS = Object.freeze([
  'ruler-01',
  'ruler-02',
  'ruler-03',
  'ruler-04',
  'ruler-05',
  'ruler-06',
  'ruler-07',
  'ruler-08'
]);
export const REIGN_ORDINAL_IDS = Object.freeze(
  Array.from({ length: MONTHS_PER_YEAR }, (_, index) => `reign-ordinal-${String(index + 1).padStart(2, '0')}`)
);
export const ALTERNATING_SKIP_RULER_ID = 'ruler-08';
export const MONTH_RULER_DECISION_HOUR = FICTIONAL_HOURS_PER_DAY - 1;
export const SEASON_MONTH_RULER_ROTATIONS = Object.freeze({
  'season-01': Object.freeze(['ruler-08', 'ruler-06', 'ruler-07', 'ruler-01']),
  'season-02': Object.freeze(['ruler-02', 'ruler-03', 'ruler-04', 'ruler-05'])
});
export const ALTERNATING_SKIP_ORBITAL_THRESHOLD = 0.95;
export const ALTERNATING_SKIP_REPLACEMENT_RULES = Object.freeze([
  Object.freeze({ bodyId: 'body-03', rulerId: 'ruler-02' }),
  Object.freeze({ bodyId: 'body-01', rulerId: 'ruler-05' }),
  Object.freeze({ bodyId: 'body-04', rulerId: 'ruler-03' }),
  Object.freeze({ bodyId: 'body-02', rulerId: 'ruler-04' }),
  Object.freeze({ bodyId: 'body-05', rulerId: 'ruler-01' }),
  Object.freeze({ bodyId: 'body-06', rulerId: 'ruler-06' })
]);
export const WEEKDAY_IDS = Object.freeze(Array.from({ length: 7 }, (_, index) => `weekday-${String(index + 1).padStart(2, '0')}`));
export const INTER_REGNUM_IDS = Object.freeze(Array.from({ length: 11 }, (_, index) => `interregnum-${String(index + 1).padStart(2, '0')}`));
export const NAMED_DAY_IDS = Object.freeze([
  'named-day-01',
  'named-day-02',
  'named-day-03',
  'named-day-04',
  'named-day-05'
]);
export const CALENDAR_NAMED_DAY_RULES = Object.freeze({
  month: Object.freeze([
    Object.freeze({ day: 1, namedDayId: 'named-day-01' }),
    Object.freeze({ day: 7, namedDayId: 'named-day-02' }),
    Object.freeze({ day: 15, namedDayId: 'named-day-03' }),
    Object.freeze({ day: 23, namedDayId: 'named-day-04' })
  ]),
  inter_regnum: Object.freeze([
    Object.freeze({ day: 1, namedDayId: 'named-day-05' })
  ])
});

export const SEASON_RULES = Object.freeze([
  { id: 'season-01', durationDays: SEASON_LENGTH_DAYS },
  { id: 'season-02', durationDays: SEASON_LENGTH_DAYS }
]);

export const SEASONAL_CYCLE_LENGTH_DAYS = SEASON_RULES.reduce(
  (total, rule) => total + rule.durationDays,
  0
);

export const LUNAR_PHASE_RULES = Object.freeze([
  { id: 'phase-01', type: 'standard', stage: 'new', approximateIllumination: 0 },
  { id: 'phase-02', type: 'fictional', stage: 'waxing', approximateIllumination: 8 },
  { id: 'phase-03', type: 'standard', stage: 'waxing', approximateIllumination: 22 },
  { id: 'phase-04', type: 'fictional', stage: 'waxing', approximateIllumination: 38 },
  { id: 'phase-05', type: 'standard', stage: 'waxing', approximateIllumination: 50 },
  { id: 'phase-06', type: 'standard', stage: 'waxing', approximateIllumination: 75 },
  { id: 'phase-07', type: 'fictional', stage: 'waxing', approximateIllumination: 92 },
  { id: 'phase-08', type: 'standard', stage: 'full', approximateIllumination: 100 },
  { id: 'phase-09', type: 'fictional', stage: 'waning', approximateIllumination: 92 },
  { id: 'phase-10', type: 'standard', stage: 'waning', approximateIllumination: 75 },
  { id: 'phase-11', type: 'standard', stage: 'waning', approximateIllumination: 50 },
  { id: 'phase-12', type: 'standard', stage: 'waning', approximateIllumination: 22 },
  { id: 'phase-13', type: 'fictional', stage: 'waning', approximateIllumination: 8 }
]);

export const TIDE_RULES = Object.freeze([
  { id: 'tide-01', durationHours: 17 },
  { id: 'tide-02', durationHours: 13 },
  { id: 'tide-03', durationHours: 1 }
]);

export const CELESTIAL_BODY_RULES = Object.freeze([
  { id: 'body-01', kind: 'planet', orbitalPeriod: { unit: 'calendar_day', value: 89 }, tieBreakPriorityRank: 4 },
  { id: 'body-02', kind: 'planet', orbitalPeriod: { unit: 'calendar_day', value: 223 }, tieBreakPriorityRank: 2 },
  { id: 'body-03', kind: 'planet', orbitalPeriod: { unit: 'calendar_day', value: 683 }, tieBreakPriorityRank: 3 },
  { id: 'body-04', kind: 'planet', orbitalPeriod: { unit: 'calendar_day', value: 4337 }, tieBreakPriorityRank: 5 },
  { id: 'body-05', kind: 'planet', orbitalPeriod: { unit: 'calendar_day', value: 7919 }, tieBreakPriorityRank: 6 },
  { id: 'body-06', kind: 'satellite', orbitalPeriod: { unit: 'lunar_day', value: 13 }, tieBreakPriorityRank: 1 }
]);

export const PULL_RULES = Object.freeze([
  { id: 'pull-01', selectionMethod: 'smallest_circular_arc' },
  { id: 'pull-02', selectionMethod: 'second_ranked_circular_arc' },
  { id: 'pull-03', selectionMethod: 'largest_circular_arc' }
]);

export const OUTCOME_TIDE_RULES = Object.freeze({
  'tide-02': { pullId: 'pull-01', selectionRuleId: 'selection-rule-01', target: 'maximum' },
  'tide-01': { pullId: 'pull-02', selectionRuleId: 'selection-rule-02', target: 'minimum' },
  'tide-03': { pullId: 'pull-03', selectionRuleId: 'selection-rule-03', target: 'median' }
});

export const OUTCOME_TYPE_RULES = Object.freeze([
  { id: 'outcome-tier-01', maximumPercentage: 85 },
  { id: 'outcome-tier-02', maximumPercentage: 99 },
  { id: 'outcome-tier-03', maximumPercentage: null }
]);
