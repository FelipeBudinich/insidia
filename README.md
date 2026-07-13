# Insidia

Insidia v8.17 is a browser-calculated fictional calendar and world-state interface. It has three live pages and four configuration-driven static pages, one fixed in-game nomenclature configuration, and localized generic UI language. The Node.js backend only redirects `/`, serves static files, and exposes `/health`; it performs no fictional-time calculations.

## Run locally

Node.js 24 is the supported runtime. There are no runtime dependencies or build step.

```sh
npm ci
npm test
npm start
```

Open [http://localhost:3000](http://localhost:3000). Set `PORT` to override port 3000.

## Pages and navigation

The page registry contains exactly seven stable IDs, fixed routes, and nomenclature-owned names. Every page renders all seven configured names in the same responsive navigation and preserves only the resolved `locale` query value in its links.

| ID | Name | Route | Behavior |
|---|---|---|---|
| `page-01` | Calendario | `/calendario.html` | Live calendar, season title, and lunar summary |
| `page-02` | Destino | `/destino.html` | Live outcome, tide, Pull, orbit, and progress state |
| `page-03` | Tempore | `/tempore.html` | Live calendar/lunar clocks, season, and progress |
| `page-04` | Personage | `/personage.html` | Static character-section shell |
| `page-05` | Pensamentos | `/pensamentos.html` | Static thought-section shell |
| `page-06` | Commandamento | `/commandamento.html` | Static command-section shell |
| `page-07` | Mappa | `/mappa.html` | Static configured current location |

The static section shells are intentionally empty apart from their configured headings:

- Personage: Titulo, Nomine, Epitheto, Equipamento, Inventario
- Pensamentos: Observationes, Decisiones, Investigationes, Memorias
- Commandamento: Ordines, Campiones, Miniones
- Mappa: the current configured location, Santiago

Mappa does not use browser geolocation, request location permission, display coordinates, or load a graphical map, iframe, external provider, or map tiles.

The four static pages use `bootstrapStaticPage()`. They share locale/nomenclature loading, titles, descriptions, navigation, footer presentation, accessibility state, and configuration-error handling with the live pages, but do not start the live calendar scheduler or create a recurring timer.

## Locale selection

Locale is the only presentation option accepted through the query string:

```text
/calendario.html?locale=en
/destino.html?locale=es
/personage.html?locale=es
/mappa.html?locale=en
```

English is the default. English and Spanish paths are allowlisted in `public/locale-loader.js`. Unknown IDs resolve safely to English; a known malformed locale stops bootstrap visibly. Query values never become file paths. There is no runtime universe selector, alternate world configuration, cookie, local-storage setting, header, route, or configurable frontend path for changing in-game nomenclature.

Locale schema 8 contains exactly `schemaVersion`, `id`, `languageTag`, `messages`, and `templates`. Locale files own generic language such as Current Location / Ubicación actual and localized surrounding prose. They do not own page names, page-section names, current-location names, Outcome-type names, or other fixed in-universe terms.

## Fixed nomenclature

The browser always loads the single production nomenclature file from the fixed same-origin URL `/config/nomenclature.json`. It uses schema 8. Editing and redeploying this file is sufficient to rename the application, pages, page sections, current location, outcome classifications, calendar names, seasons, lunar phases, tides, celestial bodies and symbols, and Orbital Pulls.

The active configured terms include:

- Application: Insidia
- Pages: Calendario, Destino, Tempore, Personage, Pensamentos, Commandamento, Mappa
- Page sections: Titulo, Nomine, Epitheto, Equipamento, Inventario, Observationes, Decisiones, Investigationes, Memorias, Ordines, Campiones, Miniones
- Current location: Santiago (`location-01`)
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

These terms are fixed in-universe nomenclature and remain identical in English and Spanish. Validation requires every canonical ID in canonical order and exact entity shapes. It rejects missing, duplicate, unknown, reordered, empty, non-string, extra, localized, and mechanical fields. Routes remain fixed application infrastructure in `public/page-definitions.js`; they are never generated from configured names.

The presentation context clones and deeply freezes configured entities. It exposes stable getters for pages, page sections, outcome types, calendar entities, seasons, lunar phases, tides, celestial bodies, and Pulls, plus the frozen current location.

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

Outcome names are schema-8 nomenclature, not translations:

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
2. `public/config/nomenclature.json` contains the single schema-8 in-game vocabulary.
3. `public/locales/` contains schema-8 generic UI messages and templates.
4. `public/presentation-context-loader.js` starts exactly one locale request and one nomenclature request concurrently.
5. `public/nomenclature.js` builds the frozen presentation context.
6. `public/app-bootstrap.js` applies common document presentation, then either starts live state or completes a static page.

Every page uses the same two concurrent configuration requests. The new pages introduce no page-specific configuration request.

The project has no frontend framework, build system, runtime dependency, database, backend time API, WebSocket, authentication, external font, date library, server-side rendering, service worker, geolocation integration, or external map integration.

## Calendar JSON v19

`createCalendarJson()` remains a public serialization API even though no page exposes a visible JSON or clipboard control. Its top-level fields are:

- `calendarVersion: "v19"`
- `nomenclature`: schema version 8 and application display name
- `locale`: requested/resolved IDs, language tag, and schema version 8
- `source`: Unix milliseconds and ISO UTC
- `state`: raw canonical IDs and numeric mechanics without configured names or symbols
- `display`: configured entities, localized prose, and formatted values

English and Spanish JSON snapshots have identical raw state and identical `display.outcomeType` entities. The raw Outcome thresholds and IDs did not change. Lunar display retains `cycleName`, `formattedCycle`, and the separate bullet-form `formattedSummary`.

## Server

| Route | Purpose |
|---|---|
| `/` | Redirect to `/calendario.html`, preserving only a non-empty locale |
| Seven page routes | Static HTML described above |
| `/config/nomenclature.json` | Single read-only nomenclature configuration |
| `/locales/en.json`, `/locales/es.json` | Allowlisted locale files |
| `/health` | `{"ok":true,"version":"v8.17"}` |

The built-in-module Node server supports GET and HEAD, explicit MIME types, `Cache-Control: no-cache` for HTML/CSS/JavaScript/JSON, deterministic weak ETags, Last-Modified validation, bodyless 304 responses, CSP and related security headers, safe traversal/dotfile rejection, generic errors, canonical HTTPS redirects, and graceful shutdown. It has no special handlers for the four new pages.

## Editing configuration

When editing nomenclature, retain schema 8, all canonical IDs, canonical ordering, and exact entity shapes. Keep translations, UI templates, routes, durations, orbital periods, thresholds, priorities, and other mechanics out of the file.

When adding a locale, translate every required message and template, retain the exact schema-8 top-level shape, add its fixed same-origin path to `LOCALE_FILES`, and do not duplicate nomenclature-owned names.

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
  personage.html
  personage-page.js
  pensamentos.html
  pensamentos-page.js
  commandamento.html
  commandamento-page.js
  mappa.html
  mappa-page.js
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
  locales/{en,es}.json
  core/{rules,mechanics,formatting}.js
test/
  core.test.js
  layout.test.js
  loaders.test.js
  lunar-clock.test.js
  month-rulership.test.js
  presentation.test.js
  server.test.js
```

## Deployment

The included `Procfile` runs `npm start`; Node remains pinned through `.nvmrc` and `package.json`. No deployment credentials or GitHub Actions workflow are stored in the repository.

## License

Released under the [MIT License](LICENSE).
