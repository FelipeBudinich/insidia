export const CALENDAR_EPOCH_UNIX_MS = 0;
export const REAL_MS_PER_FICTIONAL_SECOND = 997;
export const FICTIONAL_SECONDS_PER_MINUTE = 59;
export const FICTIONAL_MINUTES_PER_HOUR = 61;
export const FICTIONAL_HOURS_PER_DAY = 23;
export const FICTIONAL_DAYS_PER_WEEK = 7;
export const MONTHS_PER_YEAR = 11;
export const DAYS_PER_MONTH = 29;
export const INTER_REGNUM_LENGTHS = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4];
export const DAYS_PER_YEAR = 353;
export const FICTIONAL_SECONDS_PER_HOUR = FICTIONAL_SECONDS_PER_MINUTE * FICTIONAL_MINUTES_PER_HOUR;
export const FICTIONAL_SECONDS_PER_DAY = FICTIONAL_SECONDS_PER_HOUR * FICTIONAL_HOURS_PER_DAY;
export const SEASON_LENGTH_DAYS = 179;
export const SEASONS_PER_CYCLE = 2;
export const FICTIONAL_HOURS_PER_LUNAR_DAY = 31;
export const LUNAR_DAYS_PER_CYCLE = 13;
export const FICTIONAL_SECONDS_PER_LUNAR_DAY = FICTIONAL_SECONDS_PER_HOUR * FICTIONAL_HOURS_PER_LUNAR_DAY;
export const FICTIONAL_SECONDS_PER_LUNAR_CYCLE = FICTIONAL_SECONDS_PER_LUNAR_DAY * LUNAR_DAYS_PER_CYCLE;

export const MOON_PHASES = [
  { id: 'rebirth', name: 'Rebirth', type: 'standard', stage: 'new', approximateIllumination: 0 },
  { id: 'horn', name: 'Horn', type: 'fictional', stage: 'waxing', approximateIllumination: 8 },
  { id: 'crescent', name: 'Crescent', type: 'standard', stage: 'waxing', approximateIllumination: 22 },
  { id: 'passage', name: 'Passage', type: 'fictional', stage: 'waxing', approximateIllumination: 38 },
  { id: 'growing', name: 'Growing', type: 'standard', stage: 'waxing', approximateIllumination: 50 },
  { id: 'waxing', name: 'Waxing', type: 'standard', stage: 'waxing', approximateIllumination: 75 },
  { id: 'ascent', name: 'Ascent', type: 'fictional', stage: 'waxing', approximateIllumination: 92 },
  { id: 'apex', name: 'Apex', type: 'standard', stage: 'full', approximateIllumination: 100 },
  { id: 'bite', name: 'Bite', type: 'fictional', stage: 'waning', approximateIllumination: 92 },
  { id: 'waning', name: 'Waning', type: 'standard', stage: 'waning', approximateIllumination: 75 },
  { id: 'receding', name: 'Receding', type: 'standard', stage: 'waning', approximateIllumination: 50 },
  { id: 'veil', name: 'Veil', type: 'standard', stage: 'waning', approximateIllumination: 22 },
  { id: 'death', name: 'Death', type: 'fictional', stage: 'waning', approximateIllumination: 8 }
];

export const TIDE_PERIODS = [
  { id: 'low', name: 'Low', durationHours: 17 },
  { id: 'high', name: 'High', durationHours: 13 },
  { id: 'parted', name: 'Parted', durationHours: 1 }
];

export const SEASONS = [
  { id: 'bones', name: 'Bones', durationDays: SEASON_LENGTH_DAYS },
  { id: 'tears', name: 'Tears', durationDays: SEASON_LENGTH_DAYS }
];

export const SEASONAL_CYCLE_LENGTH_DAYS = SEASONS.reduce(
  (totalDuration, season) => totalDuration + season.durationDays,
  0
);

