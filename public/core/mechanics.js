import {
  CALENDAR_EPOCH_UNIX_MS,
  ALTERNATING_SKIP_ORBITAL_THRESHOLD,
  ALTERNATING_SKIP_REPLACEMENT_RULES,
  ALTERNATING_SKIP_RULER_ID,
  CALENDAR_NAMED_DAY_RULES,
  CELESTIAL_BODY_RULES,
  DAYS_PER_MONTH,
  DAYS_PER_YEAR,
  FICTIONAL_DAYS_PER_WEEK,
  FICTIONAL_HOURS_PER_DAY,
  FICTIONAL_MINUTES_PER_HOUR,
  FICTIONAL_SECONDS_PER_DAY,
  FICTIONAL_SECONDS_PER_HOUR,
  FICTIONAL_SECONDS_PER_MINUTE,
  INTER_REGNUM_IDS,
  INTER_REGNUM_LENGTHS,
  LUNAR_DAYS_PER_CYCLE,
  LUNAR_HOURS_PER_DAY,
  LUNAR_MINUTES_PER_HOUR,
  LUNAR_PHASE_RULES,
  LUNAR_SECONDS_PER_CYCLE,
  LUNAR_SECONDS_PER_DAY,
  LUNAR_SECONDS_PER_HOUR,
  LUNAR_SECONDS_PER_MINUTE,
  MONTH_IDS,
  MONTH_RULER_DECISION_HOUR,
  MONTHS_PER_YEAR,
  ORBITAL_SPAN_TIE_EPSILON,
  OUTCOME_TIDE_RULES,
  OUTCOME_TYPE_RULES,
  PULL_RULES,
  REAL_MS_PER_FICTIONAL_SECOND,
  REAL_MS_PER_LUNAR_SECOND,
  REIGN_ORDINAL_IDS,
  SEASONAL_CYCLE_LENGTH_DAYS,
  SEASON_MONTH_RULER_ROTATIONS,
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

export function resolveNamedDayId(periodType, day) {
  if (typeof periodType !== 'string') {
    throw new TypeError('periodType must be a string');
  }
  const rules = CALENDAR_NAMED_DAY_RULES[periodType];
  if (!rules) throw new RangeError(`Unsupported period type: ${periodType}`);
  assertNonNegativeSafeInteger(day, 'day');
  if (day < 1) throw new RangeError('day must be at least 1');
  return rules.find((rule) => rule.day === day)?.namedDayId ?? null;
}

export function calculateAbsoluteMonthStartDay(absoluteMonthIndex) {
  assertNonNegativeSafeInteger(absoluteMonthIndex, 'absoluteMonthIndex');
  const zeroBasedYear = Math.floor(absoluteMonthIndex / MONTHS_PER_YEAR);
  const zeroBasedMonthIndex = absoluteMonthIndex % MONTHS_PER_YEAR;
  let startDay = zeroBasedYear * DAYS_PER_YEAR;
  if (!Number.isSafeInteger(startDay)) throw new RangeError('absoluteMonthIndex produces an unsafe start day');
  for (let index = 0; index < zeroBasedMonthIndex; index += 1) {
    startDay += DAYS_PER_MONTH + INTER_REGNUM_LENGTHS[index];
  }
  if (!Number.isSafeInteger(startDay)) throw new RangeError('absoluteMonthIndex produces an unsafe start day');
  return startDay;
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

export function calculateCelestialBodyStates(totalCalendarSeconds, totalLunarSeconds) {
  assertNonNegativeSafeInteger(totalCalendarSeconds, 'totalCalendarSeconds');
  assertNonNegativeSafeInteger(totalLunarSeconds, 'totalLunarSeconds');
  return CELESTIAL_BODY_RULES.map((rule) => {
    const usesLunarTime = rule.orbitalPeriod.unit === 'lunar_day';
    const elapsedSeconds = usesLunarTime ? totalLunarSeconds : totalCalendarSeconds;
    const unitSeconds = usesLunarTime
      ? LUNAR_SECONDS_PER_DAY
      : FICTIONAL_SECONDS_PER_DAY;
    const periodSeconds = rule.orbitalPeriod.value * unitSeconds;
    const completedOrbits = Math.floor(elapsedSeconds / periodSeconds);
    const secondsIntoOrbit = elapsedSeconds % periodSeconds;
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
}

export function calculateOrbitalState(totalCalendarSeconds, totalLunarSeconds) {
  const bodies = calculateCelestialBodyStates(totalCalendarSeconds, totalLunarSeconds);
  return { bodies, pulls: calculateOrbitalPulls(bodies) };
}

function replacementBodyStatesById(bodyStates) {
  if (!Array.isArray(bodyStates) || bodyStates.length !== CELESTIAL_BODY_RULES.length) {
    throw new TypeError(`bodyStates must contain exactly ${CELESTIAL_BODY_RULES.length} body states`);
  }
  const bodyStatesById = new Map();
  bodyStates.forEach((body, index) => {
    if (!body || typeof body.id !== 'string') {
      throw new TypeError(`bodyStates[${index}].id must be a string`);
    }
    if (bodyStatesById.has(body.id)) throw new RangeError(`Duplicate body state id: ${body.id}`);
    assertProgressFraction(body.progressFraction, `bodyStates[${index}].progressFraction`);
    bodyStatesById.set(body.id, body);
  });
  for (const rule of ALTERNATING_SKIP_REPLACEMENT_RULES) {
    if (!bodyStatesById.has(rule.bodyId)) throw new RangeError(`Missing body state id: ${rule.bodyId}`);
  }
  return bodyStatesById;
}

function qualifyingReplacementRules(bodyStates) {
  const bodyStatesById = replacementBodyStatesById(bodyStates);
  return ALTERNATING_SKIP_REPLACEMENT_RULES.filter(
    (rule) => bodyStatesById.get(rule.bodyId).progressFraction >= ALTERNATING_SKIP_ORBITAL_THRESHOLD
  );
}

export function selectNextSeasonOneFallbackRuler(lastEffectiveSeasonOneRulerId) {
  const rotation = SEASON_MONTH_RULER_ROTATIONS['season-01'];
  const previousIndex = rotation.indexOf(lastEffectiveSeasonOneRulerId);
  if (previousIndex === -1) {
    throw new RangeError('lastEffectiveSeasonOneRulerId must belong to the season-01 rotation');
  }
  let nextIndex = (previousIndex + 1) % rotation.length;
  if (rotation[nextIndex] === ALTERNATING_SKIP_RULER_ID) {
    nextIndex = (nextIndex + 1) % rotation.length;
  }
  return rotation[nextIndex];
}

export function selectAlternatingSkipReplacement(bodyStates, lastEffectiveSeasonOneRulerId) {
  const qualifyingRules = qualifyingReplacementRules(bodyStates);
  const qualifyingBodyIds = qualifyingRules.map(({ bodyId }) => bodyId);
  if (qualifyingRules.length === 1) {
    return {
      rulerId: qualifyingRules[0].rulerId,
      method: 'single_qualifying_body',
      selectedBodyId: qualifyingRules[0].bodyId,
      qualifyingBodyIds,
      fallbackReason: null
    };
  }
  return {
    rulerId: selectNextSeasonOneFallbackRuler(lastEffectiveSeasonOneRulerId),
    method: 'season_rotation_fallback',
    selectedBodyId: null,
    qualifyingBodyIds,
    fallbackReason: qualifyingRules.length === 0
      ? 'no_qualifying_body'
      : 'multiple_qualifying_bodies'
  };
}

export function calculateMonthRulerDecisionSnapshot(absoluteMonthIndex) {
  assertNonNegativeSafeInteger(absoluteMonthIndex, 'absoluteMonthIndex');
  if (absoluteMonthIndex === 0) {
    throw new RangeError('absoluteMonthIndex must be greater than zero for a decision snapshot');
  }
  const calendarDayIndex = calculateAbsoluteMonthStartDay(absoluteMonthIndex) - 1;
  const totalCalendarSeconds = (
    calendarDayIndex * FICTIONAL_SECONDS_PER_DAY
  ) + (
    MONTH_RULER_DECISION_HOUR * FICTIONAL_SECONDS_PER_HOUR
  );
  if (!Number.isSafeInteger(totalCalendarSeconds)) {
    throw new RangeError('absoluteMonthIndex produces unsafe calendar seconds');
  }
  const realUnixMilliseconds = CALENDAR_EPOCH_UNIX_MS
    + (totalCalendarSeconds * REAL_MS_PER_FICTIONAL_SECOND);
  if (!Number.isSafeInteger(realUnixMilliseconds)) {
    throw new RangeError('absoluteMonthIndex produces an unsafe decision timestamp');
  }
  const totalLunarSeconds = Math.floor(
    (realUnixMilliseconds - CALENDAR_EPOCH_UNIX_MS) / REAL_MS_PER_LUNAR_SECOND
  );
  const seasonId = calculateSeasonState(calendarDayIndex).id;
  const bodies = calculateCelestialBodyStates(totalCalendarSeconds, totalLunarSeconds);
  const qualifyingBodyIds = qualifyingReplacementRules(bodies).map(({ bodyId }) => bodyId);
  return {
    type: 'interregno_final_hour',
    realUnixMilliseconds,
    calendarDayIndex,
    calendarHour: MONTH_RULER_DECISION_HOUR,
    totalCalendarSeconds,
    totalLunarSeconds,
    seasonId,
    bodyProgress: bodies.map(({ id, progressFraction }) => ({ bodyId: id, progressFraction })),
    qualifyingBodyIds
  };
}

function createInitialMonthRulerMachineState() {
  return {
    nextRotationIndexBySeason: { 'season-01': 1, 'season-02': 0 },
    alternatingSkipOpportunityCount: 1,
    lastEffectiveSeasonOneRulerId: ALTERNATING_SKIP_RULER_ID
  };
}

function copyAndValidateMachineState(machineState) {
  if (!machineState || typeof machineState !== 'object' || Array.isArray(machineState)) {
    throw new TypeError('machineState must be an object');
  }
  const nextRotationIndexBySeason = {};
  for (const [seasonId, rotation] of Object.entries(SEASON_MONTH_RULER_ROTATIONS)) {
    const index = machineState.nextRotationIndexBySeason?.[seasonId];
    if (!Number.isInteger(index) || index < 0 || index >= rotation.length) {
      throw new RangeError(`machineState cursor for ${seasonId} is invalid`);
    }
    nextRotationIndexBySeason[seasonId] = index;
  }
  assertNonNegativeSafeInteger(
    machineState.alternatingSkipOpportunityCount,
    'machineState.alternatingSkipOpportunityCount'
  );
  if (!SEASON_MONTH_RULER_ROTATIONS['season-01'].includes(machineState.lastEffectiveSeasonOneRulerId)) {
    throw new RangeError('machineState.lastEffectiveSeasonOneRulerId must belong to the season-01 rotation');
  }
  return {
    nextRotationIndexBySeason,
    alternatingSkipOpportunityCount: machineState.alternatingSkipOpportunityCount,
    lastEffectiveSeasonOneRulerId: machineState.lastEffectiveSeasonOneRulerId
  };
}

function copyDecisionSnapshot(decisionSnapshot) {
  if (!decisionSnapshot || typeof decisionSnapshot !== 'object' || Array.isArray(decisionSnapshot)) {
    throw new TypeError('decisionSnapshot must be an object');
  }
  if (!Array.isArray(decisionSnapshot.bodyProgress)) {
    throw new TypeError('decisionSnapshot.bodyProgress must be an array');
  }
  if (!Array.isArray(decisionSnapshot.qualifyingBodyIds)) {
    throw new TypeError('decisionSnapshot.qualifyingBodyIds must be an array');
  }
  return {
    type: decisionSnapshot.type,
    realUnixMilliseconds: decisionSnapshot.realUnixMilliseconds,
    calendarDayIndex: decisionSnapshot.calendarDayIndex,
    calendarHour: decisionSnapshot.calendarHour,
    totalCalendarSeconds: decisionSnapshot.totalCalendarSeconds,
    totalLunarSeconds: decisionSnapshot.totalLunarSeconds,
    bodyProgress: decisionSnapshot.bodyProgress.map(({ bodyId, progressFraction }) => ({ bodyId, progressFraction })),
    qualifyingBodyIds: [...decisionSnapshot.qualifyingBodyIds]
  };
}

export function resolveNextMonthRulership(machineState, decisionSnapshot) {
  const nextMachineState = copyAndValidateMachineState(machineState);
  const rotationSeasonId = decisionSnapshot?.seasonId;
  const rotation = SEASON_MONTH_RULER_ROTATIONS[rotationSeasonId];
  if (!rotation) throw new RangeError(`Unsupported decision season id: ${rotationSeasonId}`);
  const rotationIndex = nextMachineState.nextRotationIndexBySeason[rotationSeasonId];
  const opportunityRulerId = rotation[rotationIndex];
  nextMachineState.nextRotationIndexBySeason[rotationSeasonId] = (rotationIndex + 1) % rotation.length;

  let regularRulerId = opportunityRulerId;
  let source = 'season_rotation';
  let skippedRegularTurn = false;
  let alternatingSkipOpportunityNumber = null;
  let replacement = {
    applied: false,
    method: null,
    selectedBodyId: null,
    fallbackReason: null
  };

  if (opportunityRulerId === ALTERNATING_SKIP_RULER_ID) {
    nextMachineState.alternatingSkipOpportunityCount += 1;
    alternatingSkipOpportunityNumber = nextMachineState.alternatingSkipOpportunityCount;
    skippedRegularTurn = alternatingSkipOpportunityNumber % 2 === 0;
    if (skippedRegularTurn) {
      const replacementResult = selectAlternatingSkipReplacement(
        decisionSnapshot.bodyProgress.map(({ bodyId, progressFraction }) => ({ id: bodyId, progressFraction })),
        nextMachineState.lastEffectiveSeasonOneRulerId
      );
      regularRulerId = replacementResult.rulerId;
      source = replacementResult.method === 'single_qualifying_body'
        ? 'alternating_skip_single_body'
        : 'alternating_skip_fallback';
      replacement = {
        applied: true,
        method: replacementResult.method,
        selectedBodyId: replacementResult.selectedBodyId,
        fallbackReason: replacementResult.fallbackReason
      };
    }
  }

  const effectiveRulerId = regularRulerId;
  if (SEASON_MONTH_RULER_ROTATIONS['season-01'].includes(effectiveRulerId)) {
    nextMachineState.lastEffectiveSeasonOneRulerId = effectiveRulerId;
  }
  return {
    rulership: {
      opportunityRulerId,
      regularRulerId,
      effectiveRulerId,
      rotationSeasonId,
      source,
      skippedRegularTurn,
      alternatingSkipOpportunityNumber,
      decision: copyDecisionSnapshot(decisionSnapshot),
      replacement
    },
    nextMachineState
  };
}

function createEpochMonthRulership() {
  return {
    opportunityRulerId: ALTERNATING_SKIP_RULER_ID,
    regularRulerId: ALTERNATING_SKIP_RULER_ID,
    effectiveRulerId: ALTERNATING_SKIP_RULER_ID,
    rotationSeasonId: 'season-01',
    source: 'epoch_default',
    skippedRegularTurn: false,
    alternatingSkipOpportunityNumber: 1,
    reignNumber: 1,
    ordinalId: REIGN_ORDINAL_IDS[0],
    decision: {
      type: 'epoch_default',
      realUnixMilliseconds: CALENDAR_EPOCH_UNIX_MS,
      calendarDayIndex: 0,
      calendarHour: 0,
      totalCalendarSeconds: 0,
      totalLunarSeconds: 0,
      bodyProgress: [],
      qualifyingBodyIds: []
    },
    replacement: {
      applied: false,
      method: null,
      selectedBodyId: null,
      fallbackReason: null
    }
  };
}

export function calculateMonthRulershipState(zeroBasedYear, zeroBasedMonthIndex) {
  assertNonNegativeSafeInteger(zeroBasedYear, 'zeroBasedYear');
  assertNonNegativeSafeInteger(zeroBasedMonthIndex, 'zeroBasedMonthIndex');
  if (zeroBasedMonthIndex >= MONTHS_PER_YEAR) {
    throw new RangeError(`zeroBasedMonthIndex must be between 0 and ${MONTHS_PER_YEAR - 1}`);
  }
  const absoluteMonthIndex = (zeroBasedYear * MONTHS_PER_YEAR) + zeroBasedMonthIndex;
  if (!Number.isSafeInteger(absoluteMonthIndex)) {
    throw new RangeError('absoluteMonthIndex must be a safe integer');
  }

  let machineState = createInitialMonthRulerMachineState();
  let effectiveRulerCounts = new Map();
  let targetRulership;
  for (let index = 0; index <= absoluteMonthIndex; index += 1) {
    if (index % MONTHS_PER_YEAR === 0) effectiveRulerCounts = new Map();
    let rulership;
    if (index === 0) {
      rulership = createEpochMonthRulership();
    } else {
      const resolved = resolveNextMonthRulership(
        machineState,
        calculateMonthRulerDecisionSnapshot(index)
      );
      machineState = resolved.nextMachineState;
      rulership = resolved.rulership;
    }
    const reignNumber = (effectiveRulerCounts.get(rulership.effectiveRulerId) ?? 0) + 1;
    effectiveRulerCounts.set(rulership.effectiveRulerId, reignNumber);
    targetRulership = {
      ...rulership,
      reignNumber,
      ordinalId: REIGN_ORDINAL_IDS[reignNumber - 1]
    };
  }
  return targetRulership;
}

export function calculateOutcomeType(tideProgressFraction) {
  assertProgressFraction(tideProgressFraction, 'tideProgressFraction');
  const tideProgressPercentage = tideProgressFraction * 100;
  const rule = OUTCOME_TYPE_RULES.find(
    (candidate) => candidate.maximumPercentage === null || tideProgressPercentage <= candidate.maximumPercentage
  );
  return {
    id: rule.id,
    tideProgressFraction,
    tideProgressPercentage,
    attemptsUntilRare: tideProgressPercentage > 99
      ? 0
      : Math.max(0, Math.floor(99 - tideProgressPercentage) + 1)
  };
}

export function calculateOutcomeState(tide, orbitalState, tideProgressFraction) {
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
  const outcomeType = calculateOutcomeType(tideProgressFraction);
  return {
    tideId: tide.id,
    sourcePullId: rule.pullId,
    selectionRuleId: rule.selectionRuleId,
    bodyId: selected.id,
    bodyState: { ...selected, orbitalPeriod: { ...selected.orbitalPeriod } },
    outcomeTypeId: outcomeType.id,
    tideProgressFraction: outcomeType.tideProgressFraction,
    tideProgressPercentage: outcomeType.tideProgressPercentage,
    attemptsUntilRare: outcomeType.attemptsUntilRare,
    tieBreak: { applied: tiedBodies.length > 1, method: 'fixed_priority', tiedBodyCount: tiedBodies.length }
  };
}

function progressValue(fraction) {
  return { fraction, percentage: fraction * 100 };
}

export function calculateProgressState(totalCalendarSeconds, totalLunarSeconds, season, lunar) {
  assertNonNegativeSafeInteger(totalCalendarSeconds, 'totalCalendarSeconds');
  assertNonNegativeSafeInteger(totalLunarSeconds, 'totalLunarSeconds');
  const secondsIntoHour = totalCalendarSeconds % FICTIONAL_SECONDS_PER_HOUR;
  const secondsIntoDay = totalCalendarSeconds % FICTIONAL_SECONDS_PER_DAY;
  const totalElapsedDays = Math.floor(totalCalendarSeconds / FICTIONAL_SECONDS_PER_DAY);
  const zeroBasedDayOfYear = totalElapsedDays % DAYS_PER_YEAR;
  const secondsIntoLunarDay = totalLunarSeconds % LUNAR_SECONDS_PER_DAY;
  const secondsIntoTide = (
    lunar.tide.timeInPeriod.hour * LUNAR_SECONDS_PER_HOUR
  ) + (
    lunar.tide.timeInPeriod.minute * LUNAR_SECONDS_PER_MINUTE
  ) + lunar.tide.timeInPeriod.second;
  const tideDurationSeconds = lunar.tide.durationHours * LUNAR_SECONDS_PER_HOUR;
  return {
    lunarCycle: progressValue((((lunar.day - 1) * LUNAR_SECONDS_PER_DAY) + secondsIntoLunarDay) / LUNAR_SECONDS_PER_CYCLE),
    lunarPhase: progressValue(secondsIntoLunarDay / LUNAR_SECONDS_PER_DAY),
    season: progressValue((((season.day - 1) * FICTIONAL_SECONDS_PER_DAY) + secondsIntoDay) / (season.lengthDays * FICTIONAL_SECONDS_PER_DAY)),
    year: progressValue(((zeroBasedDayOfYear * FICTIONAL_SECONDS_PER_DAY) + secondsIntoDay) / (DAYS_PER_YEAR * FICTIONAL_SECONDS_PER_DAY)),
    day: progressValue(secondsIntoDay / FICTIONAL_SECONDS_PER_DAY),
    hour: progressValue(secondsIntoHour / FICTIONAL_SECONDS_PER_HOUR),
    tide: progressValue(secondsIntoTide / tideDurationSeconds)
  };
}

export function calculateLunarState(totalLunarSeconds) {
  assertNonNegativeSafeInteger(totalLunarSeconds, 'totalLunarSeconds');
  const completedLunarDays = Math.floor(totalLunarSeconds / LUNAR_SECONDS_PER_DAY);
  const zeroBasedLunarDay = completedLunarDays % LUNAR_DAYS_PER_CYCLE;
  const secondsIntoLunarDay = totalLunarSeconds % LUNAR_SECONDS_PER_DAY;
  const hour = Math.floor(secondsIntoLunarDay / LUNAR_SECONDS_PER_HOUR);
  const secondsIntoHour = secondsIntoLunarDay % LUNAR_SECONDS_PER_HOUR;
  const minute = Math.floor(secondsIntoHour / LUNAR_SECONDS_PER_MINUTE);
  const second = secondsIntoHour % LUNAR_SECONDS_PER_MINUTE;
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
    time: {
      hour,
      minute,
      second,
      realMillisecondsPerLunarSecond: REAL_MS_PER_LUNAR_SECOND,
      secondsPerLunarMinute: LUNAR_SECONDS_PER_MINUTE,
      minutesPerLunarHour: LUNAR_MINUTES_PER_HOUR,
      hoursPerLunarDay: LUNAR_HOURS_PER_DAY
    },
    tide
  };
}

export function calculateCalendarState(realUnixMilliseconds) {
  assertValidUnixMilliseconds(realUnixMilliseconds);
  const elapsedRealMilliseconds = realUnixMilliseconds - CALENDAR_EPOCH_UNIX_MS;
  const totalSeconds = Math.floor(elapsedRealMilliseconds / REAL_MS_PER_FICTIONAL_SECOND);
  const totalLunarSeconds = Math.floor(elapsedRealMilliseconds / REAL_MS_PER_LUNAR_SECOND);
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
      const day = remainingDays + 1;
      period = {
        type: 'month',
        monthId: MONTH_IDS[index],
        monthIndex: index + 1,
        day,
        namedDayId: resolveNamedDayId('month', day),
        length: DAYS_PER_MONTH,
        rulership: calculateMonthRulershipState(zeroBasedYear, index)
      };
      break;
    }
    remainingDays -= DAYS_PER_MONTH;
    const interLength = INTER_REGNUM_LENGTHS[index];
    if (remainingDays < interLength) {
      const day = remainingDays + 1;
      period = {
        type: 'inter_regnum',
        interRegnumId: INTER_REGNUM_IDS[index],
        fromMonthId: MONTH_IDS[index],
        toMonthId: MONTH_IDS[(index + 1) % MONTHS_PER_YEAR],
        day,
        namedDayId: resolveNamedDayId('inter_regnum', day),
        length: interLength
      };
      break;
    }
    remainingDays -= interLength;
  }
  const season = calculateSeasonState(totalElapsedDays);
  const lunar = calculateLunarState(totalLunarSeconds);
  const orbits = calculateOrbitalState(totalSeconds, totalLunarSeconds);
  const progress = calculateProgressState(totalSeconds, totalLunarSeconds, season, lunar);
  const outcome = calculateOutcomeState(lunar.tide, orbits, progress.tide.fraction);
  return {
    totalSeconds,
    totalLunarSeconds,
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
