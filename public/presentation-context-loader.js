import { loadLocale } from './locale-loader.js';
import { loadNomenclature } from './nomenclature-loader.js';
import { createPresentationContext } from './nomenclature.js';

export function requestedPresentationOptions(locationLike) {
  const url = new URL(locationLike.href ?? String(locationLike));
  return { requestedLocaleId: url.searchParams.get('locale') || undefined };
}

export class PresentationContextLoadError extends Error {
  constructor(cause, localeResult) {
    super('Unable to load presentation context.', { cause });
    this.name = 'PresentationContextLoadError';
    this.localeResult = localeResult;
  }
}

export async function loadPresentationContext(locationLike, options = {}) {
  const baseUrl = locationLike.href ?? String(locationLike);
  const { requestedLocaleId } = requestedPresentationOptions(locationLike);
  const fetchFn = options.fetchFn ?? window.fetch.bind(window);
  const localePromise = loadLocale({ requestedId: requestedLocaleId, fetchFn, baseUrl });
  const nomenclaturePromise = loadNomenclature({ fetchFn, baseUrl });
  const [localeSettlement, nomenclatureSettlement] = await Promise.allSettled([
    localePromise,
    nomenclaturePromise
  ]);
  const localeResult = localeSettlement.status === 'fulfilled' ? localeSettlement.value : undefined;
  if (localeSettlement.status === 'rejected' || nomenclatureSettlement.status === 'rejected') {
    const cause = localeSettlement.status === 'rejected'
      ? localeSettlement.reason
      : nomenclatureSettlement.reason;
    throw new PresentationContextLoadError(cause, localeResult);
  }
  const nomenclatureResult = nomenclatureSettlement.value;
  return createPresentationContext({ nomenclatureResult, localeResult });
}