export const CELESTIAL_BODIES = [
  { id: 'mercury', name: 'Mercury', symbol: '☿', orbitalPeriodDays: 89, tieBreakPriorityRank: 4 },
  { id: 'venus', name: 'Venus', symbol: '♀', orbitalPeriodDays: 223, tieBreakPriorityRank: 2 },
  { id: 'mars', name: 'Mars', symbol: '♂', orbitalPeriodDays: 683, tieBreakPriorityRank: 3 },
  { id: 'jupiter', name: 'Jupiter', symbol: '♃', orbitalPeriodDays: 4337, tieBreakPriorityRank: 5 },
  { id: 'saturn', name: 'Saturn', symbol: '♄', orbitalPeriodDays: 7919, tieBreakPriorityRank: 6 },
  { id: 'moon', name: 'Moon', symbol: '☾', orbitalPeriodLunarDays: 13, tieBreakPriorityRank: 1 }
];

export const ORBITAL_SPAN_TIE_EPSILON = 1e-12;

function assertValidUnixMilliseconds(realUnixMilliseconds) {
  if (typeof realUnixMilliseconds !== 'number') {
    throw new TypeError('realUnixMilliseconds must be a number');
  }
  if (!Number.isFinite(realUnixMilliseconds)) {
    throw new RangeError('realUnixMilliseconds must be finite');
  }
  if (realUnixMilliseconds < CALENDAR_EPOCH_UNIX_MS) {
    throw new RangeError('realUnixMilliseconds cannot be earlier than the calendar epoch');
  }
}

function padTwo(value) {
  return String(value).padStart(2, '0');
}

function assertValidTotalFictionalSeconds(totalFictionalSeconds) {
  if (typeof totalFictionalSeconds !== 'number') {
    throw new TypeError('totalFictionalSeconds must be a number');
  }
  if (!Number.isFinite(totalFictionalSeconds)) {
    throw new RangeError('totalFictionalSeconds must be finite');
  }
  if (!Number.isSafeInteger(totalFictionalSeconds)) {
    throw new RangeError('totalFictionalSeconds must be a safe integer');
  }
  if (totalFictionalSeconds < 0) {
    throw new RangeError('totalFictionalSeconds cannot be negative');
  }
}

function assertValidTotalElapsedDays(totalElapsedDays) {
  if (typeof totalElapsedDays !== 'number') {
    throw new TypeError('totalElapsedDays must be a number');
  }
  if (!Number.isFinite(totalElapsedDays)) {
    throw new RangeError('totalElapsedDays must be finite');
  }
  if (!Number.isSafeInteger(totalElapsedDays)) {
    throw new RangeError('totalElapsedDays must be a safe integer');
  }
  if (totalElapsedDays < 0) {
    throw new RangeError('totalElapsedDays cannot be negative');
  }
}

/**
 * Convert completed fictional calendar days to the independent season state.
 * Seasons deliberately do not align to the shorter calendar year.
 */
export function calculateSeasonState(totalElapsedDays) {
  assertValidTotalElapsedDays(totalElapsedDays);

  const totalCompletedSeasonalCycles = Math.floor(
    totalElapsedDays / SEASONAL_CYCLE_LENGTH_DAYS
  );
  const zeroBasedDayOfCycle = totalElapsedDays % SEASONAL_CYCLE_LENGTH_DAYS;
  let elapsedDaysInCycle = 0;

  for (const [seasonIndex, season] of SEASONS.entries()) {
    if (zeroBasedDayOfCycle < elapsedDaysInCycle + season.durationDays) {
      const nextSeason = SEASONS[(seasonIndex + 1) % SEASONS_PER_CYCLE];
      return {
        totalCompletedSeasonalCycles,
        cycle: totalCompletedSeasonalCycles + 1,
        dayOfCycle: zeroBasedDayOfCycle + 1,
        cycleLengthDays: SEASONAL_CYCLE_LENGTH_DAYS,
        id: season.id,
        name: season.name,
        day: zeroBasedDayOfCycle - elapsedDaysInCycle + 1,
        lengthDays: season.durationDays,
        next: { id: nextSeason.id, name: nextSeason.name }
      };
    }
    elapsedDaysInCycle += season.durationDays;
  }

  throw new Error('Season definitions do not cover the seasonal cycle');
}

function assertProgressFraction(progressFraction, name = 'progressFraction') {
  if (typeof progressFraction !== 'number') {
    throw new TypeError(`${name} must be a number`);
  }
  if (!Number.isFinite(progressFraction) || progressFraction < 0 || progressFraction >= 1) {
    throw new RangeError(`${name} must be finite and at least 0 but less than 1`);
  }
}

