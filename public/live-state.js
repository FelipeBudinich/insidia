import { CALENDAR_EPOCH_UNIX_MS } from './core/rules.js';

const SCHEDULING_TOLERANCE_MILLISECONDS = 5;

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

function validateBoundaryMilliseconds(boundaryMilliseconds) {
  if (!Array.isArray(boundaryMilliseconds) || boundaryMilliseconds.length === 0) {
    throw new TypeError('boundaryMilliseconds must be a non-empty array');
  }
  if (!Object.isFrozen(boundaryMilliseconds)) {
    throw new TypeError('boundaryMilliseconds must be immutable');
  }
  boundaryMilliseconds.forEach((value, index) => {
    if (typeof value !== 'number') {
      throw new TypeError(`boundaryMilliseconds[${index}] must be a number`);
    }
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
      throw new RangeError(`boundaryMilliseconds[${index}] must be a positive integer`);
    }
  });
}

export function startLiveState({ calculateState, renderSnapshot, boundaryMilliseconds } = {}) {
  if (typeof calculateState !== 'function') {
    throw new TypeError('calculateState must be a function');
  }
  if (typeof renderSnapshot !== 'function') {
    throw new TypeError('renderSnapshot must be a function');
  }
  validateBoundaryMilliseconds(boundaryMilliseconds);

  let timeoutId = null;
  let stopped = false;

  function clearScheduledUpdate() {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function scheduleNextUpdate(realUnixMilliseconds) {
    if (stopped || document.visibilityState !== 'visible') return;
    const delay = Math.min(...boundaryMilliseconds.map(
      (boundary) => millisecondsUntilNextBoundary(realUnixMilliseconds, boundary)
    ));
    timeoutId = window.setTimeout(
      update,
      Math.max(1, delay + SCHEDULING_TOLERANCE_MILLISECONDS)
    );
  }

  function update() {
    clearScheduledUpdate();
    if (stopped) return;
    const realUnixMilliseconds = Date.now();
    const state = calculateState(realUnixMilliseconds);
    renderSnapshot(state, realUnixMilliseconds);
    scheduleNextUpdate(realUnixMilliseconds);
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') update();
    else clearScheduledUpdate();
  }

  update();
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return function stopLiveState() {
    if (stopped) return;
    stopped = true;
    clearScheduledUpdate();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
