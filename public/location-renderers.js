function requireElement(documentRoot, selector) {
  const element = documentRoot.querySelector(selector);
  if (!element) throw new Error(`Missing location page element: ${selector}`);
  return element;
}

function formatUnit(value, languageTag, unit) {
  return new Intl.NumberFormat(languageTag, {
    style: 'unit',
    unit,
    unitDisplay: 'long',
    maximumFractionDigits: 2
  }).format(value);
}

function clearElement(element) {
  if (typeof element.replaceChildren === 'function') {
    element.replaceChildren();
    return;
  }
  element.textContent = '';
}

function appendTextElement(documentRoot, parent, tagName, className, text) {
  const element = documentRoot.createElement(tagName);
  element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function appendLabeledText(documentRoot, parent, className, label, value) {
  return appendTextElement(documentRoot, parent, 'p', className, `${label}: ${value}`);
}

export function renderLocus(documentRoot, presentationContext, locationContext) {
  const location = locationContext.currentLocation;
  requireElement(documentRoot, '[data-region-name]').textContent = locationContext.regionName;
  requireElement(documentRoot, '[data-region-description]').textContent = locationContext.regionDescription;
  requireElement(documentRoot, '[data-location-name]').textContent = location.name;
  requireElement(documentRoot, '[data-location-description]').textContent = location.description;
  requireElement(documentRoot, '[data-location-elevation]').textContent = formatUnit(
    location.elevationMeters,
    presentationContext.languageTag,
    'meter'
  );
}

export function renderRutas(documentRoot, presentationContext, locationContext) {
  const origin = locationContext.currentLocation;
  requireElement(documentRoot, '[data-route-origin]').textContent = origin.name;
  const routeList = requireElement(documentRoot, '[data-route-list]');
  const emptyState = requireElement(documentRoot, '[data-route-empty]');
  clearElement(routeList);
  const routes = locationContext.getRoutesFrom(origin.id);
  emptyState.textContent = presentationContext.message('status.noAvailableRoutes');
  emptyState.hidden = routes.length !== 0;

  for (const route of routes) {
    const destination = locationContext.getDestination(route, origin.id);
    const card = documentRoot.createElement('article');
    card.className = 'route-card';
    appendTextElement(documentRoot, card, 'h3', 'route-name', route.name);
    appendLabeledText(
      documentRoot,
      card,
      'route-destination',
      presentationContext.message('label.destination'),
      destination.name
    );
    appendTextElement(documentRoot, card, 'p', 'route-description', destination.description);
    appendLabeledText(
      documentRoot,
      card,
      'route-metadata',
      presentationContext.message('label.walkingTime'),
      formatUnit(route.walkingTime, presentationContext.languageTag, 'minute')
    );
    appendLabeledText(
      documentRoot,
      card,
      'route-metadata',
      presentationContext.message('label.elevationChange'),
      formatUnit(route.elevationChangeMeters, presentationContext.languageTag, 'meter')
    );
    routeList.append(card);
  }
}

export function renderLocationPage(pageId, documentRoot, presentationContext, locationContext) {
  if (pageId === 'page-07') {
    renderLocus(documentRoot, presentationContext, locationContext);
    return;
  }
  if (pageId === 'page-08') {
    renderRutas(documentRoot, presentationContext, locationContext);
    return;
  }
  throw new Error(`Unsupported location page ID: ${pageId}`);
}
