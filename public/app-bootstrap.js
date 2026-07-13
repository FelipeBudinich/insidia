import { getPageDefinition } from './page-definitions.js';
import { loadPresentationContext } from './presentation-context-loader.js';
import { startLiveState } from './live-state.js';

const APPLICATION_VERSION = '8.18';
const EPOCH_TEXT = '1970-01-01 00:00:00 UTC';

function parsePageIdList(value) {
  return String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function applyCommonDocumentPresentation(documentRoot, pageId, context) {
  documentRoot.documentElement.lang = context.languageTag;
  const page = context.getPage(pageId);
  const pageDefinition = getPageDefinition(pageId);
  documentRoot.title = context.format('document.title', {
    pageName: page.name,
    applicationName: context.applicationDisplayName
  });
  const metaDescription = documentRoot.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute('content', context.format(pageDefinition.descriptionTemplateKey, {
      pageName: page.name,
      applicationName: context.applicationDisplayName
    }));
  }
  const nav = documentRoot.querySelector('.primary-nav');
  nav.setAttribute('aria-label', context.message('nav.aria'));
  const query = new URLSearchParams({ locale: context.resolvedLocaleId }).toString();
  for (const link of documentRoot.querySelectorAll('[data-page-id]')) {
    const targetPageId = link.dataset.pageId;
    const targetPage = context.getPage(targetPageId);
    const targetDefinition = getPageDefinition(targetPageId);
    link.textContent = targetPage.name;
    link.setAttribute('href', `${targetDefinition.route}?${query}`);
  }
  for (const link of documentRoot.querySelectorAll('[data-navigation-group-id]')) {
    const navigationGroup = context.getNavigationGroup(link.dataset.navigationGroupId);
    const targetDefinition = getPageDefinition(link.dataset.navigationTargetPageId);
    link.textContent = navigationGroup.name;
    link.setAttribute('href', `${targetDefinition.route}?${query}`);
  }
  for (const element of documentRoot.querySelectorAll('[data-navigation-category-pages]')) {
    if (parsePageIdList(element.dataset.navigationCategoryPages).includes(pageId)) {
      element.setAttribute('data-active-section', 'true');
    } else {
      element.removeAttribute('data-active-section');
    }
  }
  for (const element of documentRoot.querySelectorAll('[data-navigation-submenu-pages]')) {
    element.hidden = !parsePageIdList(element.dataset.navigationSubmenuPages).includes(pageId);
  }
  for (const element of documentRoot.querySelectorAll('[data-page-name]')) {
    element.textContent = page.name;
  }
  for (const element of documentRoot.querySelectorAll('[data-page-section-id]')) {
    element.textContent = context.getPageSection(element.dataset.pageSectionId).name;
  }
  for (const element of documentRoot.querySelectorAll('[data-current-location]')) {
    element.textContent = context.currentLocation.name;
  }
  for (const element of documentRoot.querySelectorAll('[data-message-key]')) {
    element.textContent = context.message(element.dataset.messageKey);
  }
  for (const element of documentRoot.querySelectorAll('[data-application-name]')) {
    element.textContent = context.applicationDisplayName;
  }
  for (const element of documentRoot.querySelectorAll('[data-version]')) {
    element.textContent = 'v8.18';
    element.setAttribute('aria-label', context.format('accessibility.version', {
      label: context.message('accessibility.applicationVersion'),
      version: APPLICATION_VERSION
    }));
  }
  const seasonProgress = documentRoot.querySelector('[data-season-progress-bar]');
  if (seasonProgress) seasonProgress.setAttribute('aria-label', context.message('accessibility.seasonProgress'));
  for (const element of documentRoot.querySelectorAll('[data-epoch]')) {
    element.textContent = context.format('footer.epoch', {
      epochLabel: context.message('label.epoch'),
      epoch: EPOCH_TEXT
    });
  }
}

function renderConfigurationError(documentRoot, message, languageTag = 'en') {
  documentRoot.documentElement.lang = languageTag;
  documentRoot.documentElement.removeAttribute('aria-busy');
  documentRoot.body.textContent = '';
  const main = documentRoot.createElement('main');
  main.className = 'configuration-error';
  main.setAttribute('role', 'alert');
  const paragraph = documentRoot.createElement('p');
  paragraph.textContent = message;
  main.append(paragraph);
  documentRoot.body.append(main);
}

async function bootstrapDocument(pageId, options, complete) {
  const documentRoot = options.documentRoot ?? document;
  const locationLike = options.locationLike ?? window.location;
  const fetchFn = options.fetchFn ?? window.fetch.bind(window);
  documentRoot.documentElement.setAttribute('aria-busy', 'true');
  try {
    const context = await loadPresentationContext(locationLike, { fetchFn });
    applyCommonDocumentPresentation(documentRoot, pageId, context);
    const completionValue = complete(context, documentRoot);
    documentRoot.documentElement.setAttribute('aria-busy', 'false');
    return completionValue;
  } catch (error) {
    const localeResult = error?.localeResult;
    const message = localeResult?.locale?.messages?.['error.configuration']
      ?? 'Unable to load application configuration.';
    renderConfigurationError(documentRoot, message, localeResult?.locale?.languageTag ?? 'en');
    console.error('Application configuration failed.', error);
    return null;
  }
}

export function bootstrapPage(pageId, createRenderer, options = {}) {
  return bootstrapDocument(pageId, options, (context, documentRoot) => {
    const renderer = createRenderer(documentRoot, context);
    return startLiveState(renderer);
  });
}

export function bootstrapStaticPage(pageId, options = {}) {
  return bootstrapDocument(pageId, options, (context) => context);
}
