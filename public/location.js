import { INITIAL_LOCATION_STATE } from './location-state.js';
import { CARDINAL_DIRECTIONS, WORLD_SCHEMA_VERSION } from './world-loader.js';

const DIRECTION_SET = new Set(CARDINAL_DIRECTIONS);

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

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function requireMapped(map, id, category) {
  const value = map.get(id);
  if (!value) throw new Error(`Unknown ${category} ID: ${id}`);
  return value;
}

export function createLocationContext({
  worldResult,
  locationState = INITIAL_LOCATION_STATE
}) {
  assertObject(worldResult, 'worldResult');
  assertExactKeys(worldResult, ['schemaVersion', 'world'], 'worldResult');
  if (worldResult.schemaVersion !== WORLD_SCHEMA_VERSION) {
    throw new Error(`worldResult.schemaVersion must be ${WORLD_SCHEMA_VERSION}`);
  }
  assertObject(worldResult.world, 'worldResult.world');
  assertExactKeys(locationState, ['regionId', 'locationId'], 'locationState');
  assertNonEmptyString(locationState.regionId, 'locationState.regionId');
  assertNonEmptyString(locationState.locationId, 'locationState.locationId');

  const regionsById = new Map();
  const locationsByRegionId = new Map();
  const locationListsByRegionId = new Map();
  const routeSetsByRegionId = new Map();
  const routeListsByRegionId = new Map();
  const routesByRegionAndLocation = new Map();

  for (const [regionId, sourceRegion] of Object.entries(worldResult.world.regions)) {
    const locationEntries = Object.entries(sourceRegion.locations).map(([locationId, location]) => (
      [locationId, deepFreeze({ id: locationId, ...location })]
    ));
    const locationsById = new Map(locationEntries);
    const locations = Object.freeze(locationEntries.map(([, location]) => location));
    const routes = Object.freeze(sourceRegion.routes.map((route) => deepFreeze({
      ...route,
      between: [...route.between]
    })));
    const region = deepFreeze({
      id: regionId,
      regionName: sourceRegion.regionName,
      description: sourceRegion.description,
      entryExitPoints: { ...sourceRegion.entryExitPoints },
      locations: Object.fromEntries(locationEntries),
      routes
    });
    const routesByLocation = new Map(locations.map(({ id }) => [id, []]));
    for (const route of routes) {
      for (const locationId of route.between) routesByLocation.get(locationId).push(route);
    }
    for (const [locationId, locationRoutes] of routesByLocation) {
      routesByLocation.set(locationId, Object.freeze([...locationRoutes]));
    }

    regionsById.set(regionId, region);
    locationsByRegionId.set(regionId, locationsById);
    locationListsByRegionId.set(regionId, locations);
    routeSetsByRegionId.set(regionId, new Set(routes));
    routeListsByRegionId.set(regionId, routes);
    routesByRegionAndLocation.set(regionId, routesByLocation);
  }

  const regions = Object.freeze([...regionsById.values()]);
  const interRegionRoutes = Object.freeze(worldResult.world.interRegionRoutes.map((route) => deepFreeze({
    ...route,
    between: [...route.between],
    directions: { ...route.directions }
  })));
  const interRegionRouteSet = new Set(interRegionRoutes);
  const interRegionRoutesByRegion = new Map(regions.map(({ id }) => [id, []]));
  const interRegionEndpointsByRoute = new Map();
  for (const route of interRegionRoutes) {
    const endpointsByRegion = new Map();
    for (const regionId of route.between) interRegionRoutesByRegion.get(regionId).push(route);
    for (const regionId of route.between) {
      const region = regionsById.get(regionId);
      const direction = route.directions[regionId];
      const locationId = region.entryExitPoints[direction];
      endpointsByRegion.set(regionId, deepFreeze({
        regionId,
        direction,
        locationId,
        region,
        location: locationsByRegionId.get(regionId).get(locationId)
      }));
    }
    interRegionEndpointsByRoute.set(route, endpointsByRegion);
  }
  for (const [regionId, routes] of interRegionRoutesByRegion) {
    interRegionRoutesByRegion.set(regionId, Object.freeze([...routes]));
  }

  const world = deepFreeze({
    regions: Object.fromEntries(regions.map((region) => [region.id, region])),
    interRegionRoutes
  });
  const frozenLocationState = deepFreeze({ ...locationState });
  const currentRegion = requireMapped(regionsById, frozenLocationState.regionId, 'region');
  const currentLocation = requireMapped(
    locationsByRegionId.get(currentRegion.id),
    frozenLocationState.locationId,
    `location in region ${currentRegion.id}`
  );

  function getRegion(regionId) {
    return requireMapped(regionsById, regionId, 'region');
  }

  function getLocation(regionId, locationId) {
    getRegion(regionId);
    return requireMapped(locationsByRegionId.get(regionId), locationId, `location in region ${regionId}`);
  }

  function requireInterRegionRoute(route) {
    if (!interRegionRouteSet.has(route)) throw new Error('Unknown inter-region route');
    return route;
  }

  function getEntryExitPoint(regionId, direction) {
    const region = getRegion(regionId);
    if (!DIRECTION_SET.has(direction)) throw new Error(`Unknown direction ID: ${direction}`);
    return getLocation(regionId, region.entryExitPoints[direction]);
  }

  function getInterRegionDirection(route, regionId) {
    getRegion(regionId);
    requireInterRegionRoute(route);
    if (!route.between.includes(regionId)) {
      throw new Error(`Inter-region route does not connect region: ${regionId}`);
    }
    return route.directions[regionId];
  }

  function getInterRegionEndpoint(route, regionId) {
    getInterRegionDirection(route, regionId);
    return interRegionEndpointsByRoute.get(route).get(regionId);
  }

  const context = {
    world,
    worldSchemaVersion: worldResult.schemaVersion,
    locationState: frozenLocationState,
    currentRegionId: currentRegion.id,
    currentRegion,
    currentRegionName: currentRegion.regionName,
    currentRegionDescription: currentRegion.description,
    currentLocationId: currentLocation.id,
    currentLocation,
    regionCount: regions.length,
    interRegionRouteCount: interRegionRoutes.length,
    locationCount: locationListsByRegionId.get(currentRegion.id).length,
    routeCount: routeListsByRegionId.get(currentRegion.id).length,
    getRegion,
    getRegions: () => regions,
    getLocation,
    getEntryExitPoint,
    getLocations(regionId) {
      getRegion(regionId);
      return locationListsByRegionId.get(regionId);
    },
    getRoutes(regionId) {
      getRegion(regionId);
      return routeListsByRegionId.get(regionId);
    },
    getRoutesFrom(regionId, locationId) {
      getLocation(regionId, locationId);
      return routesByRegionAndLocation.get(regionId).get(locationId);
    },
    getDestination(regionId, route, originLocationId) {
      getLocation(regionId, originLocationId);
      if (!routeSetsByRegionId.get(regionId).has(route)) throw new Error(`Unknown route in region: ${regionId}`);
      if (route.between[0] === originLocationId) return getLocation(regionId, route.between[1]);
      if (route.between[1] === originLocationId) return getLocation(regionId, route.between[0]);
      throw new Error(`Route does not connect location: ${originLocationId}`);
    },
    getInterRegionRoutes: () => interRegionRoutes,
    getInterRegionRoutesFrom(regionId) {
      getRegion(regionId);
      return interRegionRoutesByRegion.get(regionId);
    },
    getInterRegionDestination(route, originRegionId) {
      getRegion(originRegionId);
      requireInterRegionRoute(route);
      if (route.between[0] === originRegionId) return getRegion(route.between[1]);
      if (route.between[1] === originRegionId) return getRegion(route.between[0]);
      throw new Error(`Inter-region route does not connect region: ${originRegionId}`);
    },
    getInterRegionDirection,
    getInterRegionEndpoint
  };

  return Object.freeze(context);
}