export function calculateCircularSpan(progressFractions) {
  if (!Array.isArray(progressFractions) || progressFractions.length !== 3) {
    throw new TypeError('progressFractions must contain exactly three values');
  }
  progressFractions.forEach((progressFraction, index) => {
    assertProgressFraction(progressFraction, `progressFractions[${index}]`);
  });

  const [a, b, c] = [...progressFractions].sort((first, second) => first - second);
  const gaps = [b - a, c - b, 1 - c + a];
  const spanFraction = 1 - Math.max(...gaps);
  return Math.min(1, Math.max(0, spanFraction));
}

function compareNumberVectors(firstVector, secondVector) {
  for (let index = 0; index < firstVector.length; index += 1) {
    if (firstVector[index] !== secondVector[index]) {
      return firstVector[index] - secondVector[index];
    }
  }
  return 0;
}

function getTieBreakPriorityVector(candidate) {
  return candidate.members
    .map((member) => member.tieBreakPriorityRank)
    .sort((first, second) => second - first);
}

function getCanonicalVector(candidate) {
  return candidate.members
    .map((member) => member.id)
    .sort();
}

function compareStringVectors(firstVector, secondVector) {
  for (let index = 0; index < firstVector.length; index += 1) {
    if (firstVector[index] < secondVector[index]) return -1;
    if (firstVector[index] > secondVector[index]) return 1;
  }
  return 0;
}

function validateOrbitalBodyStates(bodyStates) {
  if (!Array.isArray(bodyStates) || bodyStates.length !== CELESTIAL_BODIES.length) {
    throw new TypeError(`bodyStates must contain exactly ${CELESTIAL_BODIES.length} body states`);
  }
  bodyStates.forEach((bodyState, index) => {
    if (!bodyState || typeof bodyState !== 'object') {
      throw new TypeError(`bodyStates[${index}] must be an object`);
    }
    assertProgressFraction(bodyState.progressFraction, `bodyStates[${index}].progressFraction`);
    if (!Number.isInteger(bodyState.tieBreakPriorityRank)) {
      throw new TypeError(`bodyStates[${index}].tieBreakPriorityRank must be an integer`);
    }
  });
}

function createPullCandidates(bodyStates) {
  const candidates = [];
  for (let first = 0; first < bodyStates.length - 2; first += 1) {
    for (let second = first + 1; second < bodyStates.length - 1; second += 1) {
      for (let third = second + 1; third < bodyStates.length; third += 1) {
        const members = [bodyStates[first], bodyStates[second], bodyStates[third]];
        candidates.push({
          members,
          spanFraction: calculateCircularSpan(members.map((member) => member.progressFraction))
        });
      }
    }
  }
  return candidates;
}

function compareCandidatesByFixedPriority(firstCandidate, secondCandidate) {
  const priorityComparison = compareNumberVectors(
    getTieBreakPriorityVector(firstCandidate),
    getTieBreakPriorityVector(secondCandidate)
  );
  return priorityComparison || compareStringVectors(
    getCanonicalVector(firstCandidate),
    getCanonicalVector(secondCandidate)
  );
}

function rankCandidatesByAscendingSpanGroups(candidates) {
  const remainingCandidates = [...candidates];
  const rankedCandidates = [];

  while (remainingCandidates.length > 0) {
    const minimumSpan = Math.min(
      ...remainingCandidates.map((candidate) => candidate.spanFraction)
    );
    const tieGroup = remainingCandidates.filter(
      (candidate) => Math.abs(candidate.spanFraction - minimumSpan) <= ORBITAL_SPAN_TIE_EPSILON
    );
    tieGroup.sort(compareCandidatesByFixedPriority);
    for (const candidate of tieGroup) {
      rankedCandidates.push({ candidate, tiedCombinationCount: tieGroup.length });
    }

    const groupedCandidates = new Set(tieGroup);
    for (let index = remainingCandidates.length - 1; index >= 0; index -= 1) {
      if (groupedCandidates.has(remainingCandidates[index])) {
        remainingCandidates.splice(index, 1);
      }
    }
  }

  return rankedCandidates;
}

