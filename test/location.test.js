import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { bootstrapStaticPage as bootstrapCommonStaticPage } from '../public/app-bootstrap.js';
import { bootstrapStaticPage as bootstrapLocationPage } from '../public/location-bootstrap.js';
import { renderLocus, renderRutas } from '../public/location-renderers.js';
import { INITIAL_LOCATION_STATE } from '../public/location-state.js';
import { createLocationContext } from '../public/location.js';
import { validateLocale } from '../public/locale-loader.js';
import { validateNomenclature } from '../public/nomenclature-loader.js';
import { createPresentationContext } from '../public/nomenclature.js';
import {
  REGION_PATH,
  REGION_SCHEMA_VERSION,
  loadRegion,
  validateRegion
} from '../public/region-loader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDirectory = path.join(root, 'public');
const regionPath = path.join(publicDirectory, 'regions', 'sheol.json');
const nomenclaturePath = path.join(publicDirectory, 'config', 'nomenclature.json');
const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

async function productionRegion() {
  return readJson(regionPath);
}

async function regionResult() {
  return {
    schemaVersion: REGION_SCHEMA_VERSION,
    region: validateRegion(await productionRegion())
  };
}

async function presentationContext(localeId = 'en') {
  const [nomenclatureSource, localeSource] = await Promise.all([
    readJson(nomenclaturePath),
    readJson(path.join(publicDirectory, 'locales', `${localeId}.json`))
  ]);
  const nomenclature = validateNomenclature(nomenclatureSource);
  const locale = validateLocale(localeSource);
  return createPresentationContext({
    nomenclatureResult: { schemaVersion: nomenclature.schemaVersion, nomenclature },
    localeResult: {
      requestedLocaleId: localeId,
      resolvedLocaleId: localeId,
      schemaVersion: locale.schemaVersion,
      locale
    }
  });
}

function response(value, url = undefined) {
  return {
    ok: true,
    ...(url ? { url } : {}),
    json: async () => structuredClone(value)
  };
}

function makeElement(dataset = {}) {
  return {
    dataset,
    attributes: {},
    children: [],
    className: '',
    hidden: false,
    textContent: '',
    setAttribute(name, value) { this.attributes[name] = String(value); },
    removeAttribute(name) { delete this.attributes[name]; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; }
  };
}

function makeBootstrapDocument(pageId) {
  const links = Array.from({ length: 9 }, (_, index) => makeElement({
    pageId: `page-${String(index + 1).padStart(2, '0')}`
  }));
  const categories = [
    makeElement({
      navigationGroupId: 'navigation-group-02',
      navigationTargetPageId: 'page-04',
      navigationCategoryPages: 'page-04 page-05 page-06'
    }),
    makeElement({
      navigationGroupId: 'navigation-group-01',
      navigationTargetPageId: 'page-01',
      navigationCategoryPages: 'page-01 page-02 page-03'
    }),
    makeElement({
      navigationGroupId: 'navigation-group-03',
      navigationTargetPageId: 'page-07',
      navigationCategoryPages: 'page-07 page-08 page-09'
    })
  ];
  const submenus = [
    makeElement({ navigationSubmenuPages: 'page-04 page-05 page-06' }),
    makeElement({ navigationSubmenuPages: 'page-01 page-02 page-03' }),
    makeElement({ navigationSubmenuPages: 'page-07 page-08 page-09' })
  ];
  const pageName = makeElement();
  const applicationName = makeElement();
  const version = makeElement();
  const epoch = makeElement();
  const meta = makeElement();
  const nav = makeElement();
  const messageKeys = pageId === 'page-07'
    ? ['label.region', 'label.currentLocation', 'label.elevation']
    : pageId === 'page-08'
      ? ['label.routesFrom']
      : [];
  const messages = messageKeys.map((messageKey) => makeElement({ messageKey }));
  const specific = new Map();
  if (pageId === 'page-07') {
    for (const selector of [
      '[data-region-name]', '[data-region-description]', '[data-location-name]',
      '[data-location-description]', '[data-location-elevation]'
    ]) specific.set(selector, makeElement());
  }
  if (pageId === 'page-08') {
    specific.set('[data-route-origin]', makeElement());
    specific.set('[data-route-list]', makeElement());
    const empty = makeElement();
    empty.hidden = true;
    specific.set('[data-route-empty]', empty);
  }
  const selectorLists = new Map([
    ['[data-page-id]', links],
    ['[data-navigation-group-id]', categories],
    ['[data-navigation-category-pages]', categories],
    ['[data-navigation-submenu-pages]', submenus],
    ['[data-page-name]', [pageName]],
    ['[data-page-section-id]', []],
    ['[data-message-key]', messages],
    ['[data-application-name]', [applicationName]],
    ['[data-version]', [version]],
    ['[data-epoch]', [epoch]]
  ]);
  const documentElement = makeElement();
  const body = makeElement();
  const documentRoot = {
    body,
    documentElement,
    title: '',
    createElement: () => makeElement(),
    querySelector(selector) {
      if (selector === 'meta[name="description"]') return meta;
      if (selector === '.primary-nav') return nav;
      return specific.get(selector) ?? null;
    },
    querySelectorAll(selector) { return selectorLists.get(selector) ?? []; }
  };
  return { documentRoot, messages, specific, version };
}

