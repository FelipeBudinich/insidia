import { bootstrapStaticPage } from './app-bootstrap.js';

const STATIC_PAGE_IDS = Object.freeze(['page-04', 'page-05', 'page-06', 'page-09']);

export function bootstrapCurrentStaticPage(options = {}) {
  const documentRoot = options.documentRoot ?? document;
  const pageId = documentRoot.documentElement.dataset.currentPageId;
  if (!STATIC_PAGE_IDS.includes(pageId)) {
    throw new Error(`Unsupported static page ID: ${pageId ?? ''}`);
  }
  return bootstrapStaticPage(pageId, { ...options, documentRoot });
}

bootstrapCurrentStaticPage();
