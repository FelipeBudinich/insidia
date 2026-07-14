import { bootstrapConfiguredStaticPage } from './app-bootstrap.js';
import { createLocationContext } from './location.js';
import { renderLocationPage } from './location-renderers.js';
import { loadWorld } from './world-loader.js';

const LOCATION_PAGE_IDS = new Set(['page-07', 'page-08']);

async function loadLocationContext({ fetchFn, baseUrl }) {
  const worldResult = await loadWorld({ fetchFn, baseUrl });
  return createLocationContext({ worldResult });
}

export function bootstrapStaticPage(pageId, options = {}) {
  if (!LOCATION_PAGE_IDS.has(pageId)) {
    throw new Error(`Unsupported location page ID: ${pageId}`);
  }
  return bootstrapConfiguredStaticPage(
    pageId,
    loadLocationContext,
    (documentRoot, presentationContext, locationContext) => {
      renderLocationPage(pageId, documentRoot, presentationContext, locationContext);
    },
    options
  );
}