function rendererRoot(selectors) {
  const elements = new Map(selectors.map((selector) => [selector, makeElement()]));
  return {
    elements,
    createElement: () => makeElement(),
    querySelector: (selector) => elements.get(selector) ?? null
  };
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(filePath) : [filePath];
  }));
  return nested.flat();
}

test('production Sheol configuration preserves all authored locations and routes', async () => {
  const region = validateRegion(await productionRegion());
  assert.equal(REGION_SCHEMA_VERSION, 1);
  assert.equal(region.regionName, 'Sheol');
  assert.equal(region.description, 'Le integre regno occultate sub le superficie.');
  assert.deepEqual(region.regions, []);
  assert.deepEqual(Object.entries(region.locations).map(([id, location]) => [
    id,
    location.name,
    location.description,
    location.latitude,
    location.longitude,
    location.elevationMeters
  ]), [
    ['bucca-de-sheol', 'Le Bucca de Sheol', 'Le entrata ceremonial principal ab le mundo del vivos.', 40.838737, 14.076167, 1],
    ['descenso-del-sibylla', 'Le Descenso del Sibylla', 'Le corridor ritual per le qual le cavernas natural deveni le architectura de Sheol.', 40.8479, 14.0532, 17],
    ['campo-del-ultime-pensamentos', 'Le Campo del Ultime Pensamentos', 'Un campo de battalia inundate ubi le mortos repete le ultime pensamento que illes portava al morte.', 40.84795, 14.056381, 22],
    ['cais-del-desiro', 'Le Cais del Desiro', 'Un chantier naval submergite ubi le desiro es discargate, inventariate e consumite.', 40.8291, 14.0952, -4],
    ['cortes-submergite', 'Le Cortes Submergite', 'Le palatios, thermas, jardines e tribunales submergite del mortos plen de desiro.', 40.817361, 14.070273, -9],
    ['halito-de-sheol', 'Le Halito de Sheol', 'Le fumarolas per le qual le regno interrate exhala in le mundo del vivos.', 40.827, 14.139, 98],
    ['costa-final', 'Le Costa Final', 'Le ultime ripa ante le mar nigre, marcate per turres de guarda, naufragios e currentes sin retorno.', 40.778259, 14.088936, 68]
  ]);
  assert.deepEqual(region.routes.map((route) => [
    route.name,
    route.between,
    route.walkingTime,
    route.elevationChangeMeters
  ]), [
    ['Le Sentiero del Ultime Pensamentos', ['campo-del-ultime-pensamentos', 'descenso-del-sibylla'], 10, 5],
    ['Le Via del Sibylla', ['descenso-del-sibylla', 'bucca-de-sheol'], 70, 16],
    ['Le Via del Desiro', ['bucca-de-sheol', 'cais-del-desiro'], 60, 5],
    ['Le Passage Submergite', ['bucca-de-sheol', 'cortes-submergite'], 100, 10],
    ['Le Cais del Ruinas', ['cais-del-desiro', 'cortes-submergite'], 75, 5],
    ['Le Via del Fumarolas', ['cais-del-desiro', 'halito-de-sheol'], 130, 102],
    ['Le Via del Mar Nigre', ['cortes-submergite', 'costa-final'], 150, 77],
    ['Le Sentiero del Ultime Ripa', ['halito-de-sheol', 'costa-final'], 240, 30]
  ]);
  assert.equal(Object.keys(region.locations).length, 7);
  assert.equal(region.routes.length, 8);
  assert.ok(Object.hasOwn(region.locations, INITIAL_LOCATION_STATE.locationId));
  assert.deepEqual(INITIAL_LOCATION_STATE, {
    regionName: 'Sheol',
    locationId: 'campo-del-ultime-pensamentos'
  });
});