function createPullResult(candidate, selectionMethod, tiedCombinationCount, evaluatedCombinationCount) {
  const spanFraction = candidate.spanFraction;
  return {
    members: [...candidate.members]
      .sort((first, second) => first.tieBreakPriorityRank - second.tieBreakPriorityRank)
      .map(({ id, name, symbol }) => ({ id, name, symbol })),
    selectionMethod,
    evaluatedCombinationCount,
    spanFraction,
    spanPercentage: spanFraction * 100,
    formattedSpan: formatOrbitalPercentage(spanFraction),
    alignmentPercentage: (1 - spanFraction) * 100,
    formattedAlignment: formatOrbitalPercentage(1 - spanFraction),
    tieBreak: {
      applied: tiedCombinationCount > 1,
      method: 'fixed_priority',
      tiedCombinationCount
    }
  };
}

export function calculateOrbitalPulls(bodyStates) {
  validateOrbitalBodyStates(bodyStates);
  const candidates = createPullCandidates(bodyStates);
  const rankedCandidates = rankCandidatesByAscendingSpanGroups(candidates);
  const maximumSpan = Math.max(...candidates.map((candidate) => candidate.spanFraction));
  const largestSpanCandidates = candidates
    .filter((candidate) => Math.abs(candidate.spanFraction - maximumSpan) <= ORBITAL_SPAN_TIE_EPSILON)
    .sort(compareCandidatesByFixedPriority);

  const dominantEntry = rankedCandidates[0];
  const minorEntry = rankedCandidates[1];
  const negativeCandidate = largestSpanCandidates[0];
  const evaluatedCombinationCount = candidates.length;

  return {
    dominantPull: createPullResult(
      dominantEntry.candidate,
      'smallest_circular_arc',
      dominantEntry.tiedCombinationCount,
      evaluatedCombinationCount
    ),
    minorPull: createPullResult(
      minorEntry.candidate,
      'second_ranked_circular_arc',
      minorEntry.tiedCombinationCount,
      evaluatedCombinationCount
    ),
    negativePull: createPullResult(
      negativeCandidate,
      'largest_circular_arc',
      largestSpanCandidates.length,
      evaluatedCombinationCount
    )
  };
}

export function calculateOrbitalState(totalFictionalSeconds) {
  assertValidTotalFictionalSeconds(totalFictionalSeconds);

  const bodies = CELESTIAL_BODIES.map((body) => {
    const usesLunarDays = Number.isInteger(body.orbitalPeriodLunarDays);
    const orbitalUnitSeconds = usesLunarDays
      ? FICTIONAL_SECONDS_PER_LUNAR_DAY
      : FICTIONAL_SECONDS_PER_DAY;
    const orbitalPeriodUnits = usesLunarDays
      ? body.orbitalPeriodLunarDays
      : body.orbitalPeriodDays;
    const orbitalPeriodSeconds = usesLunarDays
      ? FICTIONAL_SECONDS_PER_LUNAR_CYCLE
      : orbitalPeriodUnits * orbitalUnitSeconds;
    const completedOrbits = Math.floor(totalFictionalSeconds / orbitalPeriodSeconds);
    const secondsIntoOrbit = totalFictionalSeconds % orbitalPeriodSeconds;
    const progressFraction = secondsIntoOrbit / orbitalPeriodSeconds;
    return {
      ...body,
      completedOrbits,
      orbit: completedOrbits + 1,
      dayOfOrbit: Math.floor(secondsIntoOrbit / orbitalUnitSeconds) + 1,
      progressFraction,
      progressPercentage: progressFraction * 100
    };
  });

  return { bodies, ...calculateOrbitalPulls(bodies) };
}

const OUTCOME_TIDE_RULES = Object.freeze({
  high: {
    pullKey: 'dominantPull',
    sourcePull: { id: 'dominant', name: 'Dominant Pull' },
    selectionRule: 'closest_to_completion',
    target: 'maximum'
  },
  low: {
    pullKey: 'minorPull',
    sourcePull: { id: 'minor', name: 'Minor Pull' },
    selectionRule: 'furthest_from_completion',
    target: 'minimum'
  },
  parted: {
    pullKey: 'negativePull',
    sourcePull: { id: 'negative', name: 'Negative Pull' },
    selectionRule: 'median_progress',
    target: 'median'
  }
});

