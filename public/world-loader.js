export const WORLD_PATH = '/regions/world.json';
export const WORLD_SCHEMA_VERSION = 3;
export const CARDINAL_DIRECTIONS = Object.freeze([
  'N',
  'NE',
  'E',
  'SE',
  'S',
  'SW',
  'W',
  'NW'
]);

const WORLD_KEYS = Object.freeze(['regions', 'interRegionRoutes']);
const REGION_KEYS = Object.freeze([
  'regionName',
  'description',
  'entryExitPoints',
  'locations',
  'routes'
]);
const LOCATION_KEYS = Object.freeze([
  'name',
  'description',
  'latitude',
  'longitude',
  'elevationMeters'
]);
const LOCAL_ROUTE_KEYS = Object.freeze([
  'name',
  'between',
  'travelTime',
  'elevationChangeMeters'
]);
const INTER_REGION_ROUTE_KEYS = Object.freeze(['routeName', 'between', 'directions', 'travelTime']);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIRECTION_SET = new Set(CARDINAL_DIRECTIONS);

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertExactKeys(value, expectedKeys, label) {
  assertObject(value, label);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must contain exact required keys`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function assertId(value, label) {
  assertNonEmptyString(value, label);
  if (!ID_PATTERN.test(value)) throw new Error(`${label} must use lowercase kebab-case`);
}

function assertFiniteNumber(value, label) {
  if (typeof value !== 'number') throw new TypeError(`${label} must be a number`);
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
}

function assertCoordinate(value, minimum, maximum, label) {
  assertFiniteNumber(value, label);
  if (value < minimum || value > maximum) {
    throw new RangeError(`${label} must be between ${minimum} and ${maximum}`);
  }
}

function assertPositiveSafeInteger(value, label) {
  assertFiniteNumber(value, label);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
}

function assertNonNegativeFiniteNumber(value, label) {
  assertFiniteNumber(value, label);
  if (value < 0) throw new RangeError(`${label} must be non-negative`);
}

function normalizedPair(firstId, secondId) {
  return [firstId, secondId].sort().join('\u0000');
}

function assertConnected(ids, adjacency, label) {
  const [firstId] = ids;
  const visited = new Set([firstId]);
  const pending = [firstId];
  while (pending.length > 0) {
    const id = pending.pop();
    for (const adjacentId of adjacency.get(id)) {
      if (visited.has(adjacentId)) continue;
      visited.add(adjacentId);
      pending.push(adjacentId);
    }
  }
  if (visited.size !== ids.length) throw new Error(`${label} must form one connected graph`);
}

function validateRegion(region, regionId) {
  const label = `world.regions.${regionId}`;
  assertExactKeys(region, REGION_KEYS, label);
  assertNonEmptyString(region.regionName, `${label}.regionName`);
  assertNonEmptyString(region.description, `${label}.description`);
  assertObject(region.locations, `${label}.locations`);

  const locationIds = Object.keys(region.locations);
  if (locationIds.length === 0) throw new Error(`${label}.locations must contain at least one location`);
  const adjacency = new Map(locationIds.map((locationId) => [locationId, new Set()]));

  for (const locationId of locationIds) {
    assertId(locationId, `${label}.locations.${locationId} ID`);
    const locationLabel = `${label}.locations.${locationId}`;
    const location = region.locations[locationId];
    assertExactKeys(location, LOCATION_KEYS, locationLabel);
    assertNonEmptyString(location.name, `${locationLabel}.name`);
    assertNonEmptyString(location.description, `${locationLabel}.description`);
    assertCoordinate(location.latitude, -90, 90, `${locationLabel}.latitude`);
    assertCoordinate(location.longitude, -180, 180, `${locationLabel}.longitude`);
    assertFiniteNumber(location.elevationMeters, `${locationLabel}.elevationMeters`);
  }

  assertExactKeys(region.entryExitPoints, CARDINAL_DIRECTIONS, `${label}.entryExitPoints`);
  for (const direction of CARDINAL_DIRECTIONS) {
    const locationId = region.entryExitPoints[direction];
    assertId(locationId, `${label}.entryExitPoints.${direction}`);
    if (!Object.hasOwn(region.locations, locationId)) {
      throw new Error(`${label}.entryExitPoints.${direction} references unknown location: ${locationId}`);
    }
  }

  if (!Array.isArray(region.routes)) throw new TypeError(`${label}.routes must be an array`);
  const routePairs = new Set();
  region.routes.forEach((route, index) => {
    const routeLabel = `${label}.routes[${index}]`;
    assertExactKeys(route, LOCAL_ROUTE_KEYS, routeLabel);
    assertNonEmptyString(route.name, `${routeLabel}.name`);
    if (!Array.isArray(route.between) || route.between.length !== 2) {
      throw new TypeError(`${routeLabel}.between must contain exactly two location IDs`);
    }
    const [firstId, secondId] = route.between;
    assertId(firstId, `${routeLabel}.between[0]`);
    assertId(secondId, `${routeLabel}.between[1]`);
    if (firstId === secondId) throw new Error(`${routeLabel}.between must contain distinct location IDs`);
    if (!Object.hasOwn(region.locations, firstId)) throw new Error(`${routeLabel} references unknown location: ${firstId}`);
    if (!Object.hasOwn(region.locations, secondId)) throw new Error(`${routeLabel} references unknown location: ${secondId}`);
    const pair = normalizedPair(firstId, secondId);
    if (routePairs.has(pair)) throw new Error(`${routeLabel} duplicates an existing undirected route`);
    routePairs.add(pair);
    assertPositiveSafeInteger(route.travelTime, `${routeLabel}.travelTime`);
    assertNonNegativeFiniteNumber(route.elevationChangeMeters, `${routeLabel}.elevationChangeMeters`);
    adjacency.get(firstId).add(secondId);
    adjacency.get(secondId).add(firstId);
  });

  assertConnected(locationIds, adjacency, `${label} locations`);
}

export function validateWorld(world) {
  assertExactKeys(world, WORLD_KEYS, 'world');
  assertObject(world.regions, 'world.regions');
  const regionIds = Object.keys(world.regions);
  if (regionIds.length === 0) throw new Error('world.regions must contain at least one region');

  const regionNames = new Set();
  const adjacency = new Map(regionIds.map((regionId) => [regionId, new Set()]));
  for (const regionId of regionIds) {
    assertId(regionId, `world.regions.${regionId} ID`);
    const region = world.regions[regionId];
    validateRegion(region, regionId);
    if (regionNames.has(region.regionName)) throw new Error(`Duplicate region display name: ${region.regionName}`);
    regionNames.add(region.regionName);
  }

  if (!Array.isArray(world.interRegionRoutes)) {
    throw new TypeError('world.interRegionRoutes must be an array');
  }
  const routePairs = new Set();
  world.interRegionRoutes.forEach((route, index) => {
    const label = `world.interRegionRoutes[${index}]`;
    assertExactKeys(route, INTER_REGION_ROUTE_KEYS, label);
    assertNonEmptyString(route.routeName, `${label}.routeName`);
    if (!Array.isArray(route.between) || route.between.length !== 2) {
      throw new TypeError(`${label}.between must contain exactly two region IDs`);
    }
    const [firstId, secondId] = route.between;
    assertId(firstId, `${label}.between[0]`);
    assertId(secondId, `${label}.between[1]`);
    if (firstId === secondId) throw new Error(`${label}.between must contain distinct region IDs`);
    if (!Object.hasOwn(world.regions, firstId)) throw new Error(`${label} references unknown region: ${firstId}`);
    if (!Object.hasOwn(world.regions, secondId)) throw new Error(`${label} references unknown region: ${secondId}`);
    assertExactKeys(route.directions, route.between, `${label}.directions`);
    for (const regionId of route.between) {
      const direction = route.directions[regionId];
      if (!DIRECTION_SET.has(direction)) {
        throw new Error(`${label}.directions.${regionId} must be a canonical direction`);
      }
      const endpointLocationId = world.regions[regionId].entryExitPoints[direction];
      if (!Object.hasOwn(world.regions[regionId].locations, endpointLocationId)) {
        throw new Error(`${label}.directions.${regionId} does not resolve to a valid location`);
      }
    }
    const pair = normalizedPair(firstId, secondId);
    if (routePairs.has(pair)) throw new Error(`${label} duplicates an existing undirected route`);
    routePairs.add(pair);
    assertPositiveSafeInteger(route.travelTime, `${label}.travelTime`);
    adjacency.get(firstId).add(secondId);
    adjacency.get(secondId).add(firstId);
  });

  assertConnected(regionIds, adjacency, 'world regions');
  return world;
}

export async function loadWorld(options = {}) {
  assertObject(options, 'loadWorld options');
  const unknownOptions = Object.keys(options).filter((key) => !['fetchFn', 'baseUrl'].includes(key));
  if (unknownOptions.length > 0) throw new Error(`Unsupported world loader option: ${unknownOptions[0]}`);

  const fetchFn = options.fetchFn ?? window.fetch.bind(window);
  if (typeof fetchFn !== 'function') throw new TypeError('loadWorld fetchFn must be a function');
  const baseUrl = options.baseUrl ?? window.location.href;
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('World base URL must use HTTP or HTTPS');
  const url = new URL(WORLD_PATH, base);
  if (url.origin !== base.origin) throw new Error('World file must be same-origin');

  const response = await fetchFn(url.href, { cache: 'no-cache' });
  if (!response?.ok) throw new Error(`Unable to load world: ${url.pathname}`);
  if (response.url && new URL(response.url, url).origin !== base.origin) {
    throw new Error('World response must be same-origin');
  }

  let world;
  try {
    world = await response.json();
  } catch {
    throw new Error(`Malformed JSON: ${url.pathname}`);
  }
  return { schemaVersion: WORLD_SCHEMA_VERSION, world: validateWorld(world) };
}
