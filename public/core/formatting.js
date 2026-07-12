export function padTwo(value) {
  return String(value).padStart(2, '0');
}

export function formatClock(time) {
  return `${padTwo(time.hour)}:${padTwo(time.minute)}:${padTwo(time.second)}`;
}

export function formatRomanNumeral(value) {
  if (typeof value !== 'number') {
    throw new TypeError('Roman numeral value must be a number');
  }
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1 || value > 3999) {
    throw new RangeError('Roman numeral value must be an integer between 1 and 3999');
  }
  const numerals = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let remaining = value;
  let formatted = '';
  for (const [numericValue, numeral] of numerals) {
    while (remaining >= numericValue) {
      formatted += numeral;
      remaining -= numericValue;
    }
  }
  return formatted;
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