export function calculateOutcomeState(tide, orbitalState) {
  if (!tide || typeof tide !== 'object' || typeof tide.id !== 'string') {
    throw new TypeError('tide must be an object with an id');
  }
  const rule = OUTCOME_TIDE_RULES[tide.id];
  if (!rule) {
    throw new RangeError(`Unsupported tide id for Outcome: ${tide.id}`);
  }
  if (!orbitalState || !Array.isArray(orbitalState.bodies)) {
    throw new TypeError('orbitalState must contain a bodies array');
  }

  const sourcePull = orbitalState[rule.pullKey];
  if (!sourcePull || !Array.isArray(sourcePull.members) || sourcePull.members.length !== 3) {
    throw new TypeError(`${rule.pullKey} must contain exactly three members`);
  }
  const bodiesById = new Map(orbitalState.bodies.map((body) => [body.id, body]));
  const members = sourcePull.members.map((member) => {
    const body = bodiesById.get(member.id);
    if (!body) {
      throw new Error(`Outcome source pull member is missing from orbital bodies: ${member.id}`);
    }
    assertProgressFraction(body.progressFraction, `body ${body.id} progressFraction`);
    if (!Number.isInteger(body.tieBreakPriorityRank)) {
      throw new TypeError(`body ${body.id} tieBreakPriorityRank must be an integer`);
    }
    return body;
  });

  let targetProgress;
  if (rule.target === 'maximum') {
    targetProgress = Math.max(...members.map((body) => body.progressFraction));
  } else if (rule.target === 'minimum') {
    targetProgress = Math.min(...members.map((body) => body.progressFraction));
  } else {
    targetProgress = [...members]
      .map((body) => body.progressFraction)
      .sort((first, second) => first - second)[1];
  }

  const tiedBodies = members
    .filter(
      (body) => Math.abs(body.progressFraction - targetProgress) <= ORBITAL_SPAN_TIE_EPSILON
    )
    .sort((first, second) => {
      const priorityDifference = first.tieBreakPriorityRank - second.tieBreakPriorityRank;
      if (priorityDifference !== 0) return priorityDifference;
      if (first.id < second.id) return -1;
      if (first.id > second.id) return 1;
      return 0;
    });
  const selectedBody = tiedBodies[0];

  return {
    tide: { id: tide.id, name: tide.name },
    sourcePull: { ...rule.sourcePull },
    selectionRule: rule.selectionRule,
    body: {
      id: selectedBody.id,
      name: selectedBody.name,
      symbol: selectedBody.symbol,
      orbit: selectedBody.orbit,
      dayOfOrbit: selectedBody.dayOfOrbit,
      progressFraction: selectedBody.progressFraction,
      progressPercentage: selectedBody.progressPercentage,
      formattedProgress: formatOrbitalPercentage(selectedBody.progressFraction)
    },
    tieBreak: {
      applied: tiedBodies.length > 1,
      method: 'fixed_priority',
      tiedBodyCount: tiedBodies.length
    }
  };
}

export function calculateOutcomeReward(hourProgressFraction) {
  assertProgressFraction(hourProgressFraction, 'hourProgressFraction');

  const hourProgressPercentage = hourProgressFraction * 100;
  let reward;
  if (hourProgressPercentage <= 85) {
    reward = { id: 'common', name: 'Common' };
  } else if (hourProgressPercentage <= 99) {
    reward = { id: 'uncommon', name: 'Uncommon' };
  } else {
    reward = { id: 'rare', name: 'Rare' };
  }

  const attemptsUntilRare = hourProgressPercentage > 99
    ? 0
    : Math.max(0, Math.floor(99 - hourProgressPercentage) + 1);

  return {
    ...reward,
    hourProgressFraction,
    hourProgressPercentage,
    attemptsUntilRare
  };
}

function createProgressValue(fraction) {
  return {
    fraction,
    percentage: fraction * 100,
    formatted: formatOrbitalPercentage(fraction)
  };
}

