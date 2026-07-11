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

/**
 * Convert an explicit real Unix timestamp to the fictional calendar.
 * This module is intentionally independent of the DOM and Date.now().
 */
export function calculateFictionalCalendar(realUnixMilliseconds) {
  assertValidUnixMilliseconds(realUnixMilliseconds);

  const totalSeconds = Math.floor(
    (realUnixMilliseconds - CALENDAR_EPOCH_UNIX_MS) / REAL_MS_PER_FICTIONAL_SECOND
  );
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

  return {
    totalSeconds,
    totalElapsedDays,
    year: zeroBasedYear + 1,
    dayOfYear: zeroBasedDayOfYear + 1,
    weekOfYear: Math.floor(zeroBasedDayOfYear / FICTIONAL_DAYS_PER_WEEK) + 1,
    dayOfWeek: (totalElapsedDays % FICTIONAL_DAYS_PER_WEEK) + 1,
    period,
    time: { hour, minute, second }
  };
}

export function formatFictionalTime(calendarValue) {
  const { hour, minute, second } = calendarValue.time;
  return `${padTwo(hour)}:${padTwo(minute)}:${padTwo(second)}`;
}

export function formatFictionalDate(calendarValue) {
  const { year, period } = calendarValue;
  if (period.type === 'month') {
    return `Year ${year} · Month ${period.month} · Day ${period.day}`;
  }
  return `Year ${year} · Inter Regnum ${period.fromMonth} → ${period.toMonth} · Day ${period.day} of ${period.length}`;
}

export function createCalendarJson(calendarValue, realUnixMilliseconds) {
  assertValidUnixMilliseconds(realUnixMilliseconds);
  const formattedTime = formatFictionalTime(calendarValue);
  return {
    calendarVersion: 'v1',
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
      formattedDate: formatFictionalDate(calendarValue)
    }
  };
}
