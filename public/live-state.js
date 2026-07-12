import { calculateCalendarState } from './core/mechanics.js';
import { CALENDAR_EPOCH_UNIX_MS, REAL_MS_PER_FICTIONAL_SECOND } from './core/rules.js';

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

    const elapsedWithinSecond = (
      realUnixMilliseconds - CALENDAR_EPOCH_UNIX_MS
    ) % REAL_MS_PER_FICTIONAL_SECOND;
    const millisecondsUntilNextSecond = (
      REAL_MS_PER_FICTIONAL_SECOND - elapsedWithinSecond
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
