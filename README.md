# Insidia

Insidia v8.25 is a browser-calculated fictional calendar and world-state interface with fixed Interlingua generic text. It has three focused live pages, four generic static pages, and two read-only location pages backed by one three-region world configuration. The Node.js backend only redirects `/`, serves static files, and exposes `/health`; it performs no fictional-time or location calculations.

## Run locally

Node.js 24 is the supported runtime. There are no runtime dependencies or build step.

```sh
npm ci
npm test
npm start
```

Open [http://localhost:3000](http://localhost:3000). Set `PORT` to override port 3000.

## Pages and navigation

The page registry contains exactly nine stable IDs, fixed routes, and nomenclature-owned names. Each HTML document contains one empty navigation placeholder. `app-bootstrap.js` renders the two-level navigation with DOM APIs from immutable group definitions, so membership and order exist in one place and every generated link remains a clean fixed route.

The top category row is always Personage, Almanac, Location, in that order. Each top item is a navigation group rather than a page: Personage is `navigation-group-02` and opens Identitate; Almanac is `navigation-group-01` and opens Calendario; Location is `navigation-group-03` and opens Locus.

Only the active category's secondary row appears. Navigation has exactly two levels; there is no tertiary or subcategory row:

- Personage pages (`page-04` through `page-06`): Identitate, Inventario, Subordinatos
- Almanac pages (`page-01` through `page-03`): Calendario, Destino, Tempore
- Location pages (`page-07` through `page-09`): Locus, Rutas, Explorar

The actual page link alone receives `aria-current="page"`. The active top group receives `data-active-section="true"` for context without falsely claiming a group is the current page.

```text
Personage
├── Identitate
├── Inventario
└── Subordinatos
Almanac
├── Calendario
├── Destino
└── Tempore
Location
├── Locus
├── Rutas
└── Explorar
```

| ID | Name | Route | Behavior |
|---|---|---|---|
| `page-01` | Calendario | `/calendario.html` | Live calendar, season title, and lunar summary |
| `page-02` | Destino | `/destino.html` | Live outcome, tide, Pull, orbit, and progress state |
| `page-03` | Tempore | `/tempore.html` | Live calendar/lunar clocks, season, and progress |
| `page-04` | Identitate | `/identitate.html` | Static identity, memories, and decisions shell |
| `page-05` | Inventario | `/inventario.html` | Static equipment and storage shell |
| `page-06` | Subordinatos | `/subordinatos.html` | Static champions and minions shell |
| `page-07` | Locus | `/locus.html` | Read-only configured region and current location |
| `page-08` | Rutas | `/rutas.html` | Read-only local routes and inter-regional routes from the current state |
| `page-09` | Explorar | `/explorar.html` | Static exploration observations shell |

The static section shells are intentionally empty apart from their configured headings:

- Identitate: Titulo, Nomine, Epitheto, Memorias, Decisiones
- Inventario: Equipamento, Deposito
- Subordinatos: Campiones, Miniones
- Locus: Sheol and the initial configured location, Le Bucca de Sheol
- Rutas: three local routes from Bucca plus the region-level Le Via del Obolo Nigre information
- Explorar: Observationes

Mappa, Pensamentos, Commandamento, Investigationes, and Ordines were removed. Observationes and Decisiones now exist only as sections on Explorar and Identitate respectively. Their former HTML routes and page modules, `/mappa.html`, `/mappa-page.js`, `/location.html`, the former Personage route, and the other legacy routes have no redirects, aliases, or compatibility files and return ordinary static 404 responses.

Location pages do not use browser geolocation, request location permission, display coordinates, or load a graphical map, iframe, route provider, external map provider, or map tiles.

The four generic static pages share `static-page.js`; their current neutral ID comes from `data-current-page-id` on the document root. Locus and Rutas share `location-page.js` and the meaningful location orchestration in `location-bootstrap.js`, so nomenclature and world configuration begin loading concurrently. All six share titles, descriptions, navigation, footer presentation, accessibility state, and configuration-error handling with the live pages, but their module graphs contain neither `live-state.js` nor `core/mechanics.js` and they never create a recurring timer.

## World and location graphs

`public/regions/world.json` is the sole production geography source. Loader schema version 3 contains three stable region IDs: `sheol`, `mercato-nigre`, and `observatorio-del-prophetias`. Region-owned locations and local routes are distinct from the top-level inter-region route graph:

```json
{
  "regions": {
    "region-id": {
      "regionName": "Visible name",
      "description": "Visible description",
      "entryExitPoints": {
        "N": "location-id",
        "NE": "location-id",
        "E": "location-id",
        "SE": "location-id",
        "S": "location-id",
        "SW": "location-id",
        "W": "location-id",
        "NW": "location-id"
      },
      "locations": {
        "location-id": {
          "name": "Visible name",
          "description": "Visible description",
          "latitude": 0,
          "longitude": 0,
          "elevationMeters": 0
        }
      },
      "routes": [
        {
          "name": "Visible route name",
          "between": ["location-a", "location-b"],
          "travelTime": 10,
          "elevationChangeMeters": 5
        }
      ]
    }
  },
  "interRegionRoutes": [
    {
      "routeName": "Visible route name",
      "between": ["region-a", "region-b"],
      "directions": {
        "region-a": "N",
        "region-b": "S"
      },
      "travelTime": 1800
    }
  ]
}
```

The canonical directions are `N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, and `NW`. Every region maps exactly those eight directions to location IDs it owns. Values need not be unique: one location may serve several directions, and a region may use one location for all eight. Inter-regional `directions` keys exactly match the two region IDs in `between`; an endpoint resolves as `route.directions[regionId]` → `region.entryExitPoints[direction]` → `region.locations[locationId]`. The route never duplicates endpoint location IDs.

The authored entry/exit mappings are:

```text
Sheol
N  Campo del Ultime Pensamentos   NE Halito de Sheol
E  Halito de Sheol                SE Costa Final
S  Costa Final                    SW Costa Final
W  Descenso del Sibylla           NW Descenso del Sibylla

Mercato Nigre
N, NE, E, SE, S, SW, W, NW → Porta del Mercatores

Observatorio del Prophetias
N  Oculo del Zenith               NE Porta del Celo
E  Porta del Celo                 SE Turre del Polo
S  Turre del Polo                 SW Circulo del Horizonte
W  Oculo del Zenith               NW Oculo del Zenith
```

Sheol and Observatorio use coordinate-authoritative authored mappings. They are not recalculated at runtime or influenced by elevation. Mercato Nigre intentionally overrides coordinate extrema: Porta del Mercatores is its controlled universal gateway. The validator has no Mercato-specific branch; repeated values are valid configuration everywhere.

Validation remains generic. It requires exact shapes, lowercase kebab-case IDs, unique region display names, exact canonical directions, finite coordinates and elevations, positive safe-integer `travelTime` values, non-negative finite local elevation changes, valid endpoint references, no self-routes or reverse duplicates, a connected local graph within every region, and one connected global region graph. Location IDs remain scoped to their region. The world and nomenclature loaders share one secure JSON transport helper while retaining separate strict schema validation. They accept only `fetchFn` and `baseUrl`, always request fixed same-origin paths with `{ cache: "no-cache", redirect: "error" }`, and reject non-HTTP(S) bases, redirected/cross-origin responses, missing or malformed JSON, and unsupported source overrides.

The immutable initial state is `{ regionId: "sheol", locationId: "bucca-de-sheol" }`. Locus displays Sheol, Le Bucca de Sheol, its existing world-of-the-living entrance description, and elevation `1 metro`. Bucca is not present in Sheol's `entryExitPoints`; it is a normal local location and is not a gateway to another configured region. The world of the living has no region, route, or special movement mechanic.

Rutas initially lists the three local routes connected to Bucca, in configured order: Le Via del Sibylla, Le Via del Desiro, and Le Passage Submergite. Each card uses the unified `travelTime` property and fixed Interlingua `Duration del viage` label with `minutas fictional` units. Elevations use deterministic application-owned `metro`/`metros` wording rather than runtime unit localization. The inter-regional section still shows Le Via del Obolo Nigre even though Bucca is not its gateway: its Sheol exit is Le Campo del Ultime Pensamentos (N), and its Mercato entry is Le Porta del Mercatores (S). Le Via del Signos Celestial resolves from Le Porta del Mercatores (N) to Le Turre del Polo (S), but is not displayed from Sheol. There remains no direct Sheol–Observatorio route.

Latitude and longitude remain available in configuration and the immutable browser runtime context but are intentionally not rendered. Both graphs are read-only. There are no travel controls, movement APIs, arrival times, countdowns, persistence, discovery state, route availability, route planning, shortest-path calculations, graphical maps, or inferred gateways.

## Fixed interface language

All generic user-facing text is fixed Interlingua with language tag `ia`. `public/interface-text.js` exports immutable messages and named templates for navigation accessibility, section and progress labels, page descriptions, configuration errors, renderer prose, and units. There is no runtime language selection, registry, fallback, schema, fetch, browser-language detection, cookie, storage value, or request header. Query strings do not affect interface language or generated navigation links.

Generic interface wording remains separate from configured in-universe terminology. Application, navigation-group, page, page-section, calendar, season, tide, celestial-body, Outcome-type, region, location, and route names/descriptions continue to come only from `public/config/nomenclature.json` or `public/regions/world.json`.

## Fixed nomenclature

The browser always loads the single production nomenclature file from the fixed same-origin URL `/config/nomenclature.json`. It uses schema 12. Editing and redeploying this file is sufficient to rename the application, navigation groups, pages, page sections, outcome classifications, calendar names, seasons, lunar phases, tides, celestial bodies and symbols, and Orbital Pulls. Location world data is deliberately separate in `/regions/world.json`.

The active configured terms include:

- Application: Insidia
- Navigation groups: Almanac (`navigation-group-01`), Personage (`navigation-group-02`), Location (`navigation-group-03`)
- Pages: Calendario, Destino, Tempore, Identitate, Inventario, Subordinatos, Locus, Rutas, Explorar
- Page sections: Titulo, Nomine, Epitheto, Equipamento, Observationes, Decisiones, Memorias, Campiones, Miniones, Deposito
- Location world data: excluded from nomenclature and loaded from the fixed three-region world configuration
- Outcome types: Commune, Infrequens, Rarum
- Calendar year: Annus Solis
- Lunar cycle: Cyclus Lunae
- Month reign: Regno de; rulers Orgolio, Rabia, Gula, Invidia, Avaritia, Vanitate, Luxuria, Pigritia
- Reign ordinals: Prime, Secunde, Tertie, Quarte, Quinte, Sexte, Septime, Octave, None, Decime, Undecime
- Weekdays: Dies Lunae, Dies Martis, Dies Mercurii, Dies Iovis, Dies Veneris, Dies Saturni, Dies Solis
- Named calendar days: Kalendis, Nonis, Idibus, Liminis, Interregis
- Interregnos: Primus through Undecimus Interregno
- Seasons: Ossos, Lacrimas
- Lunar phases: Renascimento, Corno, Falce, Passage, Ascrescimento, Crescente, Ascenso, Apice, Morditura, Decrescente, Recedente, Velo, Morte
- Tides: Marea basse, Marea alte, Marea dividite
- Orbital Pulls: Attraction dominante, Attraction minor, Attraction divergente
- Celestial bodies: ☿ Mercurius, ♀ Venus, ♂ Mars, ♃ Jupiter, ♄ Saturnus, ☾ Luna

These terms are configurable in-universe nomenclature and are independent of the fixed Interlingua interface. Validation requires every canonical ID in canonical order and exact entity shapes. It rejects missing, duplicate, unknown, reordered, empty, non-string, extra, interface-copy, and mechanical fields. Page routes and navigation hierarchy remain fixed application infrastructure; visible page and navigation-group names come from nomenclature and never generate routes.

The presentation context clones and deeply freezes nomenclature entities and exposes stable getters for navigation groups, pages, page sections, outcome types, calendar entities, seasons, lunar phases, tides, celestial bodies, and Pulls. The separate location context clones and deeply freezes the world, state, regions, entry/exit maps, locations, local routes, inter-region directions, and resolved endpoint objects; its private Maps and Sets are not exposed. The API requires explicit region IDs, validates canonical directions, rejects cloned or foreign route objects, resolves local destinations and physical inter-region endpoints symmetrically, and never mutates the authored JSON.

## Calendario presentation

Calendario renders the configured calendar year using uppercase Roman numerals. Its date title is:

```text
Annus Solis {romanYear} · {currentSeasonName}
```

The second line is `{weekdayName} {dayDesignation} · {periodName}`. Month days 1, 7, 15, and 23 use Kalendis, Nonis, Idibus, and Liminis; other month days use uppercase Roman numerals. An Interregno uses Interregis on its first day and Roman numerals afterward. The first reign of a ruler in a year omits Prime from its visible name; later reigns include the configured ordinal.

The lunar card contains exactly one visible line:

```text
Cyclus Lunae {cycleRoman} · {phaseName}
```

For the representative state it reads `Cyclus Lunae MCCXXXIV · Morditura`. This visible card uses one U+00B7 middle dot. The separate display/JSON combined lunar summary remains `Morditura • Cyclus Lunae MCCXXXIV` and continues to use the bullet separator.

## Destino outcomes

Outcome names are schema-12 nomenclature, not translations:

- `outcome-tier-01` → Commune
- `outcome-tier-02` → Infrequens
- `outcome-tier-03` → Rarum

Destino renders `Destino Commune`, `Destino Infrequens`, or `Destino Rarum` with one space and no colon. Raw mechanical Outcome state remains neutral and unchanged.

Attempts text uses fixed Interlingua surrounding prose while resolving Rarum through nomenclature:

```text
Tentativas usque a Rarum: 100
```

## Mechanics

- Epoch: `1970-01-01T00:00:00.000Z`
- 997 real milliseconds = 1 calendar fictional second
- 59 calendar seconds = 1 minute; 61 minutes = 1 hour; 23 hours = 1 day
- 7 days = 1 week
- 11 × 29-day months, ten 3-day Interregnos, and one 4-day final Interregno = 353 days
- 1009 real milliseconds = 1 lunar second
- 59 lunar seconds = 1 lunar minute; 67 lunar minutes = 1 lunar hour
- 31 lunar hours = 1 lunar day; 13 lunar days = 1 lunar cycle
- Tides span 17, 13, and 1 lunar hours, filling one lunar day
- Commune lasts through 85% of the current tide, Infrequens above 85% through 99%, and Rarum above 99%
- Two continuous 179-day seasons form a 358-day cycle
- Six deterministic circular orbits feed three ranked three-body Pulls

Month rulers are selected at 22:00:00 on the final day of the preceding Interregno. Ossos and Lacrimas advance independent persistent four-ruler rotations. Pigritia alternates between governing and declining its regular Ossos opportunities; a declined opportunity can select a configured replacement from orbital progress at the inclusive 95% threshold. Raw month state preserves opportunity, regular, and effective ruler IDs and the complete deterministic decision seam. Reign ordinals count final effective rulers within the year and reset at the year boundary without resetting either rotation.

All mechanics are deterministic browser-side calculations. Calendar and lunar elapsed seconds are independently recomputed from `Date.now()` and the epoch. The complete `calculateCalendarState()` API and Calendar JSON v20 shape remain unchanged, while named page calculators avoid unrelated work:

- Calendario calculates calendar date/rulership, current season ID, and lunar cycle/phase. It schedules at the earlier next calendar-day or lunar-day boundary.
- Tempore calculates the two clocks, season, and only lunar-day/day/hour/season progress. It schedules at the earlier next calendar-second or lunar-second boundary.
- Destino calculates lunar/tide state, bodies/Pulls, Outcome, and tide progress. It uses the same second-boundary cadence as Tempore.

The generic scheduler keeps one recursive epoch-relative timeout, clears it while the document is hidden, renders immediately when visibility returns, and never uses `setInterval`. Current-month rulership replays are bounded by a one-entry absolute-month memo whose callers always receive fresh deep clones. No mutable clock counter, server time API, persistent history, or browser storage participates.

## Architecture and request topology

1. `public/core/` contains deeply immutable numeric rules, full mechanics, and the three focused page calculators.
2. `public/config-loader.js` owns fixed-path same-origin HTTP(S) JSON transport; the schema-12 nomenclature and schema-3 world loaders validate their own data separately.
3. `public/interface-text.js` and `public/nomenclature.js` combine fixed Interlingua templates with deeply frozen configured terminology.
4. `public/page-definitions.js` owns all fixed routes and immutable Personage/Almanac/Location membership and order.
5. `public/app-bootstrap.js` loads nomenclature, renders common document presentation/navigation, and bootstraps static/configured pages. It does not import live state or mechanics.
6. `public/live-page-bootstrap.js` connects a live page's focused calculator, renderer, immutable cadence list, and `live-state.js` scheduler.
7. `public/static-page.js` and `public/location-page.js` are the only shared entry modules for their respective static page classes.

Normal pages make exactly one configuration request: `/config/nomenclature.json`. Locus and Rutas make exactly two concurrent configuration requests: `/config/nomenclature.json` and `/regions/world.json`, with no request waterfall. Navigation itself introduces no world request. Its two generated rows—the three top groups and the active three-page secondary group—remain inside the same sticky site header.

The public schemas are intentionally unchanged: Calendar JSON v20, nomenclature schema 12, and world schema 3.

The project has no frontend framework, build system, runtime dependency, database, backend time API, WebSocket, authentication, external font, date library, server-side rendering, service worker, geolocation integration, or external map integration.

## Calendar JSON v20

`createCalendarJson()` remains a public serialization API even though no page exposes a visible JSON or clipboard control. Its top-level fields are:

- `calendarVersion: "v20"`
- `nomenclature`: schema version 12 and application display name
- `source`: Unix milliseconds and ISO UTC
- `state`: raw canonical IDs and numeric mechanics without configured names or symbols
- `display`: configured entities, fixed Interlingua prose, and formatted values

The schema contains no language metadata. The raw Outcome thresholds and IDs did not change. Lunar display retains `cycleName`, `formattedCycle`, and the separate bullet-form `formattedSummary`.

## Server

| Route | Purpose |
|---|---|
| `/` | Redirect to `/calendario.html`; query parameters are ignored |
| Nine page routes | Static HTML described above |
| `/config/nomenclature.json` | Single read-only nomenclature configuration |
| `/regions/world.json` | Sole read-only three-region world and route graph |
| `/health` | `{"ok":true,"version":"v8.25"}` |

The built-in-module Node server supports GET and HEAD, explicit MIME types, `Cache-Control: no-cache` for HTML/CSS/JavaScript/JSON, deterministic weak ETags, Last-Modified validation, bodyless 304 responses, CSP and related security headers, safe traversal/dotfile rejection, Interlingua response bodies for HTTP errors, canonical HTTPS redirects, and graceful shutdown. Static page additions and removals require no route-specific handlers.

## Editing configuration

When editing nomenclature, retain schema 12, all canonical IDs, canonical ordering, and exact entity shapes. Keep generic interface text, UI templates, location data, routes, submenu membership, durations, orbital periods, thresholds, priorities, and other mechanics out of the file.

When editing generic interface wording, update `public/interface-text.js`, preserve every named placeholder, and keep all nomenclature- and world-owned names out of it.

When editing `world.json`, retain the exact schema above and validate both levels independently: every region must keep all eight entry/exit directions and a connected location graph, while the inter-region graph must keep all regions connected. Direction values resolve through the owning region; do not duplicate endpoint IDs on inter-region routes or encode movement state.

Run `npm test` before deployment.

## Project structure

```text
package.json
package-lock.json
server.js
public/
  app-bootstrap.js
  live-page-bootstrap.js
  static-page.js
  location-page.js
  config-loader.js
  version.js
  calendario.html
  calendario-page.js
  destino.html
  destino-page.js
  tempore.html
  tempore-page.js
  identitate.html
  inventario.html
  subordinatos.html
  locus.html
  rutas.html
  location-bootstrap.js
  location-renderers.js
  location-state.js
  location.js
  world-loader.js
  explorar.html
  styles.css
  page-definitions.js
  interface-text.js
  nomenclature-loader.js
  nomenclature.js
  presentation.js
  live-state.js
  renderers.js
  config/nomenclature.json
  regions/world.json
  core/{rules,mechanics,formatting}.js
test/
  helpers.js
  architecture.test.js
  live-state.test.js
  state-baseline.test.js
  core.test.js
  layout.test.js
  loaders.test.js
  location.test.js
  lunar-clock.test.js
  month-rulership.test.js
  presentation.test.js
  server.test.js
```

## Deployment

The included `Procfile` runs `npm start`; Node remains pinned through `.nvmrc` and `package.json`. No deployment credentials or GitHub Actions workflow are stored in the repository.

## License

Released under the [MIT License](LICENSE).