export function calculateProgressState(totalFictionalSeconds, seasonValue, lunarValue) {
  assertValidTotalFictionalSeconds(totalFictionalSeconds);
  if (!seasonValue || typeof seasonValue.day !== 'number' || typeof seasonValue.lengthDays !== 'number') {
    throw new TypeError('seasonValue must contain day and lengthDays');
  }
  if (!lunarValue || typeof lunarValue.day !== 'number') {
    throw new TypeError('lunarValue must contain day');
  }

  const secondsIntoCurrentHour = totalFictionalSeconds % FICTIONAL_SECONDS_PER_HOUR;
  const secondsIntoCurrentCalendarDay = totalFictionalSeconds % FICTIONAL_SECONDS_PER_DAY;
  const totalElapsedDays = Math.floor(totalFictionalSeconds / FICTIONAL_SECONDS_PER_DAY);
  const zeroBasedDayOfYear = totalElapsedDays % DAYS_PER_YEAR;
  const secondsIntoCurrentLunarDay = totalFictionalSeconds % FICTIONAL_SECONDS_PER_LUNAR_DAY;

  return {
    lunarCycle: createProgressValue(
      (((lunarValue.day - 1) * FICTIONAL_SECONDS_PER_LUNAR_DAY) + secondsIntoCurrentLunarDay)
      / FICTIONAL_SECONDS_PER_LUNAR_CYCLE
    ),
    lunarPhase: createProgressValue(
      secondsIntoCurrentLunarDay / FICTIONAL_SECONDS_PER_LUNAR_DAY
    ),
    season: createProgressValue(
      (((seasonValue.day - 1) * FICTIONAL_SECONDS_PER_DAY) + secondsIntoCurrentCalendarDay)
      / (seasonValue.lengthDays * FICTIONAL_SECONDS_PER_DAY)
    ),
    year: createProgressValue(
      ((zeroBasedDayOfYear * FICTIONAL_SECONDS_PER_DAY) + secondsIntoCurrentCalendarDay)
      / (DAYS_PER_YEAR * FICTIONAL_SECONDS_PER_DAY)
    ),
    day: createProgressValue(
      secondsIntoCurrentCalendarDay / FICTIONAL_SECONDS_PER_DAY
    ),
    hour: createProgressValue(
      secondsIntoCurrentHour / FICTIONAL_SECONDS_PER_HOUR
    )
  };
}

/**
 * Convert elapsed fictional seconds to the independent fictional lunar state.
 * It deliberately shares only seconds, minutes, and hours with the calendar.
 */
export function calculateLunarState(totalFictionalSeconds) {
  assertValidTotalFictionalSeconds(totalFictionalSeconds);

  const totalCompletedLunarDays = Math.floor(
    totalFictionalSeconds / FICTIONAL_SECONDS_PER_LUNAR_DAY
  );
  const zeroBasedLunarDay = totalCompletedLunarDays % LUNAR_DAYS_PER_CYCLE;
  const secondsIntoLunarDay = totalFictionalSeconds % FICTIONAL_SECONDS_PER_LUNAR_DAY;
  const hour = Math.floor(secondsIntoLunarDay / FICTIONAL_SECONDS_PER_HOUR);
  const secondsIntoLunarHour = secondsIntoLunarDay % FICTIONAL_SECONDS_PER_HOUR;
  const minute = Math.floor(secondsIntoLunarHour / FICTIONAL_SECONDS_PER_MINUTE);
  const second = secondsIntoLunarHour % FICTIONAL_SECONDS_PER_MINUTE;

  let elapsedTideHours = 0;
  let tide;
  for (const tidePeriod of TIDE_PERIODS) {
    if (hour < elapsedTideHours + tidePeriod.durationHours) {
      const hourInPeriod = hour - elapsedTideHours;
      tide = {
        ...tidePeriod,
        hour: hourInPeriod + 1,
        timeInPeriod: { hour: hourInPeriod, minute, second }
      };
      break;
    }
    elapsedTideHours += tidePeriod.durationHours;
  }

  return {
    totalCompletedLunarDays,
    cycle: Math.floor(totalCompletedLunarDays / LUNAR_DAYS_PER_CYCLE) + 1,
    day: zeroBasedLunarDay + 1,
    cycleLengthDays: LUNAR_DAYS_PER_CYCLE,
    phase: { ...MOON_PHASES[zeroBasedLunarDay] },
    time: { hour, minute, second },
    tide
  };
}

/**
 * Convert an explicit real Unix timestamp to the fictional calendar.
 * This module is intentionally independent of the DOM and Date.now().
 */
