export const PERFORMANCE_MARKS = Object.freeze({
  bootstrapStart: 'insidia:bootstrap-start',
  nomenclatureRequestStart: 'insidia:nomenclature-request-start',
  worldRequestStart: 'insidia:world-request-start',
  configurationReady: 'insidia:configuration-ready',
  firstRender: 'insidia:first-render',
  configurationError: 'insidia:configuration-error'
});

function isPerformanceMode(locationLike) {
  try {
    const href = locationLike?.href ?? String(locationLike);
    return new URL(href).searchParams.get('perf') === '1';
  } catch {
    return false;
  }
}

export function createPerformanceInstrumentation({ locationLike, performanceLike } = {}) {
  const enabled = isPerformanceMode(locationLike)
    && typeof performanceLike?.mark === 'function';

  return Object.freeze({
    enabled,
    mark(name) {
      if (enabled) performanceLike.mark(name);
    }
  });
}
