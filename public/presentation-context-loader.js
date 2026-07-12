import { loadLocale } from './locale-loader.js';
import { loadNomenclature } from './nomenclature-loader.js';
import { createPresentationContext } from './nomenclature.js';

export function requestedPresentationOptions(locationLike) {
  const url = new URL(locationLike.href ?? String(locationLike));
  return { requestedLocaleId: url.searchParams.get('locale') || undefined };
}

export async function loadPresentationContext(locationLike, options = {}) {
  const baseUrl = locationLike.href ?? String(locationLike);
  const { requestedLocaleId } = requestedPresentationOptions(locationLike);
  const fetchFn = options.fetchFn ?? window.fetch.bind(window);
  const [localeResult, nomenclatureResult] = await Promise.all([
    loadLocale({ requestedId: requestedLocaleId, fetchFn, baseUrl }),
    loadNomenclature({ fetchFn, baseUrl })
  ]);
  return createPresentationContext({ nomenclatureResult, localeResult });
}