test('region validation enforces exact location and route shapes', async () => {
  const valid = await productionRegion();
  for (const mutate of [
    (region) => { region.extra = true; },
    (region) => { region.regions.push({ name: 'child' }); },
    (region) => { region.locations['bucca-de-sheol'].extra = true; },
    (region) => { region.locations['BUCCA'] = region.locations['bucca-de-sheol']; delete region.locations['bucca-de-sheol']; },
    (region) => { region.routes[0].extra = true; },
    (region) => { region.locations['bucca-de-sheol'].latitude = 90.01; },
    (region) => { region.locations['bucca-de-sheol'].longitude = -180.01; },
    (region) => { region.locations['bucca-de-sheol'].elevationMeters = Infinity; },
    (region) => { region.locations['bucca-de-sheol'].elevationMeters = '1'; },
    (region) => { region.routes[0].between[1] = 'missing-location'; },
    (region) => { region.routes[0].between[1] = region.routes[0].between[0]; },
    (region) => { region.routes.push({ ...structuredClone(region.routes[0]), between: [...region.routes[0].between].reverse() }); },
    (region) => { region.routes[0].walkingTime = 0; },
    (region) => { region.routes[0].walkingTime = 1.5; },
    (region) => { region.routes[0].walkingTime = Number.MAX_SAFE_INTEGER + 1; },
    (region) => { region.routes[0].elevationChangeMeters = -1; },
    (region) => { region.routes[0].elevationChangeMeters = Infinity; },
    (region) => { region.routes = region.routes.filter(({ between }) => !between.includes('costa-final')); }
  ]) {
    const invalid = structuredClone(valid);
    mutate(invalid);
    assert.throws(() => validateRegion(invalid));
  }

  const negativeElevation = structuredClone(valid);
  negativeElevation.locations['bucca-de-sheol'].elevationMeters = -250.5;
  assert.equal(validateRegion(negativeElevation).locations['bucca-de-sheol'].elevationMeters, -250.5);

  const authoredChange = structuredClone(valid);
  authoredChange.routes[0].elevationChangeMeters = 0.5;
  assert.equal(validateRegion(authoredChange).routes[0].elevationChangeMeters, 0.5);
});

test('region loader uses one fixed no-cache same-origin request', async () => {
  const region = await productionRegion();
  for (const query of ['', '?region=other', '?path=https://evil.test/x', '?locale=es']) {
    const requests = [];
    const result = await loadRegion({
      baseUrl: `https://app.test/locus.html${query}`,
      fetchFn: async (url, options) => {
        requests.push({ url, options });
        return response(region, 'https://app.test/regions/sheol.json');
      }
    });
    assert.equal(REGION_PATH, '/regions/sheol.json');
    assert.deepEqual(requests, [{
      url: 'https://app.test/regions/sheol.json',
      options: { cache: 'no-cache' }
    }]);
    assert.equal(result.schemaVersion, 1);
    assert.equal(result.region.regionName, 'Sheol');
  }
});

