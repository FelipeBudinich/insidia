import { bootstrapConfiguredStaticPage } from './app-bootstrap.js';
import { renderLocationPage } from './location-renderers.js';
import { createLocationContext } from './location.js';
import { loadWorld } from './world-loader.js';

const LOCATION_PAGE_IDS = Object.freeze(['page-07', 'page-08']);

async function loadLocationContext({ fetchFn, baseUrl }) {
  const worldResult = await loadWorld({ fetchFn, baseUrl });
  return createLocationContext({ worldResult });
}

export function bootstrapStaticPage(pageId, options = {}) {
  if (!LOCATION_PAGE_IDS.includes(pageId)) {
    throw new Error(`Unsupported location page ID: ${pageId}`);
  }
  return bootstrapConfiguredStaticPage(
    pageId,
    loadLocationContext,
    renderLocationPage.bind(null, pageId),
    options
  );
}
