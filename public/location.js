import { INITIAL_LOCATION_STATE } from './location-state.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

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

function requireMapped(map, id, category) {
  const value = map.get(id);
  if (!value) throw new Error(`Unknown ${category} ID: ${id}`);
  return value;
}

export function createLocationContext({
  regionResult,
  locationState = INITIAL_LOCATION_STATE
}) {
  assertObject(regionResult, 'regionResult');
  assertExactKeys(regionResult, ['schemaVersion', 'region'], 'regionResult');
  if (regionResult.schemaVersion !== 1) throw new Error('regionResult.schemaVersion must be 1');
  assertObject(regionResult.region, 'regionResult.region');
  assertExactKeys(locationState, ['regionName', 'locationId'], 'locationState');
  if (typeof locationState.regionName !== 'string' || locationState.regionName.trim() === '') {
    throw new TypeError('locationState.regionName must be a non-empty string');
  }
  if (typeof locationState.locationId !== 'string' || locationState.locationId.trim() === '') {
    throw new TypeError('locationState.locationId must be a non-empty string');
  }

  const region = regionResult.region;
  if (locationState.regionName !== region.regionName) {
    throw new Error(`Unknown current region: ${locationState.regionName}`);
  }

  const locationEntries = Object.entries(region.locations).map(([id, location]) => {
    return [id, deepFreeze({ id, ...location })];
  });
  const locationsById = new Map(locationEntries);
  const locations = Object.freeze(locationEntries.map(([, location]) => location));
  const currentLocation = requireMapped(locationsById, locationState.locationId, 'location');

  const routes = Object.freeze(region.routes.map((route) => deepFreeze({
    ...route,
    between: [...route.between]
  })));
  const routeSet = new Set(routes);
  const routesByLocation = new Map(locations.map(({ id }) => [id, []]));
  for (const route of routes) {
    for (const locationId of route.between) routesByLocation.get(locationId).push(route);
  }
  for (const [locationId, locationRoutes] of routesByLocation) {
    routesByLocation.set(locationId, Object.freeze([...locationRoutes]));
  }

  const frozenLocationState = deepFreeze({ ...locationState });
  const context = {
    regionName: region.regionName,
    regionDescription: region.description,
    regions: Object.freeze([...region.regions]),
    regionSchemaVersion: regionResult.schemaVersion,
    locationState: frozenLocationState,
    currentLocationId: frozenLocationState.locationId,
    currentLocation,
    locationCount: locations.length,
    routeCount: routes.length,
    getLocation: (id) => requireMapped(locationsById, id, 'location'),
    getLocations: () => locations,
    getRoutesFrom(id) {
      requireMapped(locationsById, id, 'location');
      return routesByLocation.get(id);
    },
    getDestination(route, originLocationId) {
      if (!routeSet.has(route)) throw new Error('Unknown route');
      if (route.between[0] === originLocationId) return requireMapped(locationsById, route.between[1], 'location');
      if (route.between[1] === originLocationId) return requireMapped(locationsById, route.between[0], 'location');
      throw new Error(`Route does not connect location: ${originLocationId}`);
    }
  };

  return Object.freeze(context);
}