test('region loader rejects unsupported sources, cross-origin responses, missing, and malformed data', async () => {
  const region = await productionRegion();
  for (const unsupported of [
    { path: '/regions/other.json' },
    { url: 'https://evil.test/region.json' },
    { regionId: 'other' },
    { requestedId: 'other' }
  ]) {
    await assert.rejects(() => loadRegion({
      baseUrl: 'https://app.test/locus.html',
      fetchFn: async () => response(region),
      ...unsupported
    }), /Unsupported region loader option/);
  }
  await assert.rejects(() => loadRegion({
    baseUrl: 'file:///tmp/locus.html',
    fetchFn: async () => response(region)
  }), /HTTP or HTTPS/);
  await assert.rejects(() => loadRegion({
    baseUrl: 'https://app.test/locus.html',
    fetchFn: async () => response(region, 'https://evil.test/regions/sheol.json')
  }), /same-origin/);
  await assert.rejects(() => loadRegion({
    baseUrl: 'https://app.test/locus.html',
    fetchFn: async () => ({ ok: false, json: async () => null })
  }), /Unable to load region/);
  await assert.rejects(() => loadRegion({
    baseUrl: 'https://app.test/locus.html',
    fetchFn: async () => ({ ok: true, json: async () => { throw new SyntaxError('bad JSON'); } })
  }), /Malformed JSON/);
  const invalid = structuredClone(region);
  invalid.routes[0].between[0] = 'missing';
  await assert.rejects(() => loadRegion({
    baseUrl: 'https://app.test/locus.html',
    fetchFn: async () => response(invalid)
  }));
});

test('location context clones and deeply freezes region, locations, routes, and state', async () => {
  const source = await productionRegion();
  const before = structuredClone(source);
  const context = createLocationContext({
    regionResult: { schemaVersion: 1, region: validateRegion(source) }
  });
  assert.deepEqual(source, before);
  assert.notEqual(context.region, source);
  assert.notEqual(context.region.locations['bucca-de-sheol'], source.locations['bucca-de-sheol']);
  assert.notEqual(context.region.routes[0], source.routes[0]);
  assert.notEqual(context.region.routes[0].between, source.routes[0].between);
  assert.notEqual(context.locationState, INITIAL_LOCATION_STATE);
  for (const value of [
    context, context.region, context.region.regions, context.region.locations,
    context.region.routes, context.region.routes[0], context.region.routes[0].between,
    context.locationState, context.currentLocation, context.getLocations(), context.getRoutes(),
    ...context.getLocations(), ...context.getRoutes()
  ]) assert.equal(Object.isFrozen(value), true);
  assert.equal(context.getLocations()[0].id, 'bucca-de-sheol');
  assert.equal(Object.hasOwn(source.locations['bucca-de-sheol'], 'id'), false);
  assert.throws(() => { context.currentLocation.name = 'Changed'; }, TypeError);
  assert.throws(() => { context.getRoutes()[0].between[0] = 'changed'; }, TypeError);
  assert.equal(Object.values(context).some((value) => value instanceof Map || value instanceof Set), false);
});

