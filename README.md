# Insidia

Insidia v8.21 is a browser-calculated fictional calendar and world-state interface. It has three live pages, four generic static pages, and two read-only location pages backed by the Sheol region configuration. The Node.js backend only redirects `/`, serves static files, and exposes `/health`; it performs no fictional-time or location calculations.

## Run locally

Node.js 24 is the supported runtime. There are no runtime dependencies or build step.

```sh
npm ci
npm test
npm start
```

Open [http://localhost:3000](http://localhost:3000). Set `PORT` to override port 3000.

## Pages and navigation

The page registry contains exactly nine stable IDs, fixed routes, and nomenclature-owned names. Every page uses the same sticky navigation structure and preserves only the resolved `locale` query value in its links.

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
| `page-08` | Rutas | `/rutas.html` | Read-only routes directly connected to the current location |
| `page-09` | Explorar | `/explorar.html` | Static exploration observations shell |

The static section shells are intentionally empty apart from their configured headings:

- Identitate: Titulo, Nomine, Epitheto, Memorias, Decisiones
- Inventario: Equipamento, Deposito
- Subordinatos: Campiones, Miniones
- Locus: Sheol and the current configured location, Le Campo del Ultime Pensamentos
- Rutas: the one directly connected route, Le Sentiero del Ultime Pensamentos
- Explorar: Observationes

Mappa, Pensamentos, Commandamento, Investigationes, and Ordines were removed. Observationes and Decisiones now exist only as sections on Explorar and Identitate respectively. Their former HTML routes and page modules, `/mappa.html`, `/mappa-page.js`, `/location.html`, the former Personage route, and the other legacy routes have no redirects, aliases, or compatibility files and return ordinary static 404 responses.

Location pages do not use browser geolocation, request location permission, display coordinates, or load a graphical map, iframe, route provider, external map provider, or map tiles.

The four generic static pages use `bootstrapStaticPage()`. Locus and Rutas use the shared configured-static bootstrap so locale, nomenclature, and region configuration begin loading concurrently. All six share titles, descriptions, navigation, footer presentation, accessibility state, and configuration-error handling with the live pages, but do not start the live calendar scheduler or create a recurring timer.

## Sheol location graph

`public/regions/sheol.json` is the only region configuration. Schema version 1 contains seven locations and eight undirected walking routes; its `regions` array remains empty, and no inter-region or child-region behavior exists.

The isolated initial read-only state selects `campo-del-ultime-pensamentos` in Sheol. Locus displays the region description, current location description, and elevation. Rutas filters the graph to routes directly connected to that location, which currently yields only Le Sentiero del Ultime Pensamentos to Le Descenso del Sibylla: 10 fictional minutes and 5 meters of authored elevation change.

Latitude and longitude remain available in configuration and the immutable browser runtime context but are intentionally not rendered. The graph is read-only: there are no travel controls, movement, arrival times, countdowns, persistence, discovery state, route planning, or shortest-path calculations.

## Locale selection

Locale is the only presentation option accepted through the query string:

```text
/calendario.html?locale=en
/destino.html?locale=es
/identitate.html?locale=es
/locus.html?locale=en
/explorar.html?locale=es
```

English is the default. English and Spanish paths are allowlisted in `public/locale-loader.js`. Unknown IDs resolve safely to English; a known malformed locale stops bootstrap visibly. Query values never become file paths. There is no runtime universe selector, alternate world configuration, cookie, local-storage setting, header, route, or configurable frontend path for changing in-game nomenclature.

Locale schema 11 contains exactly `schemaVersion`, `id`, `languageTag`, `messages`, and `templates`. Locale files own generic language such as Current Location / Ubicación actual, Elevation / Elevación, route metadata labels, localized descriptions, and surrounding prose. They do not own page names, navigation-group names, page-section names, region/location/route names or descriptions, Outcome-type names, or other fixed in-universe terms.

## Fixed nomenclature

The browser always loads the single production nomenclature file from the fixed same-origin URL `/config/nomenclature.json`. It uses schema 12. Editing and redeploying this file is sufficient to rename the application, navigation groups, pages, page sections, outcome classifications, calendar names, seasons, lunar phases, tides, celestial bodies and symbols, and Orbital Pulls. Location world data is deliberately separate in `/regions/sheol.json`.

The active configured terms include:

- Application: Insidia
- Navigation groups: Almanac (`navigation-group-01`), Personage (`navigation-group-02`), Location (`navigation-group-03`)
- Pages: Calendario, Destino, Tempore, Identitate, Inventario, Subordinatos, Locus, Rutas, Explorar
- Page sections: Titulo, Nomine, Epitheto, Equipamento, Observationes, Decisiones, Memorias, Campiones, Miniones, Deposito
- Location world data: excluded from nomenclature and loaded from the fixed Sheol region configuration
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

These terms are fixed in-universe nomenclature and remain identical in English and Spanish. Validation requires every canonical ID in canonical order and exact entity shapes. It rejects missing, duplicate, unknown, reordered, empty, non-string, extra, localized, and mechanical fields. Page routes and navigation hierarchy remain fixed application infrastructure; visible page and navigation-group names come from nomenclature and never generate routes.

The presentation context clones and deeply freezes nomenclature entities and exposes stable getters for navigation groups, pages, page sections, outcome types, calendar entities, seasons, lunar phases, tides, celestial bodies, and Pulls. The separate location context clones and deeply freezes the region graph, state, locations, and routes; its internal indexes are not exposed.

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

Destino renders `Destino Commune`, `Destino Infrequens`, or `Destino Rarum` with one space and no colon. Both locales expose the same display entity. Raw mechanical Outcome state remains neutral and unchanged.

Attempts text keeps localized surrounding prose while resolving Rarum through nomenclature:

```text
Attempts until Rarum: 100
Intentos hasta Rarum: 100
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

All mechanics are deterministic browser-side calculations. Calendar and lunar elapsed seconds are independently recomputed from `Date.now()` and the epoch. Live pages recursively schedule one timer near the earlier next 997 ms or 1009 ms boundary, recalculate the full state on every update, and recalculate immediately when the page becomes visible. No mutable clock counter, server time API, persistent history, or browser storage participates.

## Architecture and request topology

1. `public/core/` contains immutable numeric rules and presentation-neutral mechanics.
2. `public/config/nomenclature.json` contains the single schema-12 in-game vocabulary, excluding locations.
3. `public/locales/` contains schema-11 generic UI messages and templates.
4. `public/presentation-context-loader.js` starts exactly one locale request and one nomenclature request concurrently.
5. `public/nomenclature.js` builds the frozen presentation context.
6. `public/region-loader.js` validates the fixed same-origin `/regions/sheol.json` graph.
7. `public/location.js` builds the frozen read-only location context.
8. `public/app-bootstrap.js` applies common document presentation, then either starts live state or completes a generic/configured static page.

Every page starts locale and nomenclature requests concurrently. Locus and Rutas additionally start the Sheol region request at the same time, with no request waterfall; all other pages make exactly the original two configuration requests. Navigation itself introduces no region request. Its two visible rows—the top groups and one secondary group—remain inside the same sticky site header.

The project has no frontend framework, build system, runtime dependency, database, backend time API, WebSocket, authentication, external font, date library, server-side rendering, service worker, geolocation integration, or external map integration.

## Calendar JSON v19

`createCalendarJson()` remains a public serialization API even though no page exposes a visible JSON or clipboard control. Its top-level fields are:

- `calendarVersion: "v19"`
- `nomenclature`: schema version 12 and application display name
- `locale`: requested/resolved IDs, language tag, and schema version 11
- `source`: Unix milliseconds and ISO UTC
- `state`: raw canonical IDs and numeric mechanics without configured names or symbols
- `display`: configured entities, localized prose, and formatted values

English and Spanish JSON snapshots have identical raw state and identical `display.outcomeType` entities. The raw Outcome thresholds and IDs did not change. Lunar display retains `cycleName`, `formattedCycle`, and the separate bullet-form `formattedSummary`.

## Server

| Route | Purpose |
|---|---|
| `/` | Redirect to `/calendario.html`, preserving only a non-empty locale |
| Nine page routes | Static HTML described above |
| `/config/nomenclature.json` | Single read-only nomenclature configuration |
| `/regions/sheol.json` | Single read-only seven-location Sheol graph |
| `/locales/en.json`, `/locales/es.json` | Allowlisted locale files |
| `/health` | `{"ok":true,"version":"v8.21"}` |

The built-in-module Node server supports GET and HEAD, explicit MIME types, `Cache-Control: no-cache` for HTML/CSS/JavaScript/JSON, deterministic weak ETags, Last-Modified validation, bodyless 304 responses, CSP and related security headers, safe traversal/dotfile rejection, generic errors, canonical HTTPS redirects, and graceful shutdown. Static page additions and removals require no route-specific handlers.

## Editing configuration

When editing nomenclature, retain schema 12, all canonical IDs, canonical ordering, and exact entity shapes. Keep translations, UI templates, location data, routes, submenu membership, durations, orbital periods, thresholds, priorities, and other mechanics out of the file.

When adding a locale, translate every required message and template, retain the exact schema-11 top-level shape, add its fixed same-origin path to `LOCALE_FILES`, and do not duplicate nomenclature- or region-owned names.

Run `npm test` before deployment.

## Project structure

```text
package.json
package-lock.json
server.js
public/
  app-bootstrap.js
  calendario.html
  calendario-page.js
  destino.html
  destino-page.js
  tempore.html
  tempore-page.js
  identitate.html
  identitate-page.js
  inventario.html
  inventario-page.js
  subordinatos.html
  subordinatos-page.js
  locus.html
  locus-page.js
  rutas.html
  rutas-page.js
  location-bootstrap.js
  location-renderers.js
  location-state.js
  location.js
  region-loader.js
  explorar.html
  explorar-page.js
  styles.css
  page-definitions.js
  presentation-context-loader.js
  nomenclature-loader.js
  nomenclature.js
  locale-loader.js
  presentation.js
  live-state.js
  renderers.js
  config/nomenclature.json
  regions/sheol.json
  locales/{en,es}.json
  core/{rules,mechanics,formatting}.js
test/
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
