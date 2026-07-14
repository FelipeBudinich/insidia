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
  CARDINAL_DIRECTIONS,
  WORLD_PATH,
  WORLD_SCHEMA_VERSION,
  loadWorld,
  validateWorld
} from '../public/world-loader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDirectory = path.join(root, 'public');
const worldPath = path.join(publicDirectory, 'regions', 'world.json');
const nomenclaturePath = path.join(publicDirectory, 'config', 'nomenclature.json');
const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));
const LEGACY_LOCAL_DURATION_KEY = ['walking', 'Time'].join('');
const LEGACY_INTER_DURATION_KEY = ['walk', 'Time'].join('');

async function productionWorld() {
  return readJson(worldPath);
}

async function worldResult() {
  return {
    schemaVersion: WORLD_SCHEMA_VERSION,
    world: validateWorld(await productionWorld())
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
      ? ['label.localRoutes', 'label.routesFrom', 'label.interRegionalRoutes']
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
    for (const kind of ['local-route', 'inter-region-route']) {
      specific.set(`[data-${kind}-list]`, makeElement());
      const empty = makeElement();
      empty.hidden = true;
      specific.set(`[data-${kind}-empty]`, empty);
    }
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
  return { documentRoot, specific };
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

function locationRows(region) {
  return Object.entries(region.locations).map(([id, location]) => [
    id,
    location.name,
    location.description,
    location.latitude,
    location.longitude,
    location.elevationMeters
  ]);
}

function routeRows(region) {
  return region.routes.map((route) => [
    route.name,
    route.between,
    route.travelTime,
    route.elevationChangeMeters
  ]);
}

test('production world preserves the exact three-region data and inter-region graph', async () => {
  const world = validateWorld(await productionWorld());
  assert.equal(WORLD_SCHEMA_VERSION, 3);
  assert.deepEqual(CARDINAL_DIRECTIONS, ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
  assert.equal(Object.isFrozen(CARDINAL_DIRECTIONS), true);
  assert.deepEqual(Object.keys(world), ['regions', 'interRegionRoutes']);
  assert.deepEqual(Object.keys(world.regions), ['sheol', 'mercato-nigre', 'observatorio-del-prophetias']);
  for (const region of Object.values(world.regions)) {
    assert.deepEqual(Object.keys(region), ['regionName', 'description', 'entryExitPoints', 'locations', 'routes']);
    assert.deepEqual(Object.keys(region.entryExitPoints), CARDINAL_DIRECTIONS);
    for (const location of Object.values(region.locations)) {
      assert.deepEqual(Object.keys(location), ['name', 'description', 'latitude', 'longitude', 'elevationMeters']);
    }
    for (const route of region.routes) {
      assert.deepEqual(Object.keys(route), ['name', 'between', 'travelTime', 'elevationChangeMeters']);
    }
  }

  const sheol = world.regions.sheol;
  assert.equal(sheol.regionName, 'Sheol');
  assert.equal(sheol.description, 'Le integre regno occultate sub le superficie.');
  assert.equal(Object.keys(sheol.locations).length, 7);
  assert.equal(sheol.routes.length, 8);
  assert.deepEqual(sheol.entryExitPoints, {
    N: 'campo-del-ultime-pensamentos',
    NE: 'halito-de-sheol',
    E: 'halito-de-sheol',
    SE: 'costa-final',
    S: 'costa-final',
    SW: 'costa-final',
    W: 'descenso-del-sibylla',
    NW: 'descenso-del-sibylla'
  });
  assert.equal(Object.values(sheol.entryExitPoints).includes('bucca-de-sheol'), false);
  assert.deepEqual(routeRows(sheol)[0], [
    'Le Sentiero del Ultime Pensamentos',
    ['campo-del-ultime-pensamentos', 'descenso-del-sibylla'],
    10,
    5
  ]);

  const mercato = world.regions['mercato-nigre'];
  assert.equal(mercato.regionName, 'Mercato Nigre');
  assert.equal(mercato.description, 'Un mercato neutral ubi objectos prohibite, reliquias e mercantias damnate es vendite per auction al offerente le plus alte.');
  assert.deepEqual(Object.values(mercato.entryExitPoints), CARDINAL_DIRECTIONS.map(() => 'porta-del-mercatores'));
  assert.deepEqual(locationRows(mercato), [
    ['arena-del-auction', 'Le Arena del Auction', 'Le amphitheatro central ubi cata lotte es exponite e vendite al offerente le plus alte.', 41.482884, 13.823593, 67],
    ['crypta-del-lottes', 'Le Crypta del Lottes', 'Un camera subterranee secur ubi objectos unic, periculose o contestate attende le auction.', 41.48258, 13.82207, 96],
    ['tribunal-del-valor', 'Le Tribunal del Valor', 'Le sala ubi expertos examina, pesa e taxa cata objecto ante que illo entra in auction.', 41.48327, 13.82096, 116],
    ['porta-del-mercatores', 'Le Porta del Mercatores', 'Le entrata de caravanas ubi mercantias es registrate, sigillate e admittite al mercato.', 41.48337, 13.82315, 86],
    ['rocca-del-garantia', 'Le Rocca del Garantia', 'Le fortressa que custodia depositos e contractos e impone le neutralitate del mercato.', 41.49512, 13.82467, 175]
  ]);
  assert.deepEqual(routeRows(mercato), [
    ['Le Passage del Lottes', ['arena-del-auction', 'crypta-del-lottes'], 10, 29],
    ['Le Scala del Valor', ['crypta-del-lottes', 'tribunal-del-valor'], 10, 20],
    ['Le Via del Mercatores', ['tribunal-del-valor', 'porta-del-mercatores'], 10, 30],
    ['Le Arcadas del Auction', ['arena-del-auction', 'porta-del-mercatores'], 5, 19],
    ['Le Ascenso del Garantia', ['porta-del-mercatores', 'rocca-del-garantia'], 45, 89]
  ]);

  const observatorio = world.regions['observatorio-del-prophetias'];
  assert.equal(observatorio.regionName, 'Observatorio del Prophetias');
  assert.equal(observatorio.description, 'Un complexo astronomic ubi demones studia le stellas, le planetas e le constellationes pro deducer prophetias del futuro.');
  assert.deepEqual(observatorio.entryExitPoints, {
    N: 'oculo-del-zenith',
    NE: 'porta-del-celo',
    E: 'porta-del-celo',
    SE: 'turre-del-polo',
    S: 'turre-del-polo',
    SW: 'circulo-del-horizonte',
    W: 'oculo-del-zenith',
    NW: 'oculo-del-zenith'
  });
  assert.deepEqual(locationRows(observatorio), [
    ['turre-del-polo', 'Le Turre del Polo', 'Le observatorio inferior, ubi le rotation del celo es mesurate per aperturas aliniate con le nord celestial.', 42.328967, 13.688944, 1464],
    ['circulo-del-horizonte', 'Le Circulo del Horizonte', 'Un templo octagonal ubi aperturas de petra marca le orto e le occaso del astros, le solstitios e le limites del constellationes.', 42.329808, 13.687514, 1423],
    ['porta-del-celo', 'Le Porta del Celo', 'Le station fortificate ubi viatores prepara provisiones, cartas celestial e instrumentos ante le ascenso al planitie alte.', 42.364519, 13.725791, 1346],
    ['speculo-del-firmamento', 'Le Speculo del Firmamento', 'Un bassino quiete ubi le celo es legite in reflection quando le vento cessa.', 42.427526, 13.624424, 1660],
    ['observatorio-superior', 'Le Observatorio Superior', 'Le station principal de observation, ubi conjunctiones, eclipses, cometas e apparitiones stellar es registrate.', 42.444158, 13.557876, 2129],
    ['oculo-del-zenith', 'Le Oculo del Zenith', 'Le puncto le plus alte del complexo, usate pro observationes que require un horizonte libere e un celo sin obstruction.', 42.448121, 13.552037, 2388]
  ]);
  assert.deepEqual(routeRows(observatorio), [
    ['Le Passo del Octagono', ['circulo-del-horizonte', 'turre-del-polo'], 10, 41],
    ['Le Cammino del Cartas Celestial', ['turre-del-polo', 'porta-del-celo'], 200, 118],
    ['Le Ascenso del Speculo', ['porta-del-celo', 'speculo-del-firmamento'], 300, 314],
    ['Le Via del Stella Matutin', ['speculo-del-firmamento', 'observatorio-superior'], 180, 469],
    ['Le Scala del Zenith', ['observatorio-superior', 'oculo-del-zenith'], 50, 259]
  ]);

  assert.deepEqual(world.interRegionRoutes, [
    {
      routeName: 'Le Via del Obolo Nigre',
      between: ['sheol', 'mercato-nigre'],
      directions: { sheol: 'N', 'mercato-nigre': 'S' },
      travelTime: 1800
    },
    {
      routeName: 'Le Via del Signos Celestial',
      between: ['mercato-nigre', 'observatorio-del-prophetias'],
      directions: { 'mercato-nigre': 'N', 'observatorio-del-prophetias': 'S' },
      travelTime: 3000
    }
  ]);
  assert.equal(world.interRegionRoutes.some(({ between }) => (
    between.includes('sheol') && between.includes('observatorio-del-prophetias')
  )), false);
  assert.deepEqual(INITIAL_LOCATION_STATE, {
    regionId: 'sheol',
    locationId: 'bucca-de-sheol'
  });
});

test('world validation enforces strict generic world, region, location, and local-route rules', async () => {
  const valid = await productionWorld();
  for (const mutate of [
    (world) => { world.extra = true; },
    (world) => { world.regions = []; },
    (world) => { world.regions['Bad ID'] = world.regions.sheol; delete world.regions.sheol; },
    (world) => { world.regions.sheol.extra = true; },
    (world) => { world.regions.sheol.regionName = world.regions['mercato-nigre'].regionName; },
    (world) => { world.regions.sheol.locations = []; },
    (world) => { world.regions.sheol.locations['bucca-de-sheol'].extra = true; },
    (world) => { world.regions.sheol.locations.BAD = world.regions.sheol.locations['bucca-de-sheol']; },
    (world) => { world.regions.sheol.locations['bucca-de-sheol'].name = ''; },
    (world) => { world.regions.sheol.locations['bucca-de-sheol'].latitude = 90.01; },
    (world) => { world.regions.sheol.locations['bucca-de-sheol'].longitude = -180.01; },
    (world) => { world.regions.sheol.locations['bucca-de-sheol'].elevationMeters = Infinity; },
    (world) => { world.regions.sheol.entryExitPoints = []; },
    (world) => { delete world.regions.sheol.entryExitPoints.N; },
    (world) => { world.regions.sheol.entryExitPoints.NN = 'campo-del-ultime-pensamentos'; },
    (world) => { world.regions.sheol.entryExitPoints.ne = world.regions.sheol.entryExitPoints.NE; delete world.regions.sheol.entryExitPoints.NE; },
    (world) => { world.regions.sheol.entryExitPoints.N = 'missing-location'; },
    (world) => { world.regions.sheol.entryExitPoints.N = 'porta-del-mercatores'; },
    (world) => { world.regions.sheol.routes = {}; },
    (world) => { world.regions.sheol.routes[0].extra = true; },
    (world) => { world.regions.sheol.routes[0].between = ['bucca-de-sheol']; },
    (world) => { world.regions.sheol.routes[0].between[1] = 'missing'; },
    (world) => { world.regions.sheol.routes[0].between[1] = world.regions.sheol.routes[0].between[0]; },
    (world) => { world.regions.sheol.routes.push({ ...structuredClone(world.regions.sheol.routes[0]), between: [...world.regions.sheol.routes[0].between].reverse() }); },
    (world) => { world.regions.sheol.routes[0].travelTime = 0; },
    (world) => { world.regions.sheol.routes[0].travelTime = -1; },
    (world) => { world.regions.sheol.routes[0].travelTime = 1.5; },
    (world) => { world.regions.sheol.routes[0].travelTime = Number.MAX_SAFE_INTEGER + 1; },
    (world) => {
      const route = world.regions.sheol.routes[0];
      route[LEGACY_LOCAL_DURATION_KEY] = route.travelTime;
      delete route.travelTime;
    },
    (world) => { world.regions.sheol.routes[0].elevationChangeMeters = -1; },
    (world) => { world.regions.sheol.routes[0].elevationChangeMeters = Infinity; },
    (world) => { world.regions.sheol.routes = world.regions.sheol.routes.filter(({ between }) => !between.includes('costa-final')); }
  ]) {
    const invalid = structuredClone(valid);
    mutate(invalid);
    assert.throws(() => validateWorld(invalid));
  }

  const negativeElevation = structuredClone(valid);
  negativeElevation.regions.sheol.locations['bucca-de-sheol'].elevationMeters = -250.5;
  assert.equal(validateWorld(negativeElevation).regions.sheol.locations['bucca-de-sheol'].elevationMeters, -250.5);
  const authoredChange = structuredClone(valid);
  authoredChange.regions.sheol.routes[0].elevationChangeMeters = 0.5;
  assert.equal(validateWorld(authoredChange).regions.sheol.routes[0].elevationChangeMeters, 0.5);

  const repeatedGateway = structuredClone(valid);
  for (const direction of CARDINAL_DIRECTIONS) {
    repeatedGateway.regions.sheol.entryExitPoints[direction] = 'descenso-del-sibylla';
  }
  assert.deepEqual(
    Object.values(validateWorld(repeatedGateway).regions.sheol.entryExitPoints),
    CARDINAL_DIRECTIONS.map(() => 'descenso-del-sibylla')
  );
  assert.doesNotThrow(() => validateWorld(structuredClone(valid)));
});

test('world validation enforces strict inter-region routes and a connected global graph', async () => {
  const valid = await productionWorld();
  for (const mutate of [
    (world) => { world.interRegionRoutes = {}; },
    (world) => { world.interRegionRoutes[0].extra = true; },
    (world) => { world.interRegionRoutes[0].routeName = ''; },
    (world) => { world.interRegionRoutes[0].between = ['sheol']; },
    (world) => { world.interRegionRoutes[0].between[1] = 'missing-region'; },
    (world) => { world.interRegionRoutes[0].between[1] = world.interRegionRoutes[0].between[0]; },
    (world) => { world.interRegionRoutes.push({ ...structuredClone(world.interRegionRoutes[0]), between: [...world.interRegionRoutes[0].between].reverse() }); },
    (world) => { world.interRegionRoutes[0].directions = []; },
    (world) => { delete world.interRegionRoutes[0].directions.sheol; },
    (world) => { world.interRegionRoutes[0].directions.extra = 'N'; },
    (world) => { world.interRegionRoutes[0].directions.sheol = 'NN'; },
    (world) => { world.interRegionRoutes[0].directions.sheol = 'n'; },
    (world) => { world.interRegionRoutes[0].travelTime = 0; },
    (world) => { world.interRegionRoutes[0].travelTime = -1; },
    (world) => { world.interRegionRoutes[0].travelTime = 2.5; },
    (world) => { world.interRegionRoutes[0].travelTime = Number.MAX_SAFE_INTEGER + 1; },
    (world) => {
      const route = world.interRegionRoutes[0];
      route[LEGACY_INTER_DURATION_KEY] = route.travelTime;
      delete route.travelTime;
    },
    (world) => { world.interRegionRoutes = world.interRegionRoutes.slice(0, 1); }
  ]) {
    const invalid = structuredClone(valid);
    mutate(invalid);
    assert.throws(() => validateWorld(invalid));
  }
});

test('world loader uses one fixed no-cache same-origin request', async () => {
  const world = await productionWorld();
  for (const query of ['', '?region=other', '?path=https://evil.test/x', '?locale=es']) {
    const requests = [];
    const result = await loadWorld({
      baseUrl: `https://app.test/locus.html${query}`,
      fetchFn: async (url, options) => {
        requests.push({ url, options });
        return response(world, 'https://app.test/regions/world.json');
      }
    });
    assert.equal(WORLD_PATH, '/regions/world.json');
    assert.deepEqual(requests, [{
      url: 'https://app.test/regions/world.json',
      options: { cache: 'no-cache' }
    }]);
    assert.equal(result.schemaVersion, 3);
    assert.equal(result.world.regions.sheol.regionName, 'Sheol');
  }
});

test('world loader rejects alternate sources, unsafe URLs, redirects, missing, malformed, and invalid data', async () => {
  const world = await productionWorld();
  for (const unsupported of [
    { path: '/regions/other.json' },
    { url: 'https://evil.test/world.json' },
    { regionId: 'other' },
    { requestedId: 'other' }
  ]) {
    await assert.rejects(() => loadWorld({
      baseUrl: 'https://app.test/locus.html',
      fetchFn: async () => response(world),
      ...unsupported
    }), /Unsupported world loader option/);
  }
  await assert.rejects(() => loadWorld({
    baseUrl: 'file:///tmp/locus.html',
    fetchFn: async () => response(world)
  }), /HTTP or HTTPS/);
  await assert.rejects(() => loadWorld({
    baseUrl: 'https://app.test/locus.html',
    fetchFn: async () => response(world, 'https://evil.test/regions/world.json')
  }), /same-origin/);
  await assert.rejects(() => loadWorld({
    baseUrl: 'https://app.test/locus.html',
    fetchFn: async () => ({ ok: false, json: async () => null })
  }), /Unable to load world/);
  await assert.rejects(() => loadWorld({
    baseUrl: 'https://app.test/locus.html',
    fetchFn: async () => ({ ok: true, json: async () => { throw new SyntaxError('bad JSON'); } })
  }), /Malformed JSON/);
  const invalid = structuredClone(world);
  invalid.interRegionRoutes[0].between[0] = 'missing';
  await assert.rejects(() => loadWorld({
    baseUrl: 'https://app.test/locus.html',
    fetchFn: async () => response(invalid)
  }));
});

test('location context clones and deeply freezes the world, regions, routes, locations, and state', async () => {
  const source = await productionWorld();
  const before = structuredClone(source);
  const context = createLocationContext({
    worldResult: { schemaVersion: 3, world: validateWorld(source) }
  });
  assert.deepEqual(source, before);
  assert.notEqual(context.world, source);
  assert.notEqual(context.currentRegion, source.regions.sheol);
  assert.notEqual(context.currentLocation, source.regions.sheol.locations[context.currentLocationId]);
  assert.notEqual(context.getRoutes('sheol')[0], source.regions.sheol.routes[0]);
  assert.notEqual(context.getInterRegionRoutes()[0], source.interRegionRoutes[0]);
  assert.notEqual(context.currentRegion.entryExitPoints, source.regions.sheol.entryExitPoints);
  assert.notEqual(context.getInterRegionRoutes()[0].directions, source.interRegionRoutes[0].directions);
  assert.notEqual(context.locationState, INITIAL_LOCATION_STATE);
  for (const value of [
    context, context.world, context.world.regions, context.getRegions(), context.currentRegion,
    context.currentRegion.entryExitPoints, context.currentRegion.locations,
    context.currentLocation, context.getLocations('sheol'),
    context.getRoutes('sheol'), context.getRoutes('sheol')[0], context.getRoutes('sheol')[0].between,
    context.getInterRegionRoutes(), context.getInterRegionRoutes()[0],
    context.getInterRegionRoutes()[0].between, context.getInterRegionRoutes()[0].directions,
    context.getInterRegionEndpoint(context.getInterRegionRoutes()[0], 'sheol'),
    context.locationState
  ]) assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.hasOwn(source.regions.sheol.locations['bucca-de-sheol'], 'id'), false);
  assert.equal(Object.hasOwn(source.regions.sheol, 'id'), false);
  for (const region of context.getRegions()) {
    assert.equal(Object.isFrozen(region.entryExitPoints), true);
  }
  for (const route of context.getInterRegionRoutes()) {
    assert.equal(Object.isFrozen(route.directions), true);
    for (const regionId of route.between) {
      assert.equal(Object.isFrozen(context.getInterRegionEndpoint(route, regionId)), true);
    }
  }
  assert.throws(() => { context.currentLocation.name = 'Changed'; }, TypeError);
  assert.throws(() => { context.getInterRegionRoutes()[0].between[0] = 'changed'; }, TypeError);
  assert.equal(Object.values(context).some((value) => value instanceof Map || value instanceof Set), false);
});

test('location context exposes scoped local APIs and rejects invalid IDs and foreign routes', async () => {
  const source = await productionWorld();
  const context = createLocationContext({ worldResult: await worldResult() });
  assert.equal(context.worldSchemaVersion, 3);
  assert.equal(context.regionCount, 3);
  assert.equal(context.interRegionRouteCount, 2);
  assert.equal(context.currentRegionId, 'sheol');
  assert.equal(context.currentRegionName, 'Sheol');
  assert.equal(context.currentRegionDescription, source.regions.sheol.description);
  assert.equal(context.currentLocationId, 'bucca-de-sheol');
  assert.equal(context.currentLocation.name, 'Le Bucca de Sheol');
  assert.deepEqual(context.getRegions().map(({ id }) => id), Object.keys(source.regions));
  for (const regionId of Object.keys(source.regions)) {
    assert.deepEqual(context.getLocations(regionId).map(({ id }) => id), Object.keys(source.regions[regionId].locations));
    assert.deepEqual(context.getRoutes(regionId).map(({ name }) => name), source.regions[regionId].routes.map(({ name }) => name));
    for (const route of context.getRoutes(regionId)) {
      assert.equal(Object.hasOwn(route, 'travelTime'), true);
      assert.equal(Object.hasOwn(route, LEGACY_LOCAL_DURATION_KEY), false);
      assert.equal(Object.hasOwn(route, LEGACY_INTER_DURATION_KEY), false);
      const [firstId, secondId] = route.between;
      assert.ok(context.getRoutesFrom(regionId, firstId).includes(route));
      assert.ok(context.getRoutesFrom(regionId, secondId).includes(route));
      assert.equal(context.getDestination(regionId, route, firstId).id, secondId);
      assert.equal(context.getDestination(regionId, route, secondId).id, firstId);
    }
  }
  const currentRoutes = context.getRoutesFrom('sheol', context.currentLocationId);
  assert.equal(currentRoutes.length, 3);
  assert.deepEqual(currentRoutes.map(({ name }) => name), [
    'Le Via del Sibylla',
    'Le Via del Desiro',
    'Le Passage Submergite'
  ]);
  assert.throws(() => context.getRegion('missing'), /Unknown region/);
  assert.throws(() => context.getLocation('missing', 'anything'), /Unknown region/);
  assert.throws(() => context.getLocation('sheol', 'missing'), /Unknown location/);
  assert.throws(() => context.getRoutesFrom('sheol', 'missing'), /Unknown location/);
  assert.throws(() => context.getDestination('sheol', context.getRoutes('mercato-nigre')[0], 'bucca-de-sheol'), /Unknown route/);
  assert.throws(() => context.getDestination('sheol', { ...currentRoutes[0] }, context.currentLocationId), /Unknown route/);
  assert.throws(() => createLocationContext({
    worldResult: { schemaVersion: 3, world: source },
    locationState: { regionId: 'missing', locationId: context.currentLocationId }
  }), /Unknown region/);
  assert.throws(() => createLocationContext({
    worldResult: { schemaVersion: 3, world: source },
    locationState: { regionId: 'sheol', locationId: 'missing' }
  }), /Unknown location/);
});

test('location context resolves every frozen regional entry and exit point', async () => {
  const source = await productionWorld();
  const context = createLocationContext({ worldResult: await worldResult() });
  for (const [regionId, region] of Object.entries(source.regions)) {
    for (const direction of CARDINAL_DIRECTIONS) {
      assert.equal(
        context.getEntryExitPoint(regionId, direction).id,
        region.entryExitPoints[direction]
      );
    }
  }
  assert.equal(context.getEntryExitPoint('sheol', 'N').id, 'campo-del-ultime-pensamentos');
  assert.equal(context.getEntryExitPoint('mercato-nigre', 'NW').id, 'porta-del-mercatores');
  assert.throws(() => context.getEntryExitPoint('missing', 'N'), /Unknown region/);
  assert.throws(() => context.getEntryExitPoint('sheol', 'NN'), /Unknown direction/);
  assert.throws(() => context.getEntryExitPoint('sheol', 'ne'), /Unknown direction/);
});

test('location context keeps inter-region routes distinct and resolves symmetric physical endpoints', async () => {
  const context = createLocationContext({ worldResult: await worldResult() });
  const [obolo, signos] = context.getInterRegionRoutes();
  for (const route of [obolo, signos]) {
    assert.equal(Object.hasOwn(route, 'travelTime'), true);
    assert.equal(Object.hasOwn(route, LEGACY_LOCAL_DURATION_KEY), false);
    assert.equal(Object.hasOwn(route, LEGACY_INTER_DURATION_KEY), false);
  }
  assert.deepEqual(context.getInterRegionRoutesFrom('sheol'), [obolo]);
  assert.deepEqual(context.getInterRegionRoutesFrom('mercato-nigre'), [obolo, signos]);
  assert.deepEqual(context.getInterRegionRoutesFrom('observatorio-del-prophetias'), [signos]);
  assert.equal(context.getInterRegionDestination(obolo, 'sheol').id, 'mercato-nigre');
  assert.equal(context.getInterRegionDestination(obolo, 'mercato-nigre').id, 'sheol');
  assert.equal(context.getInterRegionDestination(signos, 'mercato-nigre').id, 'observatorio-del-prophetias');
  assert.equal(context.getInterRegionDirection(obolo, 'sheol'), 'N');
  assert.equal(context.getInterRegionDirection(obolo, 'mercato-nigre'), 'S');
  assert.equal(context.getInterRegionDirection(signos, 'mercato-nigre'), 'N');
  assert.equal(context.getInterRegionDirection(signos, 'observatorio-del-prophetias'), 'S');
  assert.deepEqual(
    context.getInterRegionEndpoint(obolo, 'sheol'),
    {
      regionId: 'sheol',
      direction: 'N',
      locationId: 'campo-del-ultime-pensamentos',
      region: context.getRegion('sheol'),
      location: context.getLocation('sheol', 'campo-del-ultime-pensamentos')
    }
  );
  assert.deepEqual(
    context.getInterRegionEndpoint(obolo, 'mercato-nigre'),
    {
      regionId: 'mercato-nigre',
      direction: 'S',
      locationId: 'porta-del-mercatores',
      region: context.getRegion('mercato-nigre'),
      location: context.getLocation('mercato-nigre', 'porta-del-mercatores')
    }
  );
  assert.equal(context.getInterRegionEndpoint(signos, 'mercato-nigre').locationId, 'porta-del-mercatores');
  assert.equal(context.getInterRegionEndpoint(signos, 'observatorio-del-prophetias').locationId, 'turre-del-polo');
  assert.equal(context.getInterRegionEndpoint(obolo, 'sheol').location.id, 'campo-del-ultime-pensamentos');
  assert.equal(context.getInterRegionEndpoint(obolo, 'mercato-nigre').location.id, 'porta-del-mercatores');
  assert.throws(() => context.getInterRegionRoutesFrom('missing'), /Unknown region/);
  assert.throws(() => context.getInterRegionDestination({ ...obolo }, 'sheol'), /Unknown inter-region route/);
  assert.throws(() => context.getInterRegionDirection({ ...obolo }, 'sheol'), /Unknown inter-region route/);
  assert.throws(() => context.getInterRegionEndpoint(structuredClone(obolo), 'sheol'), /Unknown inter-region route/);
  assert.throws(() => context.getInterRegionDirection(signos, 'sheol'), /does not connect region/);
  assert.throws(() => context.getInterRegionEndpoint(signos, 'sheol'), /does not connect region/);
  assert.throws(() => context.getInterRegionDestination(signos, 'sheol'), /does not connect region/);
  assert.equal(context.getRoutes('sheol').includes(obolo), false);
  assert.equal(context.getInterRegionRoutes().includes(context.getRoutes('sheol')[0]), false);
});

test('Locus and Rutas start locale, nomenclature, and world requests concurrently without timers', async (t) => {
  const [nomenclature, world, english, spanish] = await Promise.all([
    readJson(nomenclaturePath),
    productionWorld(),
    readJson(path.join(publicDirectory, 'locales', 'en.json')),
    readJson(path.join(publicDirectory, 'locales', 'es.json'))
  ]);
  const values = new Map([
    ['/config/nomenclature.json', nomenclature],
    ['/regions/world.json', world],
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
      '/regions/world.json'
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
      assert.equal(specific.get('[data-local-route-list]').children.length, 3);
      assert.equal(specific.get('[data-inter-region-route-list]').children.length, 1);
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
  assert.equal(requests.includes('/regions/world.json'), false);
  for (const requestPath of requests) {
    pending.get(requestPath)(response(values.get(requestPath), `https://app.test${requestPath}`));
  }
  const context = await promise;
  assert.equal(context.applicationDisplayName, 'Insidia');
});

test('world configuration failures use the resolved localized error and never render partial UI', async (t) => {
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
      if (pathname === '/regions/world.json') return { ok: false, json: async () => null };
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

test('Locus renders initial Sheol data without coordinates in both locales', async () => {
  const locationContext = createLocationContext({ worldResult: await worldResult() });
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
    assert.equal(visibleByLocale[localeId]['[data-location-name]'], 'Le Bucca de Sheol');
    assert.equal(
      visibleByLocale[localeId]['[data-location-description]'],
      'Le entrata ceremonial principal ab le mundo del vivos.'
    );
  }
  assert.equal(visibleByLocale.en['[data-location-elevation]'], '1 meter');
  assert.equal(visibleByLocale.es['[data-location-elevation]'], '1 metro');
  assert.doesNotMatch(JSON.stringify(visibleByLocale), /40\.838737|14\.076167/);
});

test('Rutas renders separate direct local and inter-regional routes in both locales', async () => {
  const locationContext = createLocationContext({ worldResult: await worldResult() });
  const selectors = [
    '[data-route-origin]', '[data-local-route-list]', '[data-local-route-empty]',
    '[data-inter-region-route-list]', '[data-inter-region-route-empty]'
  ];
  const snapshots = {};
  for (const localeId of ['en', 'es']) {
    const rootElement = rendererRoot(selectors);
    renderRutas(rootElement, await presentationContext(localeId), locationContext);
    const localCards = rootElement.elements.get('[data-local-route-list]').children;
    const interRegionCards = rootElement.elements.get('[data-inter-region-route-list]').children;
    assert.equal(localCards.length, 3);
    assert.equal(interRegionCards.length, 1);
    assert.equal(rootElement.elements.get('[data-local-route-empty]').hidden, true);
    assert.equal(rootElement.elements.get('[data-inter-region-route-empty]').hidden, true);
    snapshots[localeId] = {
      origin: rootElement.elements.get('[data-route-origin]').textContent,
      local: localCards.map((card) => card.children.map(({ textContent }) => textContent)),
      interRegion: interRegionCards[0].children.map(({ textContent }) => textContent)
    };
  }
  assert.equal(snapshots.en.origin, 'Le Bucca de Sheol');
  assert.equal(snapshots.es.origin, snapshots.en.origin);
  assert.deepEqual(snapshots.en.local, [
    [
      'Le Via del Sibylla',
      'Destination: Le Descenso del Sibylla',
      'Le corridor ritual per le qual le cavernas natural deveni le architectura de Sheol.',
      'Travel time: 70 fictional minutes',
      'Elevation change: 16 meters'
    ],
    [
      'Le Via del Desiro',
      'Destination: Le Cais del Desiro',
      'Un chantier naval submergite ubi le desiro es discargate, inventariate e consumite.',
      'Travel time: 60 fictional minutes',
      'Elevation change: 5 meters'
    ],
    [
      'Le Passage Submergite',
      'Destination: Le Cortes Submergite',
      'Le palatios, thermas, jardines e tribunales submergite del mortos plen de desiro.',
      'Travel time: 100 fictional minutes',
      'Elevation change: 10 meters'
    ]
  ]);
  assert.deepEqual(snapshots.en.interRegion, [
    'Le Via del Obolo Nigre',
    'Destination region: Mercato Nigre',
    'Exit point: Le Campo del Ultime Pensamentos (N)',
    'Entry point: Le Porta del Mercatores (S)',
    'Travel time: 1800 fictional minutes'
  ]);
  assert.deepEqual(snapshots.es.interRegion, [
    'Le Via del Obolo Nigre',
    'Región de destino: Mercato Nigre',
    'Punto de salida: Le Campo del Ultime Pensamentos (N)',
    'Punto de entrada: Le Porta del Mercatores (S)',
    'Tiempo de viaje: 1800 minutos ficticios'
  ]);
  assert.deepEqual(snapshots.es.local.map((card) => card[3]), [
    'Tiempo de viaje: 70 minutos ficticios',
    'Tiempo de viaje: 60 minutos ficticios',
    'Tiempo de viaje: 100 minutos ficticios'
  ]);
  assert.doesNotMatch(JSON.stringify(snapshots), /Le Via del Signos Celestial|Observatorio del Prophetias|40\.8479|14\.0532/);
});

test('location production has one world source and remains read-only and free of prohibited integrations', async () => {
  const regionFiles = await readdir(path.join(publicDirectory, 'regions'));
  assert.deepEqual(regionFiles, ['world.json']);
  const locationFiles = [
    'location-bootstrap.js', 'location-renderers.js', 'location-state.js',
    'location.js', 'world-loader.js', 'locus-page.js', 'rutas-page.js',
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

  const world = await productionWorld();
  const properNouns = [
    ...Object.values(world.regions).flatMap((region) => [
      region.regionName,
      region.description,
      ...Object.values(region.locations).flatMap(({ name, description }) => [name, description]),
      ...region.routes.map(({ name }) => name)
    ]),
    ...world.interRegionRoutes.map(({ routeName }) => routeName)
  ];
  const productionFiles = (await listFiles(publicDirectory)).filter((file) => (
    !file.endsWith(path.join('regions', 'world.json'))
    && !file.endsWith('location-state.js')
  ));
  const otherProductionSource = (await Promise.all(productionFiles.map((file) => readFile(file, 'utf8')))).join('\n');
  for (const properNoun of properNouns) {
    assert.equal(otherProductionSource.includes(properNoun), false, properNoun);
  }
  const stateSource = await readFile(path.join(publicDirectory, 'location-state.js'), 'utf8');
  assert.match(stateSource, /regionId: 'sheol'/);
  assert.match(stateSource, /locationId: 'bucca-de-sheol'/);
});