test('location context preserves order and resolves symmetric direct routes and destinations', async () => {
  const source = await productionRegion();
  const context = createLocationContext({
    regionResult: { schemaVersion: 1, region: validateRegion(source) }
  });
  assert.equal(context.regionName, 'Sheol');
  assert.equal(context.currentLocationId, 'campo-del-ultime-pensamentos');
  assert.equal(context.currentLocation.name, 'Le Campo del Ultime Pensamentos');
  assert.deepEqual(context.getLocations().map(({ id }) => id), Object.keys(source.locations));
  assert.deepEqual(context.getRoutes().map(({ name }) => name), source.routes.map(({ name }) => name));
  for (const route of context.getRoutes()) {
    const [firstId, secondId] = route.between;
    assert.ok(context.getRoutesFrom(firstId).includes(route));
    assert.ok(context.getRoutesFrom(secondId).includes(route));
    assert.equal(context.getDestination(route, firstId).id, secondId);
    assert.equal(context.getDestination(route, secondId).id, firstId);
  }
  const currentRoutes = context.getRoutesFrom(context.currentLocationId);
  assert.equal(currentRoutes.length, 1);
  assert.equal(currentRoutes[0].name, 'Le Sentiero del Ultime Pensamentos');
  assert.equal(context.getDestination(currentRoutes[0], context.currentLocationId).id, 'descenso-del-sibylla');
  assert.throws(() => context.getLocation('missing'), /Unknown location/);
  assert.throws(() => context.getRoutesFrom('missing'), /Unknown location/);
  assert.throws(() => context.getDestination(currentRoutes[0], 'missing'), /Unknown location/);
  assert.throws(() => context.getDestination({ ...currentRoutes[0] }, context.currentLocationId), /Unknown route/);
  assert.throws(() => createLocationContext({
    regionResult: { schemaVersion: 1, region: source },
    locationState: { regionName: 'Other', locationId: context.currentLocationId }
  }), /Unknown current region/);
});

test('Locus and Rutas start locale, nomenclature, and region requests concurrently without timers', async (t) => {
  const [nomenclature, region, english, spanish] = await Promise.all([
    readJson(nomenclaturePath),
    productionRegion(),
    readJson(path.join(publicDirectory, 'locales', 'en.json')),
    readJson(path.join(publicDirectory, 'locales', 'es.json'))
  ]);
  const values = new Map([
    ['/config/nomenclature.json', nomenclature],
    ['/regions/sheol.json', region],
    ['/locales/en.json', english],
    ['/locales/es.json', spanish]
  ]);
  const timeoutMock = t.mock.method(globalThis, 'setTimeout', () => assert.fail('location pages must not schedule timers'));

  for (const [pageId, pathname, localeId] of [
    ['page-07', '/locus.html', 'en'],
    ['page-08', '/rutas.html', 'es']
  ]) {
    const requests = [];
    const pending = new Map();
    const { documentRoot, specific } = makeBootstrapDocument(pageId);
    const fetchFn = (url, options) => {
      assert.equal(options.cache, 'no-cache');
      const requestPath = new URL(url).pathname;
      requests.push(requestPath);
      return new Promise((resolve) => pending.set(requestPath, resolve));
    };
    const bootstrapPromise = bootstrapLocationPage(pageId, {
      documentRoot,
      locationLike: { href: `https://app.test${pathname}?locale=${localeId}` },
      fetchFn
    });
    assert.deepEqual(requests.sort(), [
      `/locales/${localeId}.json`,
      '/config/nomenclature.json',
      '/regions/sheol.json'
    ].sort());
    assert.equal(requests.length, 3);
    for (const requestPath of requests) {
      pending.get(requestPath)(response(values.get(requestPath), `https://app.test${requestPath}`));
    }
    const context = await bootstrapPromise;
    assert.equal(context.currentLocationId, INITIAL_LOCATION_STATE.locationId);
    assert.equal(documentRoot.documentElement.attributes['aria-busy'], 'false');
    if (pageId === 'page-07') {
      assert.equal(specific.get('[data-region-name]').textContent, 'Sheol');
    } else {
      assert.equal(specific.get('[data-route-list]').children.length, 1);
    }
  }
  assert.equal(timeoutMock.mock.callCount(), 0);
});

