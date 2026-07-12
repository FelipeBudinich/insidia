import { loadLocale } from './locale-loader.js';
import { createPresentationContext } from './nomenclature.js';
import { loadUniverse } from './universe-loader.js';

export function requestedContextIds(locationLike) {
  const url = new URL(locationLike.href ?? String(locationLike));
  return {
    requestedUniverseId: url.searchParams.get('universe') || undefined,
    requestedLocaleId: url.searchParams.get('locale') || undefined
  };
}

export async function loadPresentationContext(locationLike, options = {}) {
  const baseUrl = locationLike.href ?? String(locationLike);
  const { requestedUniverseId, requestedLocaleId } = requestedContextIds(locationLike);
  const fetchFn = options.fetchFn ?? window.fetch.bind(window);
  const [localeResult, universeResult] = await Promise.all([
    loadLocale({ requestedId: requestedLocaleId, fetchFn, baseUrl }),
    loadUniverse({ requestedId: requestedUniverseId, fetchFn, baseUrl })
  ]);
  return createPresentationContext({ universeResult, localeResult });
}
