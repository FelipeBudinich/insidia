import { bootstrapStaticPage } from './location-bootstrap.js';

const LOCATION_PAGE_IDS = Object.freeze(['page-07', 'page-08']);

export function bootstrapCurrentLocationPage(options = {}) {
  const documentRoot = options.documentRoot ?? document;
  const pageId = documentRoot.documentElement.dataset.currentPageId;
  if (!LOCATION_PAGE_IDS.includes(pageId)) {
    throw new Error(`Unsupported location page ID: ${pageId ?? ''}`);
  }
  return bootstrapStaticPage(pageId, { ...options, documentRoot });
}

bootstrapCurrentLocationPage();
