import { getPageDefinition, NAVIGATION_GROUPS } from './page-definitions.js';
import { INTERFACE_LANGUAGE_TAG, INTERFACE_MESSAGES } from './interface-text.js';
import { loadNomenclature } from './nomenclature-loader.js';
import { createPresentationContext } from './nomenclature.js';
import { createPerformanceInstrumentation, PERFORMANCE_MARKS } from './performance.js';
import { APPLICATION_VERSION } from './version.js';

export { APPLICATION_VERSION };
const EPOCH_TEXT = '1970-01-01 00:00:00 UTC';

export function renderNavigation(documentRoot, pageId, context) {
  getPageDefinition(pageId);
  const activeGroup = NAVIGATION_GROUPS.find(({ pageIds }) => pageIds.includes(pageId));
  if (!activeGroup) throw new Error(`Page is not assigned to a navigation group: ${pageId}`);
  const navigation = documentRoot.querySelector('[data-navigation]');
  if (!navigation) throw new Error('Missing navigation placeholder');
  navigation.setAttribute('aria-label', context.message('nav.aria'));
  navigation.replaceChildren();

  const categories = documentRoot.createElement('div');
  categories.className = 'primary-nav-categories';
  for (const group of NAVIGATION_GROUPS) {
    const link = documentRoot.createElement('a');
    link.id = group.categoryElementId;
    link.className = 'navigation-category-link';
    link.dataset.navigationGroupId = group.id;
    link.href = getPageDefinition(group.targetPageId).route;
    link.textContent = context.getNavigationGroup(group.id).name;
    if (group === activeGroup) link.setAttribute('data-active-section', 'true');
    categories.append(link);
  }
  navigation.append(categories);

  const secondary = documentRoot.createElement('div');
  secondary.className = 'secondary-nav';
  secondary.setAttribute('role', 'group');
  secondary.setAttribute('aria-labelledby', activeGroup.categoryElementId);
  for (const targetPageId of activeGroup.pageIds) {
    const link = documentRoot.createElement('a');
    link.dataset.pageId = targetPageId;
    link.href = getPageDefinition(targetPageId).route;
    link.textContent = context.getPage(targetPageId).name;
    if (targetPageId === pageId) link.setAttribute('aria-current', 'page');
    secondary.append(link);
  }
  navigation.append(secondary);
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
  renderNavigation(documentRoot, pageId, context);
  for (const element of documentRoot.querySelectorAll('[data-page-name]')) {
    element.textContent = page.name;
  }
  for (const element of documentRoot.querySelectorAll('[data-page-section-id]')) {
    element.textContent = context.getPageSection(element.dataset.pageSectionId).name;
  }
  for (const element of documentRoot.querySelectorAll('[data-message-key]')) {
    element.textContent = context.message(element.dataset.messageKey);
  }
  for (const element of documentRoot.querySelectorAll('[data-application-name]')) {
    element.textContent = context.applicationDisplayName;
  }
  for (const element of documentRoot.querySelectorAll('[data-version]')) {
    element.textContent = `v${APPLICATION_VERSION}`;
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

function renderConfigurationError(documentRoot) {
  documentRoot.documentElement.lang = INTERFACE_LANGUAGE_TAG;
  documentRoot.documentElement.removeAttribute('aria-busy');
  documentRoot.body.textContent = '';
  const main = documentRoot.createElement('main');
  main.className = 'configuration-error';
  main.setAttribute('role', 'alert');
  const paragraph = documentRoot.createElement('p');
  paragraph.textContent = INTERFACE_MESSAGES['error.configuration'];
  main.append(paragraph);
  documentRoot.body.append(main);
}

export async function bootstrapDocument(pageId, options, complete, loadConfiguredContext) {
  const documentRoot = options.documentRoot ?? document;
  const locationLike = options.locationLike ?? window.location;
  const fetchFn = options.fetchFn ?? window.fetch.bind(window);
  const performanceLike = options.performanceLike ?? globalThis.performance;
  const instrumentation = createPerformanceInstrumentation({ locationLike, performanceLike });
  const baseUrl = locationLike.href ?? String(locationLike);
  instrumentation.mark(PERFORMANCE_MARKS.bootstrapStart);
  documentRoot.documentElement.setAttribute('aria-busy', 'true');
  try {
    instrumentation.mark(PERFORMANCE_MARKS.nomenclatureRequestStart);
    const nomenclaturePromise = loadNomenclature({ fetchFn, baseUrl });
    let configuredContextPromise;
    try {
      if (loadConfiguredContext) instrumentation.mark(PERFORMANCE_MARKS.worldRequestStart);
      configuredContextPromise = loadConfiguredContext
        ? loadConfiguredContext({ fetchFn, baseUrl })
        : Promise.resolve(undefined);
    } catch (error) {
      configuredContextPromise = Promise.reject(error);
    }
    const [nomenclatureResult, configuredContext] = await Promise.all([
      nomenclaturePromise,
      configuredContextPromise
    ]);
    instrumentation.mark(PERFORMANCE_MARKS.configurationReady);
    const context = createPresentationContext({ nomenclatureResult });
    applyCommonDocumentPresentation(documentRoot, pageId, context);
    const completionValue = complete(context, documentRoot, configuredContext);
    documentRoot.documentElement.setAttribute('aria-busy', 'false');
    instrumentation.mark(PERFORMANCE_MARKS.firstRender);
    return completionValue;
  } catch (error) {
    instrumentation.mark(PERFORMANCE_MARKS.configurationError);
    renderConfigurationError(documentRoot);
    console.error('Application configuration failed.', error);
    return null;
  }
}

export function bootstrapStaticPage(pageId, options = {}) {
  return bootstrapDocument(pageId, options, (context) => context);
}

export function bootstrapConfiguredStaticPage(
  pageId,
  loadConfiguredContext,
  renderConfiguredPage,
  options = {}
) {
  if (typeof loadConfiguredContext !== 'function') {
    throw new TypeError('loadConfiguredContext must be a function');
  }
  if (typeof renderConfiguredPage !== 'function') {
    throw new TypeError('renderConfiguredPage must be a function');
  }
  return bootstrapDocument(pageId, options, (context, documentRoot, configuredContext) => {
    const renderResult = renderConfiguredPage(documentRoot, context, configuredContext);
    return renderResult === undefined ? configuredContext : renderResult;
  }, loadConfiguredContext);
}
