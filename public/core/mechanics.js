import {
  CALENDAR_EPOCH_UNIX_MS,
  ALTERNATING_SKIP_RULER_ID,
  CELESTIAL_BODY_RULES,
  DAYS_PER_MONTH,
  DAYS_PER_YEAR,
  FICTIONAL_DAYS_PER_WEEK,
  FICTIONAL_HOURS_PER_DAY,
  FICTIONAL_HOURS_PER_LUNAR_DAY,
  FICTIONAL_MINUTES_PER_HOUR,
  FICTIONAL_SECONDS_PER_DAY,
  FICTIONAL_SECONDS_PER_HOUR,
  FICTIONAL_SECONDS_PER_LUNAR_CYCLE,
  FICTIONAL_SECONDS_PER_LUNAR_DAY,
  FICTIONAL_SECONDS_PER_MINUTE,
  INTER_REGNUM_IDS,
  INTER_REGNUM_LENGTHS,
  LUNAR_DAYS_PER_CYCLE,
  LUNAR_PHASE_RULES,
  MONTH_IDS,
  MONTH_RULER_IDS,
  MONTHS_PER_YEAR,
  ORBITAL_SPAN_TIE_EPSILON,
  OUTCOME_TIDE_RULES,
  OUTCOME_TYPE_RULES,
  PULL_RULES,
  REAL_MS_PER_FICTIONAL_SECOND,
  REIGN_ORDINAL_IDS,
  SEASONAL_CYCLE_LENGTH_DAYS,
  SEASON_RULES,
  TIDE_RULES,
  WEEKDAY_IDS
} from './rules.js';

function assertFiniteNumber(value, label) {
  if (typeof value !== 'number') throw new TypeError(`${label} must be a number`);
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
}

function assertValidUnixMilliseconds(value) {
  assertFiniteNumber(value, 'realUnixMilliseconds');
  if (value < CALENDAR_EPOCH_UNIX_MS) {
    throw new RangeError('realUnixMilliseconds cannot be earlier than the calendar epoch');
  }
}

