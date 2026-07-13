import { calculateCalendarState } from './core/mechanics.js';
import {
  CALENDAR_EPOCH_UNIX_MS,
  REAL_MS_PER_FICTIONAL_SECOND,
  REAL_MS_PER_LUNAR_SECOND
} from './core/rules.js';

export function millisecondsUntilNextBoundary(realUnixMilliseconds, unitMilliseconds) {
  if (typeof realUnixMilliseconds !== 'number') {
    throw new TypeError('realUnixMilliseconds must be a number');
  }
  if (!Number.isFinite(realUnixMilliseconds)) {
    throw new RangeError('realUnixMilliseconds must be finite');
  }
  if (typeof unitMilliseconds !== 'number') {
    throw new TypeError('unitMilliseconds must be a number');
  }
  if (!Number.isFinite(unitMilliseconds) || !Number.isInteger(unitMilliseconds) || unitMilliseconds <= 0) {
    throw new RangeError('unitMilliseconds must be a positive integer');
  }
  const elapsedRealMilliseconds = realUnixMilliseconds - CALENDAR_EPOCH_UNIX_MS;
  const elapsedWithinUnit = ((elapsedRealMilliseconds % unitMilliseconds) + unitMilliseconds) % unitMilliseconds;
  return unitMilliseconds - elapsedWithinUnit;
}

export function captureLiveState() {
  const realUnixMilliseconds = Date.now();
  return {
    calendarValue: calculateCalendarState(realUnixMilliseconds),
    realUnixMilliseconds
  };
}

export function startLiveState(renderSnapshot) {
  if (typeof renderSnapshot !== 'function') {
    throw new TypeError('renderSnapshot must be a function');
  }

  let timeoutId;

  function update() {
    window.clearTimeout(timeoutId);
    const { calendarValue, realUnixMilliseconds } = captureLiveState();
    renderSnapshot(calendarValue, realUnixMilliseconds);

    const millisecondsUntilCalendarSecond = millisecondsUntilNextBoundary(
      realUnixMilliseconds,
      REAL_MS_PER_FICTIONAL_SECOND
    );
    const millisecondsUntilLunarSecond = millisecondsUntilNextBoundary(
      realUnixMilliseconds,
      REAL_MS_PER_LUNAR_SECOND
    );
    const millisecondsUntilNextSecond = Math.min(
      millisecondsUntilCalendarSecond,
      millisecondsUntilLunarSecond
    );
    timeoutId = window.setTimeout(update, Math.max(1, millisecondsUntilNextSecond + 5));
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      update();
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  update();

  return function stopLiveState() {
    window.clearTimeout(timeoutId);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