test('ordinary static pages still load only locale and nomenclature resources', async () => {
  const [nomenclature, english] = await Promise.all([
    readJson(nomenclaturePath),
    readJson(path.join(publicDirectory, 'locales', 'en.json'))
  ]);
  const values = new Map([
    ['/config/nomenclature.json', nomenclature],
    ['/locales/en.json', english]
  ]);
  const requests = [];
  const pending = new Map();
  const { documentRoot } = makeBootstrapDocument('page-09');
  const promise = bootstrapCommonStaticPage('page-09', {
    documentRoot,
    locationLike: { href: 'https://app.test/explorar.html?locale=en' },
    fetchFn: (url, options) => {
      assert.equal(options.cache, 'no-cache');
      const requestPath = new URL(url).pathname;
      requests.push(requestPath);
      return new Promise((resolve) => pending.set(requestPath, resolve));
    }
  });
  assert.deepEqual(requests.sort(), ['/locales/en.json', '/config/nomenclature.json'].sort());
  assert.equal(requests.includes('/regions/sheol.json'), false);
  for (const requestPath of requests) {
    pending.get(requestPath)(response(values.get(requestPath), `https://app.test${requestPath}`));
  }
  const context = await promise;
  assert.equal(context.applicationDisplayName, 'Insidia');
});

test('location configuration failures use the resolved localized error and never render partial UI', async (t) => {
  t.mock.method(console, 'error', () => {});
  const [nomenclature, spanish] = await Promise.all([
    readJson(nomenclaturePath),
    readJson(path.join(publicDirectory, 'locales', 'es.json'))
  ]);
  const { documentRoot, specific } = makeBootstrapDocument('page-07');
  const result = await bootstrapLocationPage('page-07', {
    documentRoot,
    locationLike: { href: 'https://app.test/locus.html?locale=es' },
    fetchFn: async (url) => {
      const pathname = new URL(url).pathname;
      if (pathname === '/regions/sheol.json') return { ok: false, json: async () => null };
      return response(pathname === '/locales/es.json' ? spanish : nomenclature, `https://app.test${pathname}`);
    }
  });
  assert.equal(result, null);
  assert.equal(documentRoot.documentElement.lang, 'es');
  assert.equal(documentRoot.body.children[0].attributes.role, 'alert');
  assert.equal(
    documentRoot.body.children[0].children[0].textContent,
    'No se pudo cargar la configuración de la aplicación o del idioma.'
  );
  assert.equal(specific.get('[data-region-name]').textContent, '');
});

test('Locus renders configured Sheol data without coordinates in both locales', async () => {
  const locationContext = createLocationContext({ regionResult: await regionResult() });
  const selectors = [
    '[data-region-name]', '[data-region-description]', '[data-location-name]',
    '[data-location-description]', '[data-location-elevation]'
  ];
  const visibleByLocale = {};
  for (const localeId of ['en', 'es']) {
    const rootElement = rendererRoot(selectors);
    renderLocus(rootElement, await presentationContext(localeId), locationContext);
    visibleByLocale[localeId] = Object.fromEntries(
      [...rootElement.elements].map(([selector, element]) => [selector, element.textContent])
    );
  }
  for (const localeId of ['en', 'es']) {
    assert.equal(visibleByLocale[localeId]['[data-region-name]'], 'Sheol');
    assert.equal(visibleByLocale[localeId]['[data-region-description]'], 'Le integre regno occultate sub le superficie.');
    assert.equal(visibleByLocale[localeId]['[data-location-name]'], 'Le Campo del Ultime Pensamentos');
    assert.equal(
      visibleByLocale[localeId]['[data-location-description]'],
      'Un campo de battalia inundate ubi le mortos repete le ultime pensamento que illes portava al morte.'
    );
  }
  assert.equal(visibleByLocale.en['[data-location-elevation]'], '22 meters');
  assert.equal(visibleByLocale.es['[data-location-elevation]'], '22 metros');
  const visibleText = JSON.stringify(visibleByLocale);
  assert.doesNotMatch(visibleText, /40\.84795|14\.056381/);
});