function assertNonNegativeSafeInteger(value, label) {
  assertFiniteNumber(value, label);
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer`);
  if (value < 0) throw new RangeError(`${label} cannot be negative`);
}

function assertProgressFraction(value, label = 'progressFraction') {
  if (typeof value !== 'number') throw new TypeError(`${label} must be a number`);
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError(`${label} must be finite and at least 0 but less than 1`);
  }
}

export function calculateRegularMonthRulership(absoluteMonthIndex) {
  assertNonNegativeSafeInteger(absoluteMonthIndex, 'absoluteMonthIndex');
  const supercycleIndex = absoluteMonthIndex % 15;
  const skippedRegularTurn = absoluteMonthIndex > 0 && supercycleIndex === 0;
  const regularRulerIndex = supercycleIndex < MONTH_RULER_IDS.length
    ? supercycleIndex
    : supercycleIndex - MONTH_RULER_IDS.length;
  const regularRulerId = MONTH_RULER_IDS[regularRulerIndex];
  return {
    opportunityRulerId: skippedRegularTurn ? ALTERNATING_SKIP_RULER_ID : regularRulerId,
    regularRulerId,
    skippedRegularTurn
  };
}

export function calculateMonthRulershipState(zeroBasedYear, zeroBasedMonthIndex) {
  assertNonNegativeSafeInteger(zeroBasedYear, 'zeroBasedYear');
  assertNonNegativeSafeInteger(zeroBasedMonthIndex, 'zeroBasedMonthIndex');
  if (zeroBasedMonthIndex >= MONTHS_PER_YEAR) {
    throw new RangeError(`zeroBasedMonthIndex must be between 0 and ${MONTHS_PER_YEAR - 1}`);
  }
  const firstAbsoluteMonthIndex = zeroBasedYear * MONTHS_PER_YEAR;
  const absoluteMonthIndex = firstAbsoluteMonthIndex + zeroBasedMonthIndex;
  if (!Number.isSafeInteger(absoluteMonthIndex)) {
    throw new RangeError('absoluteMonthIndex must be a safe integer');
  }
  const regular = calculateRegularMonthRulership(absoluteMonthIndex);
  const effectiveRulerId = regular.regularRulerId;
  let reignNumber = 0;
  for (let index = 0; index <= zeroBasedMonthIndex; index += 1) {
    if (calculateRegularMonthRulership(firstAbsoluteMonthIndex + index).regularRulerId === effectiveRulerId) {
      reignNumber += 1;
    }
  }
  return {
    ...regular,
    effectiveRulerId,
    source: 'base_rotation',
    reignNumber,
    ordinalId: REIGN_ORDINAL_IDS[reignNumber - 1]
  };
}

export function calculateSeasonState(totalElapsedDays) {
  assertNonNegativeSafeInteger(totalElapsedDays, 'totalElapsedDays');
  const completedCycles = Math.floor(totalElapsedDays / SEASONAL_CYCLE_LENGTH_DAYS);
  const zeroBasedDayOfCycle = totalElapsedDays % SEASONAL_CYCLE_LENGTH_DAYS;
  let elapsed = 0;
  for (const [index, rule] of SEASON_RULES.entries()) {
    if (zeroBasedDayOfCycle < elapsed + rule.durationDays) {
      return {
        id: rule.id,
        cycle: completedCycles + 1,
        dayOfCycle: zeroBasedDayOfCycle + 1,
        cycleLengthDays: SEASONAL_CYCLE_LENGTH_DAYS,
        day: zeroBasedDayOfCycle - elapsed + 1,
        lengthDays: rule.durationDays,
        nextId: SEASON_RULES[(index + 1) % SEASON_RULES.length].id
      };
    }
    elapsed += rule.durationDays;
  }
  throw new Error('Season rules do not cover the cycle');
}

export function calculateCircularSpan(progressFractions) {
  if (!Array.isArray(progressFractions) || progressFractions.length !== 3) {
    throw new TypeError('progressFractions must contain exactly three values');
  }
  progressFractions.forEach((value, index) => assertProgressFraction(value, `progressFractions[${index}]`));
  const [a, b, c] = [...progressFractions].sort((first, second) => first - second);
  return Math.min(1, Math.max(0, 1 - Math.max(b - a, c - b, 1 - c + a)));
}

function compareVectors(first, second) {
  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) return first[index] < second[index] ? -1 : 1;
  }
  return 0;
}

function compareCandidatesByPriority(first, second) {
  const firstRanks = first.members.map((member) => member.tieBreakPriorityRank).sort((a, b) => b - a);
  const secondRanks = second.members.map((member) => member.tieBreakPriorityRank).sort((a, b) => b - a);
  return compareVectors(firstRanks, secondRanks) || compareVectors(
    first.members.map((member) => member.id).sort(),
    second.members.map((member) => member.id).sort()
  );
}

function createPullCandidates(bodyStates) {
  const candidates = [];
  for (let first = 0; first < bodyStates.length - 2; first += 1) {
    for (let second = first + 1; second < bodyStates.length - 1; second += 1) {
      for (let third = second + 1; third < bodyStates.length; third += 1) {
        const members = [bodyStates[first], bodyStates[second], bodyStates[third]];
        candidates.push({ members, spanFraction: calculateCircularSpan(members.map((body) => body.progressFraction)) });
      }
    }
  }
  return candidates;
}

function rankCandidates(candidates) {
  const remaining = [...candidates];
  const ranked = [];
  while (remaining.length > 0) {
    const minimum = Math.min(...remaining.map((candidate) => candidate.spanFraction));
    const group = remaining
      .filter((candidate) => Math.abs(candidate.spanFraction - minimum) <= ORBITAL_SPAN_TIE_EPSILON)
      .sort(compareCandidatesByPriority);
    group.forEach((candidate) => ranked.push({ candidate, tiedCombinationCount: group.length }));
    const grouped = new Set(group);
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (grouped.has(remaining[index])) remaining.splice(index, 1);
    }
  }
  return ranked;
}

function createPullResult(id, candidate, tiedCombinationCount, evaluatedCombinationCount) {
  const spanFraction = candidate.spanFraction;
  return {
    id,
    memberIds: [...candidate.members]
      .sort((first, second) => first.tieBreakPriorityRank - second.tieBreakPriorityRank)
      .map((member) => member.id),
    selectionMethod: PULL_RULES.find((rule) => rule.id === id).selectionMethod,
    evaluatedCombinationCount,
    spanFraction,
    spanPercentage: spanFraction * 100,
    alignmentPercentage: (1 - spanFraction) * 100,
    tieBreak: {
      applied: tiedCombinationCount > 1,
      method: 'fixed_priority',
      tiedCombinationCount
    }
  };
}

export function calculateOrbitalPulls(bodyStates) {
  if (!Array.isArray(bodyStates) || bodyStates.length !== CELESTIAL_BODY_RULES.length) {
    throw new TypeError(`bodyStates must contain exactly ${CELESTIAL_BODY_RULES.length} body states`);
  }
  bodyStates.forEach((body, index) => {
    assertProgressFraction(body.progressFraction, `bodyStates[${index}].progressFraction`);
    if (!Number.isInteger(body.tieBreakPriorityRank)) {
      throw new TypeError(`bodyStates[${index}].tieBreakPriorityRank must be an integer`);
    }
  });
  const candidates = createPullCandidates(bodyStates);
  const ranked = rankCandidates(candidates);
  const maximum = Math.max(...candidates.map((candidate) => candidate.spanFraction));
  const largest = candidates
    .filter((candidate) => Math.abs(candidate.spanFraction - maximum) <= ORBITAL_SPAN_TIE_EPSILON)
    .sort(compareCandidatesByPriority);
  return {
    'pull-01': createPullResult('pull-01', ranked[0].candidate, ranked[0].tiedCombinationCount, candidates.length),
    'pull-02': createPullResult('pull-02', ranked[1].candidate, ranked[1].tiedCombinationCount, candidates.length),
    'pull-03': createPullResult('pull-03', largest[0], largest.length, candidates.length)
  };
}

export function calculateOrbitalState(totalFictionalSeconds) {
  assertNonNegativeSafeInteger(totalFictionalSeconds, 'totalFictionalSeconds');
  const bodies = CELESTIAL_BODY_RULES.map((rule) => {
    const unitSeconds = rule.orbitalPeriod.unit === 'lunar_day'
      ? FICTIONAL_SECONDS_PER_LUNAR_DAY
      : FICTIONAL_SECONDS_PER_DAY;
    const periodSeconds = rule.orbitalPeriod.value * unitSeconds;
    const completedOrbits = Math.floor(totalFictionalSeconds / periodSeconds);
    const secondsIntoOrbit = totalFictionalSeconds % periodSeconds;
    const progressFraction = secondsIntoOrbit / periodSeconds;
    return {
      id: rule.id,
      kind: rule.kind,
      orbitalPeriod: { ...rule.orbitalPeriod },
      tieBreakPriorityRank: rule.tieBreakPriorityRank,
      completedOrbits,
      orbit: completedOrbits + 1,
      dayOfOrbit: Math.floor(secondsIntoOrbit / unitSeconds) + 1,
      progressFraction,
      progressPercentage: progressFraction * 100
    };
  });
  return { bodies, pulls: calculateOrbitalPulls(bodies) };
}

export function calculateOutcomeType(hourProgressFraction) {
  assertProgressFraction(hourProgressFraction, 'hourProgressFraction');
  const hourProgressPercentage = hourProgressFraction * 100;
  const rule = OUTCOME_TYPE_RULES.find(
    (candidate) => candidate.maximumPercentage === null || hourProgressPercentage <= candidate.maximumPercentage
  );
  return {
    id: rule.id,
    hourProgressFraction,
    hourProgressPercentage,
    attemptsUntilRare: hourProgressPercentage > 99
      ? 0
      : Math.max(0, Math.floor(99 - hourProgressPercentage) + 1)
  };
}

export function calculateOutcomeState(tide, orbitalState, hourProgressFraction) {
  const rule = OUTCOME_TIDE_RULES[tide?.id];
  if (!rule) throw new RangeError(`Unsupported tide id: ${tide?.id}`);
  const pull = orbitalState?.pulls?.[rule.pullId];
  if (!pull || !Array.isArray(pull.memberIds) || pull.memberIds.length !== 3) {
    throw new TypeError(`${rule.pullId} must contain exactly three member IDs`);
  }
  const bodiesById = new Map(orbitalState.bodies.map((body) => [body.id, body]));
  const members = pull.memberIds.map((id) => {
    const body = bodiesById.get(id);
    if (!body) throw new Error(`Outcome pull member is missing from orbital bodies: ${id}`);
    return body;
  });
  let targetProgress;
  if (rule.target === 'maximum') targetProgress = Math.max(...members.map((body) => body.progressFraction));
  else if (rule.target === 'minimum') targetProgress = Math.min(...members.map((body) => body.progressFraction));
  else targetProgress = members.map((body) => body.progressFraction).sort((a, b) => a - b)[1];
  const tiedBodies = members
    .filter((body) => Math.abs(body.progressFraction - targetProgress) <= ORBITAL_SPAN_TIE_EPSILON)
    .sort((first, second) => first.tieBreakPriorityRank - second.tieBreakPriorityRank || first.id.localeCompare(second.id));
  const selected = tiedBodies[0];
  const outcomeType = calculateOutcomeType(hourProgressFraction);
  return {
    tideId: tide.id,
    sourcePullId: rule.pullId,
    selectionRuleId: rule.selectionRuleId,
    bodyId: selected.id,
    bodyState: { ...selected, orbitalPeriod: { ...selected.orbitalPeriod } },
    outcomeTypeId: outcomeType.id,
    attemptsUntilRare: outcomeType.attemptsUntilRare,
    tieBreak: { applied: tiedBodies.length > 1, method: 'fixed_priority', tiedBodyCount: tiedBodies.length }
  };
}

function progressValue(fraction) {
  return { fraction, percentage: fraction * 100 };
}

export function calculateProgressState(totalFictionalSeconds, season, lunar) {
  assertNonNegativeSafeInteger(totalFictionalSeconds, 'totalFictionalSeconds');
  const secondsIntoHour = totalFictionalSeconds % FICTIONAL_SECONDS_PER_HOUR;
  const secondsIntoDay = totalFictionalSeconds % FICTIONAL_SECONDS_PER_DAY;
  const totalElapsedDays = Math.floor(totalFictionalSeconds / FICTIONAL_SECONDS_PER_DAY);
  const zeroBasedDayOfYear = totalElapsedDays % DAYS_PER_YEAR;
  const secondsIntoLunarDay = totalFictionalSeconds % FICTIONAL_SECONDS_PER_LUNAR_DAY;
  return {
    lunarCycle: progressValue((((lunar.day - 1) * FICTIONAL_SECONDS_PER_LUNAR_DAY) + secondsIntoLunarDay) / FICTIONAL_SECONDS_PER_LUNAR_CYCLE),
    lunarPhase: progressValue(secondsIntoLunarDay / FICTIONAL_SECONDS_PER_LUNAR_DAY),
    season: progressValue((((season.day - 1) * FICTIONAL_SECONDS_PER_DAY) + secondsIntoDay) / (season.lengthDays * FICTIONAL_SECONDS_PER_DAY)),
    year: progressValue(((zeroBasedDayOfYear * FICTIONAL_SECONDS_PER_DAY) + secondsIntoDay) / (DAYS_PER_YEAR * FICTIONAL_SECONDS_PER_DAY)),
    day: progressValue(secondsIntoDay / FICTIONAL_SECONDS_PER_DAY),
    hour: progressValue(secondsIntoHour / FICTIONAL_SECONDS_PER_HOUR)
  };
}

export function calculateLunarState(totalFictionalSeconds) {
  assertNonNegativeSafeInteger(totalFictionalSeconds, 'totalFictionalSeconds');
  const completedLunarDays = Math.floor(totalFictionalSeconds / FICTIONAL_SECONDS_PER_LUNAR_DAY);
  const zeroBasedLunarDay = completedLunarDays % LUNAR_DAYS_PER_CYCLE;
  const secondsIntoLunarDay = totalFictionalSeconds % FICTIONAL_SECONDS_PER_LUNAR_DAY;
  const hour = Math.floor(secondsIntoLunarDay / FICTIONAL_SECONDS_PER_HOUR);
  const secondsIntoHour = secondsIntoLunarDay % FICTIONAL_SECONDS_PER_HOUR;
  const minute = Math.floor(secondsIntoHour / FICTIONAL_SECONDS_PER_MINUTE);
  const second = secondsIntoHour % FICTIONAL_SECONDS_PER_MINUTE;
  let elapsedHours = 0;
  let tide;
  for (const rule of TIDE_RULES) {
    if (hour < elapsedHours + rule.durationHours) {
      const hourInPeriod = hour - elapsedHours;
      tide = {
        id: rule.id,
        durationHours: rule.durationHours,
        hour: hourInPeriod + 1,
        timeInPeriod: { hour: hourInPeriod, minute, second }
      };
      break;
    }
    elapsedHours += rule.durationHours;
  }
  return {
    cycle: Math.floor(completedLunarDays / LUNAR_DAYS_PER_CYCLE) + 1,
    day: zeroBasedLunarDay + 1,
    cycleLengthDays: LUNAR_DAYS_PER_CYCLE,
    phaseId: LUNAR_PHASE_RULES[zeroBasedLunarDay].id,
    time: { hour, minute, second, hoursPerLunarDay: FICTIONAL_HOURS_PER_LUNAR_DAY },
    tide
  };
}

export function calculateCalendarState(realUnixMilliseconds) {
  assertValidUnixMilliseconds(realUnixMilliseconds);
  const totalSeconds = Math.floor((realUnixMilliseconds - CALENDAR_EPOCH_UNIX_MS) / REAL_MS_PER_FICTIONAL_SECOND);
  let remainingSeconds = totalSeconds;
  const second = remainingSeconds % FICTIONAL_SECONDS_PER_MINUTE;
  remainingSeconds = Math.floor(remainingSeconds / FICTIONAL_SECONDS_PER_MINUTE);
  const minute = remainingSeconds % FICTIONAL_MINUTES_PER_HOUR;
  remainingSeconds = Math.floor(remainingSeconds / FICTIONAL_MINUTES_PER_HOUR);
  const hour = remainingSeconds % FICTIONAL_HOURS_PER_DAY;
  const totalElapsedDays = Math.floor(remainingSeconds / FICTIONAL_HOURS_PER_DAY);
  const zeroBasedYear = Math.floor(totalElapsedDays / DAYS_PER_YEAR);
  const zeroBasedDayOfYear = totalElapsedDays % DAYS_PER_YEAR;
  const dayOfWeek = (totalElapsedDays % FICTIONAL_DAYS_PER_WEEK) + 1;
  let remainingDays = zeroBasedDayOfYear;
  let period;
  for (let index = 0; index < MONTHS_PER_YEAR; index += 1) {
    if (remainingDays < DAYS_PER_MONTH) {
      period = {
        type: 'month',
        monthId: MONTH_IDS[index],
        monthIndex: index + 1,
        day: remainingDays + 1,
        length: DAYS_PER_MONTH,
        rulership: calculateMonthRulershipState(zeroBasedYear, index)
      };
      break;
    }
    remainingDays -= DAYS_PER_MONTH;
    const interLength = INTER_REGNUM_LENGTHS[index];
    if (remainingDays < interLength) {
      period = {
        type: 'inter_regnum',
        interRegnumId: INTER_REGNUM_IDS[index],
        fromMonthId: MONTH_IDS[index],
        toMonthId: MONTH_IDS[(index + 1) % MONTHS_PER_YEAR],
        day: remainingDays + 1,
        length: interLength
      };
      break;
    }
    remainingDays -= interLength;
  }
  const season = calculateSeasonState(totalElapsedDays);
  const lunar = calculateLunarState(totalSeconds);
  const orbits = calculateOrbitalState(totalSeconds);
  const progress = calculateProgressState(totalSeconds, season, lunar);
  const outcome = calculateOutcomeState(lunar.tide, orbits, progress.hour.fraction);
  return {
    totalSeconds,
    totalElapsedDays,
    calendar: {
      year: zeroBasedYear + 1,
      dayOfYear: zeroBasedDayOfYear + 1,
      weekOfYear: Math.floor(zeroBasedDayOfYear / FICTIONAL_DAYS_PER_WEEK) + 1,
      dayOfWeek,
      weekdayId: WEEKDAY_IDS[dayOfWeek - 1],
      period,
      time: { hour, minute, second }
    },
    season,
    lunar,
    orbits,
    outcome,
    progress
  };
}