export function calculateFictionalCalendar(realUnixMilliseconds) {
  assertValidUnixMilliseconds(realUnixMilliseconds);

  const totalSeconds = Math.floor(
    (realUnixMilliseconds - CALENDAR_EPOCH_UNIX_MS) / REAL_MS_PER_FICTIONAL_SECOND
  );
  const lunar = calculateLunarState(totalSeconds);
  const orbits = calculateOrbitalState(totalSeconds);
  let remainingSeconds = totalSeconds;
  const second = remainingSeconds % FICTIONAL_SECONDS_PER_MINUTE;
  remainingSeconds = Math.floor(remainingSeconds / FICTIONAL_SECONDS_PER_MINUTE);
  const minute = remainingSeconds % FICTIONAL_MINUTES_PER_HOUR;
  remainingSeconds = Math.floor(remainingSeconds / FICTIONAL_MINUTES_PER_HOUR);
  const hour = remainingSeconds % FICTIONAL_HOURS_PER_DAY;
  const totalElapsedDays = Math.floor(remainingSeconds / FICTIONAL_HOURS_PER_DAY);

  const zeroBasedYear = Math.floor(totalElapsedDays / DAYS_PER_YEAR);
  const zeroBasedDayOfYear = totalElapsedDays % DAYS_PER_YEAR;
  let remainingDaysInYear = zeroBasedDayOfYear;
  let period;

  for (let monthIndex = 0; monthIndex < MONTHS_PER_YEAR; monthIndex += 1) {
    const month = monthIndex + 1;
    if (remainingDaysInYear < DAYS_PER_MONTH) {
      period = {
        type: 'month',
        month,
        day: remainingDaysInYear + 1,
        length: DAYS_PER_MONTH
      };
      break;
    }
    remainingDaysInYear -= DAYS_PER_MONTH;

    const interRegnumLength = INTER_REGNUM_LENGTHS[monthIndex];
    if (remainingDaysInYear < interRegnumLength) {
      period = {
        type: 'inter_regnum',
        fromMonth: month,
        toMonth: month === MONTHS_PER_YEAR ? 1 : month + 1,
        day: remainingDaysInYear + 1,
        length: interRegnumLength
      };
      break;
    }
    remainingDaysInYear -= interRegnumLength;
  }

  const season = calculateSeasonState(totalElapsedDays);
  const progress = calculateProgressState(totalSeconds, season, lunar);
  const outcome = {
    ...calculateOutcomeState(lunar.tide, orbits),
    reward: calculateOutcomeReward(progress.hour.fraction)
  };

  return {
    totalSeconds,
    totalElapsedDays,
    year: zeroBasedYear + 1,
    dayOfYear: zeroBasedDayOfYear + 1,
    weekOfYear: Math.floor(zeroBasedDayOfYear / FICTIONAL_DAYS_PER_WEEK) + 1,
    dayOfWeek: (totalElapsedDays % FICTIONAL_DAYS_PER_WEEK) + 1,
    period,
    time: { hour, minute, second },
    season,
    lunar,
    orbits,
    outcome,
    progress
  };
}

export function formatFictionalTime(calendarValue) {
  const { hour, minute, second } = calendarValue.time;
  return `${padTwo(hour)}:${padTwo(minute)}:${padTwo(second)}`;
}

export function formatLunarTime(lunarValue) {
  const { hour, minute, second } = lunarValue.time;
  return `${padTwo(hour)}:${padTwo(minute)}:${padTwo(second)}`;
}

export function formatTideTime(lunarValue) {
  const { hour, minute, second } = lunarValue.tide.timeInPeriod;
  return `${padTwo(hour)}:${padTwo(minute)}:${padTwo(second)}`;
}

export function formatOrbitalPercentage(progressFraction) {
  if (typeof progressFraction !== 'number') {
    throw new TypeError('progressFraction must be a number');
  }
  if (!Number.isFinite(progressFraction) || progressFraction < 0 || progressFraction > 1) {
    throw new RangeError('progressFraction must be finite and between 0 and 1');
  }

  const truncatedPercentage = Math.trunc(progressFraction * 100 * 1_000_000) / 1_000_000;
  const safePercentage = progressFraction < 1
    ? Math.min(truncatedPercentage, 99.999999)
    : 100;
  return `${safePercentage.toFixed(6)}%`;
}

