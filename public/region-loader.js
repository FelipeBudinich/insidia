export const REGION_PATH = '/regions/sheol.json';
export const REGION_SCHEMA_VERSION = 1;

const TOP_LEVEL_KEYS = Object.freeze([
  'regionName',
  'description',
  'regions',
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
const ROUTE_KEYS = Object.freeze([
  'name',
  'between',
  'walkingTime',
  'elevationChangeMeters'
]);
const LOCATION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

function assertLocationId(value, label) {
  assertNonEmptyString(value, label);
  if (!LOCATION_ID_PATTERN.test(value)) {
    throw new Error(`${label} must use lowercase kebab-case`);
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
  if (value < 0) {
    throw new RangeError(`${label} must be non-negative`);
  }
}

function normalizedPair(firstId, secondId) {
  return [firstId, secondId].sort().join('\u0000');
}

function assertConnected(locationIds, adjacency) {
  const [firstLocationId] = locationIds;
  const visited = new Set([firstLocationId]);
  const pending = [firstLocationId];

  while (pending.length > 0) {
    const locationId = pending.pop();
    for (const adjacentLocationId of adjacency.get(locationId)) {
      if (visited.has(adjacentLocationId)) continue;
      visited.add(adjacentLocationId);
      pending.push(adjacentLocationId);
    }
  }

  if (visited.size !== locationIds.length) {
    throw new Error('region locations must form one connected route graph');
  }
}

export function validateRegion(region) {
  assertExactKeys(region, TOP_LEVEL_KEYS, 'region');
  assertNonEmptyString(region.regionName, 'region.regionName');
  assertNonEmptyString(region.description, 'region.description');

  if (!Array.isArray(region.regions)) throw new TypeError('region.regions must be an array');
  if (region.regions.length !== 0) {
    throw new Error('region.regions must remain empty until inter-region travel is supported');
  }

  assertObject(region.locations, 'region.locations');
  const locationIds = Object.keys(region.locations);
  if (locationIds.length === 0) throw new Error('region.locations must contain at least one location');

  const adjacency = new Map(locationIds.map((locationId) => [locationId, new Set()]));
  for (const locationId of locationIds) {
    assertLocationId(locationId, `region.locations.${locationId} ID`);
    const location = region.locations[locationId];
    assertExactKeys(location, LOCATION_KEYS, `region.locations.${locationId}`);
    assertNonEmptyString(location.name, `region.locations.${locationId}.name`);
    assertNonEmptyString(location.description, `region.locations.${locationId}.description`);
    assertCoordinate(location.latitude, -90, 90, `region.locations.${locationId}.latitude`);
    assertCoordinate(location.longitude, -180, 180, `region.locations.${locationId}.longitude`);
    assertFiniteNumber(location.elevationMeters, `region.locations.${locationId}.elevationMeters`);
  }

  if (!Array.isArray(region.routes)) throw new TypeError('region.routes must be an array');
  const routePairs = new Set();
  region.routes.forEach((route, index) => {
    const label = `region.routes[${index}]`;
    assertExactKeys(route, ROUTE_KEYS, label);
    assertNonEmptyString(route.name, `${label}.name`);
    if (!Array.isArray(route.between) || route.between.length !== 2) {
      throw new TypeError(`${label}.between must contain exactly two location IDs`);
    }
    const [firstId, secondId] = route.between;
    assertLocationId(firstId, `${label}.between[0]`);
    assertLocationId(secondId, `${label}.between[1]`);
    if (firstId === secondId) throw new Error(`${label}.between must contain distinct location IDs`);
    if (!Object.hasOwn(region.locations, firstId)) throw new Error(`${label} references unknown location: ${firstId}`);
    if (!Object.hasOwn(region.locations, secondId)) throw new Error(`${label} references unknown location: ${secondId}`);

    const pair = normalizedPair(firstId, secondId);
    if (routePairs.has(pair)) throw new Error(`${label} duplicates an existing undirected route`);
    routePairs.add(pair);

    assertPositiveSafeInteger(route.walkingTime, `${label}.walkingTime`);
    assertNonNegativeFiniteNumber(route.elevationChangeMeters, `${label}.elevationChangeMeters`);

    adjacency.get(firstId).add(secondId);
    adjacency.get(secondId).add(firstId);
  });

  assertConnected(locationIds, adjacency);
  return region;
}

export async function loadRegion(options = {}) {
  assertObject(options, 'loadRegion options');
  const unknownOptions = Object.keys(options).filter((key) => !['fetchFn', 'baseUrl'].includes(key));
  if (unknownOptions.length > 0) throw new Error(`Unsupported region loader option: ${unknownOptions[0]}`);

  const fetchFn = options.fetchFn ?? window.fetch.bind(window);
  const baseUrl = options.baseUrl ?? window.location.href;
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Region base URL must use HTTP or HTTPS');
  const url = new URL(REGION_PATH, base);
  if (url.origin !== base.origin) throw new Error('Region file must be same-origin');

  const response = await fetchFn(url.href, { cache: 'no-cache' });
  if (!response?.ok) throw new Error(`Unable to load region: ${url.pathname}`);
  if (response.url && new URL(response.url, url).origin !== base.origin) {
    throw new Error('Region response must be same-origin');
  }

  let region;
  try {
    region = await response.json();
  } catch {
    throw new Error(`Malformed JSON: ${url.pathname}`);
  }

  return {
    schemaVersion: REGION_SCHEMA_VERSION,
    region: validateRegion(region)
  };
}
