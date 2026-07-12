export function padTwo(value) {
  return String(value).padStart(2, '0');
}

export function formatClock(time) {
  return `${padTwo(time.hour)}:${padTwo(time.minute)}:${padTwo(time.second)}`;
}

export function formatPercentage(progressFraction) {
  if (typeof progressFraction !== 'number') {
    throw new TypeError('progressFraction must be a number');
  }
  if (!Number.isFinite(progressFraction) || progressFraction < 0 || progressFraction > 1) {
    throw new RangeError('progressFraction must be finite and between 0 and 1');
  }
  const truncated = Math.trunc(progressFraction * 100 * 1_000_000) / 1_000_000;
  const safe = progressFraction < 1 ? Math.min(truncated, 99.999999) : 100;
  return `${safe.toFixed(6)}%`;
}
