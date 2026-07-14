function numberedIds(prefix, count) {
  return Object.freeze(Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`
  ));
}

export const MONTH_IDS = numberedIds('month', 11);
export const MONTH_RULER_IDS = numberedIds('ruler', 8);
export const REIGN_ORDINAL_IDS = numberedIds('reign-ordinal', 11);
export const WEEKDAY_IDS = numberedIds('weekday', 7);
export const INTER_REGNUM_IDS = numberedIds('interregnum', 11);
export const NAMED_DAY_IDS = numberedIds('named-day', 5);
export const SEASON_IDS = numberedIds('season', 2);
export const LUNAR_PHASE_IDS = numberedIds('phase', 13);
export const TIDE_IDS = numberedIds('tide', 3);
export const CELESTIAL_BODY_IDS = numberedIds('body', 6);
export const PULL_IDS = numberedIds('pull', 3);
export const OUTCOME_TYPE_IDS = numberedIds('outcome-tier', 3);