test('Rutas renders only the direct Sibyl route with localized generic labels', async () => {
  const locationContext = createLocationContext({ regionResult: await regionResult() });
  const snapshots = {};
  for (const localeId of ['en', 'es']) {
    const rootElement = rendererRoot(['[data-route-origin]', '[data-route-list]', '[data-route-empty]']);
    renderRutas(rootElement, await presentationContext(localeId), locationContext);
    const cards = rootElement.elements.get('[data-route-list]').children;
    assert.equal(cards.length, 1);
    assert.equal(rootElement.elements.get('[data-route-empty]').hidden, true);
    snapshots[localeId] = {
      origin: rootElement.elements.get('[data-route-origin]').textContent,
      card: cards[0].children.map(({ textContent }) => textContent)
    };
  }
  assert.equal(snapshots.en.origin, 'Le Campo del Ultime Pensamentos');
  assert.equal(snapshots.es.origin, snapshots.en.origin);
  assert.deepEqual(snapshots.en.card, [
    'Le Sentiero del Ultime Pensamentos',
    'Destination: Le Descenso del Sibylla',
    'Le corridor ritual per le qual le cavernas natural deveni le architectura de Sheol.',
    'Walking time: 10 minutes',
    'Elevation change: 5 meters'
  ]);
  assert.deepEqual(snapshots.es.card, [
    'Le Sentiero del Ultime Pensamentos',
    'Destino: Le Descenso del Sibylla',
    'Le corridor ritual per le qual le cavernas natural deveni le architectura de Sheol.',
    'Tiempo a pie: 10 minutos',
    'Cambio de elevación: 5 metros'
  ]);
  assert.doesNotMatch(JSON.stringify(snapshots), /Le Via del Sibylla|Le Bucca de Sheol|40\.8479|14\.0532/);
});

test('location production sources remain read-only and free of prohibited integrations', async () => {
  const locationFiles = [
    'location-bootstrap.js', 'location-renderers.js', 'location-state.js',
    'location.js', 'region-loader.js', 'locus-page.js', 'rutas-page.js',
    'locus.html', 'rutas.html'
  ];
  const locationSource = (await Promise.all(locationFiles.map((file) => (
    readFile(path.join(publicDirectory, file), 'utf8')
  )))).join('\n');
  assert.doesNotMatch(locationSource, /navigator\.geolocation|localStorage|document\.cookie|cookieStore|<iframe|maps\.google|mapbox|leaflet/i);
  assert.doesNotMatch(locationSource, /shortest.?path|route.?planning|arrival.?time|countdown|discovery.?state/i);
  assert.doesNotMatch(locationSource, /[?&]travel=|searchParams\.get\(['"]travel|data-travel|travel-button/i);
  assert.doesNotMatch(locationSource, /startLiveState|setTimeout|setInterval/);
  assert.doesNotMatch(await readFile(path.join(publicDirectory, 'location-renderers.js'), 'utf8'), /innerHTML/);
  for (const htmlFile of ['locus.html', 'rutas.html']) {
    const html = await readFile(path.join(publicDirectory, htmlFile), 'utf8');
    assert.doesNotMatch(html, /<button|<form|<iframe|latitude|longitude|coordinates/i);
  }

  const region = await productionRegion();
  const properNouns = [
    region.regionName,
    region.description,
    ...Object.values(region.locations).flatMap(({ name, description }) => [name, description]),
    ...region.routes.map(({ name }) => name)
  ];
  const productionFiles = (await listFiles(publicDirectory)).filter((file) => (
    !file.endsWith(path.join('regions', 'sheol.json'))
    && !file.endsWith('location-state.js')
  ));
  const otherProductionSource = (await Promise.all(productionFiles.map((file) => readFile(file, 'utf8')))).join('\n');
  for (const properNoun of properNouns) {
    assert.equal(otherProductionSource.includes(properNoun), false, properNoun);
  }
  const stateSource = await readFile(path.join(publicDirectory, 'location-state.js'), 'utf8');
  assert.match(stateSource, /regionName: 'Sheol'/);
  assert.match(stateSource, /locationId: 'campo-del-ultime-pensamentos'/);
});
