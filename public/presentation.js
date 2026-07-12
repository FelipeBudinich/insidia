import { formatClock, formatPercentage, formatRomanNumeral } from './core/formatting.js';

export function formatCalendarPeriod(state, context) {
  const period = state.calendar.period;
  const weekdayName = context.getWeekday(state.calendar.weekdayId).name;
  const dayRoman = formatRomanNumeral(period.day);
  if (period.type === 'month') {
    return context.format('calendar.monthPeriod', {
      monthName: context.getMonth(period.monthId).name,
      weekdayName,
      dayRoman
    });
  }
  return context.format('calendar.interPeriod', {
    interRegnumName: context.getInterRegnum(period.interRegnumId).name,
    weekdayName,
    dayRoman
  });
}

export function formatFictionalYear(state, context) {
  return context.format('calendar.formattedYear', {
    yearName: context.calendarYearName,
    yearRoman: formatRomanNumeral(state.calendar.year)
  });
}

export function formatFictionalDate(state, context) {
  return context.format('calendar.formattedDate', {
    formattedYear: formatFictionalYear(state, context),
    periodLabel: formatCalendarPeriod(state, context)
  });
}

export function formatLunarSummary(state, context) {
  const phase = context.getLunarPhase(state.lunar.phaseId);
  return context.format('lunar.summary', {
    phaseName: phase.name,
    cycleName: context.lunarCycleName,
    cycleRoman: formatRomanNumeral(state.lunar.cycle)
  });
}

function displayPull(pull, context) {
  return {
    id: pull.id,
    name: context.getPull(pull.id).name,
    members: pull.memberIds.map((id) => ({ id, ...context.getCelestialBody(id) })),
    formattedSpan: formatPercentage(pull.spanFraction),
    formattedAlignment: formatPercentage(1 - pull.spanFraction)
  };
}

export function createDisplayData(state, context) {
  const period = state.calendar.period;
  const month = period.type === 'month' ? context.getMonth(period.monthId) : null;
  const interRegnum = period.type === 'inter_regnum' ? context.getInterRegnum(period.interRegnumId) : null;
  const weekday = context.getWeekday(state.calendar.weekdayId);
  const formattedYear = formatFictionalYear(state, context);
  return {
    formattedDate: formatFictionalDate(state, context),
    calendar: {
      yearName: context.calendarYearName,
      formattedYear,
      month,
      interRegnum,
      weekday,
      periodLabel: formatCalendarPeriod(state, context),
      time: formatClock(state.calendar.time)
    },
    season: {
      id: state.season.id,
      name: context.getSeason(state.season.id).name,
      next: { id: state.season.nextId, name: context.getSeason(state.season.nextId).name }
    },
    lunar: {
      phase: { id: state.lunar.phaseId, name: context.getLunarPhase(state.lunar.phaseId).name },
      cycleName: context.lunarCycleName,
      formattedCycle: formatRomanNumeral(state.lunar.cycle),
      formattedSummary: formatLunarSummary(state, context),
      tide: { id: state.lunar.tide.id, name: context.getTide(state.lunar.tide.id).name },
      time: formatClock(state.lunar.time),
      tideTime: formatClock(state.lunar.tide.timeInPeriod)
    },
    outcomeType: {
      id: state.outcome.outcomeTypeId,
      name: context.getOutcomeType(state.outcome.outcomeTypeId).name
    },
    orbits: {
      bodies: state.orbits.bodies.map((body) => ({
        id: body.id,
        ...context.getCelestialBody(body.id),
        formattedProgress: formatPercentage(body.progressFraction)
      })),
      pulls: Object.fromEntries(Object.entries(state.orbits.pulls).map(([id, pull]) => [id, displayPull(pull, context)]))
    },
    progress: Object.fromEntries(Object.entries(state.progress).map(([key, value]) => [key, formatPercentage(value.fraction)]))
  };
}

function copyRawState(state) {
  return {
    totalSeconds: state.totalSeconds,
    calendar: state.calendar,
    season: state.season,
    lunar: state.lunar,
    orbits: state.orbits,
    progress: state.progress
  };
}

export function createCalendarJson(state, realUnixMilliseconds, context) {
  return {
    calendarVersion: 'v13',
    nomenclature: {
      schemaVersion: context.nomenclatureSchemaVersion,
      applicationDisplayName: context.applicationDisplayName
    },
    locale: {
      requestedId: context.requestedLocaleId,
      resolvedId: context.resolvedLocaleId,
      languageTag: context.languageTag,
      schemaVersion: context.localeSchemaVersion
    },
    source: { unixMilliseconds: realUnixMilliseconds, isoUtc: new Date(realUnixMilliseconds).toISOString() },
    state: copyRawState(state),
    display: createDisplayData(state, context)
  };
}
