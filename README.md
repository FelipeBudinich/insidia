# Insidia

Insidia v8.11 is a live fictional calendar with independent calendar and lunar clocks, one active in-game nomenclature configuration, and localized generic UI language. All calculations run in the browser from `Date.now()`; the Node.js server only serves static files, redirects `/`, and exposes `/health`.

## Run locally

Node.js 24 is the supported runtime. There are no runtime dependencies or build step.

```sh
npm ci
npm test
npm start
```

Open [http://localhost:3000](http://localhost:3000). Set `PORT` to override port 3000.

## Locale selection

Locale is the only presentation option accepted through the query string:

```text
/calendario.html?locale=en
/destino.html?locale=en
/tempore.html?locale=es
```

English is the default. Supported locale IDs and their fixed same-origin paths are allowlisted directly in `public/locale-loader.js`; `/locales/index.json` no longer exists. Unknown locale IDs resolve safely to English, while known malformed locale files stop bootstrap visibly. Query values never become file paths. Navigation preserves only the resolved `locale` value and drops unrelated parameters.

There is no universe selector, universe query parameter, alternate world configuration, cookie, local-storage setting, header, route, or configurable frontend path for changing in-game nomenclature.

## One fixed nomenclature configuration

The only production nomenclature file is:

```text
public/config/nomenclature.json
```

The browser always loads it from the fixed same-origin URL `/config/nomenclature.json`. Editing this file and redeploying is sufficient to rename the application/world, the month-reign system, weekdays, Inter Regna, seasons, lunar phases, tides, celestial bodies and symbols, and Orbital Pulls. JavaScript and HTML changes are not required.

The configured terms are fixed in-universe proper nouns, not English or Spanish translations. The active v8.11 configuration includes:

- Calendar year name: Annus Solis
- Lunar cycle name: Cyclus Lunae
- Month reign: Regno de; rulers Orgolio, Rabia, Gula, Invidia, Avaritia, Vanitate, Luxuria, Pigritia
- Reign ordinals: Prime, Secunde, Tertie, Quarte, Quinte, Sexte, Septime, Octave, None, Decime, Undecime
- Weekdays: Dies Lunae, Dies Martis, Dies Mercurii, Dies Iovis, Dies Veneris, Dies Saturni, Dies Solis
- Lunar phases: Renascimento, Corno, Falce, Passage, Ascrescimento, Crescente, Ascenso, Apice, Morditura, Decrescente, Recedente, Velo, Morte
- Tides: Marea basse, Marea alte, Marea dividite
- Seasons: Ossos, Lacrimas
- Orbital Pulls: Attraction dominante, Attraction minor, Attraction divergente
- Celestial bodies: ☿ Mercurius, ♀ Venus, ♂ Mars, ♃ Jupiter, ♄ Saturnus, ☾ Luna

These names and symbols are loaded exclusively from `public/config/nomenclature.json` and remain identical when the locale changes.

Weekday, month-ruler, and reign-ordinal entities use exactly `{ id, name }`; they have no `shortName` or symbol. Their complete canonical neutral ID sets and ordering must be retained. Static month names are not configured: each visible month name is derived from its ruler and its ruler's reign number within that year.

Calendario renders visible years and period days with uppercase Roman numerals. Its two-line date header is `Annus Solis {romanYear}` followed by `{weekdayName} · {romanDay} {periodName}`. A ruler's first month in a year is named `Regno de {ruler}`; later months use `{ordinal} Regno de {ruler}`. `Prime` remains structured nomenclature but is deliberately omitted from the first visible reign name. Inter Regnum names continue to resolve directly from nomenclature. English and Spanish show the same in-universe date.

The lunar Calendario card mirrors the date card's two-line hierarchy. Its title is the configured lunar-cycle name plus Roman cycle number, and its subtitle is the configured current phase name. For lunar cycle 1234, it displays `Cyclus Lunae MCCXXXIV` above `Morditura`. Both lines come from presentation-ready nomenclature data and remain identical in English and Spanish. The combined `Morditura • Cyclus Lunae MCCXXXIV` summary remains available in the display and Calendar JSON v15 APIs, while lunar day and cycle-length values remain in raw state.

Calendario, Destino, and Tempore are in-game page proper nouns stored in the same file under stable page IDs. Locale changes never translate them. Their routes are fixed application infrastructure and are not generated from the configured names.

The nomenclature file contains names and symbols only. Validation requires complete canonical ID coverage and rejects missing, duplicate, unknown, empty, or non-string entities; wrong schema versions; Outcome types; locale messages or templates; and mechanical fields such as durations, orbital periods, priorities, and thresholds. A missing, malformed, or invalid file stops live rendering and shows the accessible configuration-error view—there are no hard-coded or partial fallbacks.

Outcome-type names are generic language classifications owned by locale files:

- English: Common, Uncommon, Rare
- Spanish: Común, Poco común, Raro

Changing locale translates Outcome types and generic UI prose without changing configured proper nouns, symbols, IDs, or numeric state.

## Mechanics

- 997 real milliseconds = 1 calendar fictional second
- 59 calendar fictional seconds = 1 calendar minute; 61 calendar minutes = 1 calendar hour; 23 calendar hours = 1 calendar day
- 1009 real milliseconds = 1 lunar second
- 59 lunar seconds = 1 lunar minute; 67 lunar minutes = 1 lunar hour
- A lunar hour lasts 3,988,577 real milliseconds and is distinct from the 61-minute calendar hour
- 31 lunar hours = 1 lunar day; 13 lunar days = 1 lunar cycle
- Each lunar day is divided into tides lasting 17, 13, and 1 lunar hours, which together fill all 31 lunar hours
- 7 days = 1 week
- 11 × 29-day months, ten 3-day Inter Regna, and one 4-day final Inter Regnum = 353 days
- Eight rulers rotate across calendar months without resetting at year boundaries. Pigritia governs its first regular opportunity, declines its next, returns for the following one, and continues alternating that way indefinitely. The exact repeating 15-month effective sequence is Orgolio, Rabia, Gula, Invidia, Avaritia, Vanitate, Luxuria, Pigritia, Orgolio, Rabia, Gula, Invidia, Avaritia, Vanitate, Luxuria. The next block begins with the single Orgolio reign that replaces Pigritia's skipped regular opportunity, followed immediately by Rabia.
- Inter Regna do not advance the ruler rotation. Reign ordinals count each effective ruler's appearances within the current year and reset at the new year without resetting the underlying rotation.
- Two continuous 179-day seasons = a 358-day seasonal cycle
- Six deterministic circular orbits and three ranked three-body pulls

The epoch is `1970-01-01T00:00:00.000Z`. The calendar and lunar clocks share this epoch, but they do not share a second duration or an hour duration. Calendar and lunar elapsed seconds are both derived directly and retroactively from elapsed real milliseconds; lunar time uses 1009-millisecond lunar seconds, and neither counter is converted from the other. Mechanical modules own stable IDs, durations, ordering, orbital periods, tie-breaking, thresholds, calculations, and relationships. They never contain configured proper nouns, localized text, symbols, or formatted display values. Month state keeps the skipped opportunity, regular ruler, and effective ruler separate; v8.11 uses `source: "base_rotation"`, so the regular ruler is also effective. A future conspiracy will change only the targeted month's effective ruler, never the underlying rotation, its next opportunity, or Pigritia's regular skip alternation. Pigritia skips only a regular opportunity: a conspiracy-forced Pigritia reign remains effective and is never removed by that skip rule. Yearly reign counts will be recomputed from effective rulers, including earlier overrides in the same year.

Raw calendar state retains numeric `year`, `weekOfYear`, `dayOfYear`, `dayOfWeek`, and period-day values. Raw state exposes independent `totalSeconds` and `totalLunarSeconds` counters. Lunar state retains cycle, day, cycle length, phase ID, and self-describing 1009/59/67/31 time metadata. Roman conversion and in-universe names exist only in the presentation layer.

The shared scheduler recursively targets the earlier of the next 997 ms calendar-second boundary and 1009 ms lunar-second boundary. It uses one timer and recalculates the full state from `Date.now()` on every update and whenever the page becomes visible, avoiding accumulated timer drift.

## Architecture

1. `public/core/` contains immutable numeric rules and deterministic, presentation-neutral mechanics.
2. `public/config/nomenclature.json` contains the single active set of in-game proper nouns and symbols.
3. `public/locales/` contains generic UI terminology, templates, status/accessibility text, and Outcome-type names.
4. The presentation context resolves raw IDs through the validated nomenclature and locale data.

`public/nomenclature-loader.js` owns the fixed nomenclature path, and `public/locale-loader.js` owns the locale allowlist and direct locale request. `public/presentation-context-loader.js` starts locale and nomenclature loading concurrently and constructs their shared context. A page therefore requires exactly two configuration JSON requests—one locale file and `/config/nomenclature.json`—instead of an indexed, serial request chain. `public/app-bootstrap.js` applies the loaded context, prepares renderers, clears `aria-busy`, and starts `public/live-state.js`.

The project has no framework, build system, database, backend time API, WebSocket, authentication system, external font, date library, server-side fictional calculation, or backend configuration-selection endpoint.

## Page layouts

- Calendar presents three cards in order: the calendar date, the lunar cycle and phase, then season details and progress. The date card retains exactly two visible lines: configured year name plus Roman year, then weekday plus Roman period day and configured period name. The lunar card retains the cycle name and Roman cycle number as its title and the current phase as its subtitle. The season card is shared with Tempore and includes the current season, day within the season, seasonal-cycle position, next season, and season progress. Week number, day-of-year progress, fictional clock, and JSON controls remain absent.
- Outcome begins directly with the selected celestial object and retains its classification, tide, Pull, orbit, and progress data without a visible Outcome card title.
- Weather begins directly with the Time card, including both fictional and lunar clocks, then shows Season and Progress. It has no separate page-header card.

Every page preserves a visually hidden configured page heading for document structure and displays the application name, localized epoch, and v8.11 version in its footer.

## JSON schema v15

The public `createCalendarJson()` serialization API remains available even though no page exposes visible JSON or clipboard controls. Its top-level fields are:

- `calendarVersion: "v15"`
- `nomenclature`: schema version and application display name, with no requested/resolved selection
- `locale`: requested/resolved IDs, language tag, and locale schema version
- `source`: Unix milliseconds and ISO UTC
- `state`: raw canonical IDs and numeric mechanics without names or symbols
- `display`: configured names, symbols, localized text, and formatted values

The v15 raw state contains both elapsed-second counters and the lunar clock's 1009/59/67/31 unit metadata. The display calendar replaces static month nomenclature with a generated month object containing the formatted reign name and structured opportunity, regular, and effective ruler entities, source, skip flag, yearly reign number, and ordinal entity. The raw month period exposes the same mechanics using neutral IDs only. Inter Regna contain no month rulership and the display month is `null`. Lunar display retains `cycleName`, `formattedCycle`, and `formattedSummary` alongside phase, tide, time, and tide-time fields. The schema contains no universe-selection metadata.

## Routes and server

| Route | Purpose |
|---|---|
| `/` | Redirect to `/calendario.html`, preserving only a non-empty locale |
| `/calendario.html` | Calendar-date, lunar-cycle, and season view; no visible clock or JSON |
| `/destino.html` | Outcome selection, tides, pulls, orbits, and hour progress |
| `/tempore.html` | Fictional times, season, and selected progress |
| `/config/nomenclature.json` | The one read-only nomenclature configuration |
| `/health` | `{"ok":true,"version":"v8.11"}` |

Static `.html`, `.css`, `.js`, and `.json` responses—including locale and nomenclature configuration—use explicit MIME types and `Cache-Control: no-cache`. They also include deterministic weak ETags and Last-Modified validators, so repeat requests can revalidate with a bodyless `304 Not Modified` response instead of retransferring unchanged files. Other static formats retain a short revalidating cache policy. Dynamic, redirect, and error responses remain `no-store` and do not participate in static revalidation.

The server prevents traversal and dotfile access, returns generic errors, provides CSP and related security headers on both 200 and 304 static responses, supports conditional `GET`/`HEAD`, preserves canonical HTTPS redirect precedence, and shuts down gracefully. These improvements use only Node built-in modules; no dependency, build step, file watcher, service worker, or compatibility layer was added.

The former English page paths and modules are intentionally unsupported. They have no redirects, aliases, compatibility files, or duplicate pages and return ordinary static 404 responses.

## Editing nomenclature

1. Edit only `public/config/nomenclature.json`.
2. Keep every canonical neutral ID, required entity, and category ordering.
3. Preserve each entity shape: calendar includes non-empty `yearName` and `monthReign.name`; month rulers, reign ordinals, and weekdays use `{ id, name }`; lunar cycle uses `{ name }`; and only celestial bodies use symbols.
4. Keep Outcome types, translations, templates, and mechanics out of the file.
5. Run `npm test` before deployment.

## Adding a locale

1. Add its locale JSON file, translating every message, template, and Outcome-type name without changing keys, IDs, or named placeholders.
2. Add its ID and fixed same-origin path to the `LOCALE_FILES` registry in `public/locale-loader.js`.
3. Add or update loader, validation, and presentation tests, then run `npm test`.

The nomenclature file uses schema version 6, including the month-reign and lunar-cycle names. Locale files use schema version 5 for the dynamic month-reign and lunar-summary template contracts. The Calendar JSON API uses schema v15.

## Project structure

```text
public/
  config/nomenclature.json
  core/{rules,mechanics,formatting}.js
  locales/{en,es}.json
  {calendario,destino,tempore}.html
  {calendario,destino,tempore}-page.js
  app-bootstrap.js
  locale-loader.js
  nomenclature-loader.js
  nomenclature.js
  page-definitions.js
  presentation-context-loader.js
  presentation.js
  live-state.js
  renderers.js
  styles.css
server.js
test/{core,loaders,lunar-clock,presentation,server}.test.js
```

## Deployment

Heroku deployment is unchanged. The included `Procfile` runs `npm start`; Node remains pinned through `.nvmrc` and `package.json`. No deployment credentials or GitHub Actions workflow are stored in the repository. Configure environment-specific values as platform variables.

## License

Released under the [MIT License](LICENSE).
