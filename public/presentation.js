import { DAYS_PER_YEAR, FICTIONAL_DAYS_PER_WEEK } from './core/rules.js';
import { formatClock, formatPercentage } from './core/formatting.js';

export function formatCalendarPeriod(state, context) {
  const period = state.calendar.period;
  if (period.type === 'month') {
    return context.format('calendar.monthPeriod', {
      monthName: context.getMonth(period.monthId).name,
      dayLabel: context.message('label.day'),
      day: period.day
    });
  }
  return context.format('calendar.interPeriod', {
    interRegnumName: context.getInterRegnum(period.interRegnumId).name,
    dayLabel: context.message('label.day'),
    day: period.day,
    length: period.length
  });
}

export function formatFictionalDate(state, context) {
  return context.format('calendar.formattedDate', {
    yearLabel: context.message('label.year'),
    year: state.calendar.year,
    periodLabel: formatCalendarPeriod(state, context)
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
  return {
    formattedDate: formatFictionalDate(state, context),
    calendar: {
      month,
      interRegnum,
      weekday: context.getWeekday(state.calendar.weekdayId),
      periodLabel: formatCalendarPeriod(state, context),
      time: formatClock(state.calendar.time),
      metadata: context.format('calendar.metadata', {
        weekLabel: context.message('label.week'), week: state.calendar.weekOfYear,
        dayLabel: context.message('label.day'), weekday: state.calendar.dayOfWeek,
        weekLength: FICTIONAL_DAYS_PER_WEEK, dayOfYear: state.calendar.dayOfYear, yearLength: DAYS_PER_YEAR
      })
    },
    season: {
      id: state.season.id,
      name: context.getSeason(state.season.id).name,
      next: { id: state.season.nextId, name: context.getSeason(state.season.nextId).name }
    },
    lunar: {
      phase: { id: state.lunar.phaseId, name: context.getLunarPhase(state.lunar.phaseId).name },
      tide: { id: state.lunar.tide.id, name: context.getTide(state.lunar.tide.id).name },
      time: formatClock(state.lunar.time),
      tideTime: formatClock(state.lunar.tide.timeInPeriod)
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
    calendarVersion: 'v9',
    universe: {
      requestedId: context.requestedUniverseId,
      resolvedId: context.resolvedUniverseId,
      displayName: context.universeDisplayName,
      schemaVersion: context.universeSchemaVersion
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