export function formatFictionalDate(calendarValue) {
  const { year, period } = calendarValue;
  if (period.type === 'month') {
    return `Year ${year} · Month ${period.month} · Day ${period.day}`;
  }
  return `Year ${year} · Inter Regnum ${period.fromMonth} → ${period.toMonth} · Day ${period.day} of ${period.length}`;
}

function createPullJson(pull) {
  return {
    members: pull.members,
    selectionMethod: pull.selectionMethod,
    evaluatedCombinationCount: pull.evaluatedCombinationCount,
    spanFraction: pull.spanFraction,
    spanPercentage: pull.spanPercentage,
    formattedSpan: pull.formattedSpan,
    alignmentPercentage: pull.alignmentPercentage,
    formattedAlignment: pull.formattedAlignment,
    tieBreak: pull.tieBreak
  };
}

export function createCalendarJson(calendarValue, realUnixMilliseconds) {
  assertValidUnixMilliseconds(realUnixMilliseconds);
  const formattedTime = formatFictionalTime(calendarValue);
  const formattedLunarTime = formatLunarTime(calendarValue.lunar);
  const formattedTideTime = formatTideTime(calendarValue.lunar);
  return {
    calendarVersion: 'v8',
    source: {
      unixMilliseconds: realUnixMilliseconds,
      isoUtc: new Date(realUnixMilliseconds).toISOString()
    },
    fictional: {
      totalSeconds: calendarValue.totalSeconds,
      year: calendarValue.year,
      dayOfYear: calendarValue.dayOfYear,
      weekOfYear: calendarValue.weekOfYear,
      dayOfWeek: calendarValue.dayOfWeek,
      period: calendarValue.period,
      time: {
        hour: calendarValue.time.hour,
        minute: calendarValue.time.minute,
        second: calendarValue.time.second,
        formatted: formattedTime
      },
      season: {
        cycle: calendarValue.season.cycle,
        dayOfCycle: calendarValue.season.dayOfCycle,
        cycleLengthDays: calendarValue.season.cycleLengthDays,
        id: calendarValue.season.id,
        name: calendarValue.season.name,
        day: calendarValue.season.day,
        lengthDays: calendarValue.season.lengthDays,
        next: calendarValue.season.next
      },
      lunar: {
        cycle: calendarValue.lunar.cycle,
        day: calendarValue.lunar.day,
        cycleLengthDays: calendarValue.lunar.cycleLengthDays,
        phase: calendarValue.lunar.phase,
        time: {
          hour: calendarValue.lunar.time.hour,
          minute: calendarValue.lunar.time.minute,
          second: calendarValue.lunar.time.second,
          hoursPerLunarDay: FICTIONAL_HOURS_PER_LUNAR_DAY,
          formatted: formattedLunarTime
        },
        tide: {
          id: calendarValue.lunar.tide.id,
          name: calendarValue.lunar.tide.name,
          durationHours: calendarValue.lunar.tide.durationHours,
          hour: calendarValue.lunar.tide.hour,
          timeInPeriod: {
            hour: calendarValue.lunar.tide.timeInPeriod.hour,
            minute: calendarValue.lunar.tide.timeInPeriod.minute,
            second: calendarValue.lunar.tide.timeInPeriod.second,
            formatted: formattedTideTime
          }
        }
      },
      orbits: {
        bodies: calendarValue.orbits.bodies.map((body) => ({
          id: body.id,
          name: body.name,
          symbol: body.symbol,
          ...(Number.isInteger(body.orbitalPeriodLunarDays)
            ? { orbitalPeriodLunarDays: body.orbitalPeriodLunarDays }
            : { orbitalPeriodDays: body.orbitalPeriodDays }),
          tieBreakPriorityRank: body.tieBreakPriorityRank,
          orbit: body.orbit,
          dayOfOrbit: body.dayOfOrbit,
          progressFraction: body.progressFraction,
          progressPercentage: body.progressPercentage,
          formattedProgress: formatOrbitalPercentage(body.progressFraction)
        })),
        dominantPull: createPullJson(calendarValue.orbits.dominantPull),
        minorPull: createPullJson(calendarValue.orbits.minorPull),
        negativePull: createPullJson(calendarValue.orbits.negativePull)
      },
      progress: calendarValue.progress,
      formattedDate: formatFictionalDate(calendarValue)
    }
  };
}
