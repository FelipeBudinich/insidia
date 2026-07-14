function requireElement(documentRoot, selector) {
  const element = documentRoot.querySelector(selector);
  if (!element) throw new Error(`Missing location page element: ${selector}`);
  return element;
}

export function formatMeters(value) {
  return `${value} ${value === 1 ? 'metro' : 'metros'}`;
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
  requireElement(documentRoot, '[data-region-name]').textContent = locationContext.currentRegionName;
  requireElement(documentRoot, '[data-region-description]').textContent = locationContext.currentRegionDescription;
  requireElement(documentRoot, '[data-location-name]').textContent = location.name;
  requireElement(documentRoot, '[data-location-description]').textContent = location.description;
  requireElement(documentRoot, '[data-location-elevation]').textContent = formatMeters(location.elevationMeters);
}

function renderLocalRoutes(documentRoot, presentationContext, locationContext) {
  const origin = locationContext.currentLocation;
  requireElement(documentRoot, '[data-route-origin]').textContent = origin.name;
  const routeList = requireElement(documentRoot, '[data-local-route-list]');
  const emptyState = requireElement(documentRoot, '[data-local-route-empty]');
  clearElement(routeList);
  const routes = locationContext.getRoutesFrom(locationContext.currentRegionId, origin.id);
  emptyState.textContent = presentationContext.message('status.noAvailableLocalRoutes');
  emptyState.hidden = routes.length !== 0;

  for (const route of routes) {
    const destination = locationContext.getDestination(locationContext.currentRegionId, route, origin.id);
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
      presentationContext.message('label.travelTime'),
      presentationContext.format('route.fictionalMinutes', { value: route.travelTime })
    );
    appendLabeledText(
      documentRoot,
      card,
      'route-metadata',
      presentationContext.message('label.elevationChange'),
      formatMeters(route.elevationChangeMeters)
    );
    routeList.append(card);
  }
}

function renderInterRegionRoutes(documentRoot, presentationContext, locationContext) {
  const routeList = requireElement(documentRoot, '[data-inter-region-route-list]');
  const emptyState = requireElement(documentRoot, '[data-inter-region-route-empty]');
  clearElement(routeList);
  const routes = locationContext.getInterRegionRoutesFrom(locationContext.currentRegionId);
  emptyState.textContent = presentationContext.message('status.noAvailableInterRegionRoutes');
  emptyState.hidden = routes.length !== 0;

  for (const route of routes) {
    const destination = locationContext.getInterRegionDestination(route, locationContext.currentRegionId);
    const exitPoint = locationContext.getInterRegionEndpoint(route, locationContext.currentRegionId);
    const entryPoint = locationContext.getInterRegionEndpoint(route, destination.id);
    const card = documentRoot.createElement('article');
    card.className = 'route-card inter-region-route-card';
    appendTextElement(documentRoot, card, 'h3', 'route-name', route.routeName);
    appendLabeledText(
      documentRoot,
      card,
      'route-destination',
      presentationContext.message('label.destinationRegion'),
      destination.regionName
    );
    appendLabeledText(
      documentRoot,
      card,
      'route-metadata',
      presentationContext.message('label.exitPoint'),
      presentationContext.format('route.directionalPoint', {
        locationName: exitPoint.location.name,
        direction: exitPoint.direction
      })
    );
    appendLabeledText(
      documentRoot,
      card,
      'route-metadata',
      presentationContext.message('label.entryPoint'),
      presentationContext.format('route.directionalPoint', {
        locationName: entryPoint.location.name,
        direction: entryPoint.direction
      })
    );
    appendLabeledText(
      documentRoot,
      card,
      'route-metadata',
      presentationContext.message('label.travelTime'),
      presentationContext.format('route.fictionalMinutes', { value: route.travelTime })
    );
    routeList.append(card);
  }
}

export function renderRutas(documentRoot, presentationContext, locationContext) {
  renderLocalRoutes(documentRoot, presentationContext, locationContext);
  renderInterRegionRoutes(documentRoot, presentationContext, locationContext);
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
