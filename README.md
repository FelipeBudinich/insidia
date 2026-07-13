# Insidia

Insidia v8.16 is a live fictional calendar with independent calendar and lunar clocks, one active in-game nomenclature configuration, and localized generic UI language. All calculations run in the browser from `Date.now()`; the Node.js server only serves static files, redirects `/`, and exposes `/health`.

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

The browser always loads it from the fixed same-origin URL `/config/nomenclature.json`. Editing this file and redeploying is sufficient to rename the application/world, the month-reign system, weekdays, named calendar days, Interregnos, seasons, lunar phases, tides, celestial bodies and symbols, and Orbital Pulls. JavaScript and HTML changes are not required.

The configured terms are fixed in-universe proper nouns, not English or Spanish translations. The active v8.16 configuration includes:

- Calendar year name: Annus Solis
- Lunar cycle name: Cyclus Lunae
- Month reign: Regno de; rulers Orgolio, Rabia, Gula, Invidia, Avaritia, Vanitate, Luxuria, Pigritia
- Reign ordinals: Prime, Secunde, Tertie, Quarte, Quinte, Sexte, Septime, Octave, None, Decime, Undecime
- Weekdays: Dies Lunae, Dies Martis, Dies Mercurii, Dies Iovis, Dies Veneris, Dies Saturni, Dies Solis
- Named calendar days: Day 1 — Kalendis; Day 7 — Nonis; Day 15 — Idibus; Day 23 — Liminis; Interregno Day 1 — Interregis
- Interregnos: Primus Interregno; Secundus Interregno; Tertius Interregno; Quartus Interregno; Quintus Interregno; Sextus Interregno; Septimus Interregno; Octavus Interregno; Nonus Interregno; Decimus Interregno; Undecimus Interregno
- Lunar phases: Renascimento, Corno, Falce, Passage, Ascrescimento, Crescente, Ascenso, Apice, Morditura, Decrescente, Recedente, Velo, Morte
- Tides: Marea basse, Marea alte, Marea dividite
- Seasons: Ossos, Lacrimas
- Orbital Pulls: Attraction dominante, Attraction minor, Attraction divergente
- Celestial bodies: ☿ Mercurius, ♀ Venus, ♂ Mars, ♃ Jupiter, ♄ Saturnus, ☾ Luna

These names and symbols are loaded exclusively from `public/config/nomenclature.json` and remain identical when the locale changes.

Weekday, named-day, month-ruler, and reign-ordinal entities use exactly `{ id, name }`; they have no `shortName` or symbol. Their complete canonical neutral ID sets and ordering must be retained. Static month names are not configured: each visible month name is derived from its ruler and its ruler's reign number within that year.

Calendario renders the year with uppercase Roman numerals. Its two-line date header is `Annus Solis {romanYear} · {currentSeasonName}` followed by `{weekdayName} {dayDesignation} · {periodName}`. Month days 1, 7, 15, and 23 use their configured named-day designations; every other month day uses its uppercase Roman numeral. The first day of each Interregno uses `Interregis`, and its remaining days use Roman numerals. Examples include `Dies Lunae Kalendis · Regno de Pigritia`, `Dies Solis XIX · Regno de Luxuria`, `Dies Martis Interregis · Primus Interregno`, and `Dies Mercurii II · Primus Interregno`. A ruler's first month in a year is named `Regno de {ruler}`; later months use `{ordinal} Regno de {ruler}`. `Prime` remains structured nomenclature but is deliberately omitted from the first visible reign name. English and Spanish show the same in-universe date.

The lunar Calendario card mirrors the date card's two-line hierarchy. Its title is the configured lunar-cycle name plus Roman cycle number, and its subtitle is the configured current phase name. For lunar cycle 1234, it displays `Cyclus Lunae MCCXXXIV` above `Morditura`. Both lines come from presentation-ready nomenclature data and remain identical in English and Spanish. The combined `Morditura • Cyclus Lunae MCCXXXIV` summary remains available in the display and Calendar JSON v18 APIs, while lunar day and cycle-length values remain in raw state.

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
- Outcome rarity is based on continuous progress through the active tide. Common lasts through 85%, Uncommon lasts above 85% through 99%, and Rare begins above 99%.
- Tide progress, Outcome rarity, and Attempts until Rare reset at every tide boundary. All three differently sized tides use the same percentage thresholds.
- 7 days = 1 week
- 11 × 29-day months, ten 3-day Interregnos, and one 4-day final Interregno = 353 days
- Each month after the epoch is selected at exactly 22:00:00 on the final day of its preceding Interregno. The season at that snapshot chooses one of two independent persistent four-ruler rotations: Ossos uses Pigritia, Vanitate, Luxuria, Orgolio; Lacrimas uses Rabia, Gula, Invidia, Avaritia.
- An Ossos decision advances only the Ossos cursor and a Lacrimas decision advances only the Lacrimas cursor. Neither cursor resets at a season or year boundary, and a returning season resumes its previous position. The selected ruler remains fixed for the whole following month even if the season or orbital state changes during it.
- Year 1, Month 1 begins with Pigritia and consumes the first Ossos position. Pigritia alternates between governing and declining its regular Ossos opportunities, beginning with governing opportunity 1 and declining opportunity 2. Lacrimas decisions and future override-forced Pigritia reigns do not change that opportunity count.
- On a declined Pigritia opportunity, the same decision snapshot checks raw orbital progress at an inclusive 95% threshold. Exactly one qualifying body selects its mapped replacement: Mars → Rabia, Mercurius → Avaritia, Jupiter → Gula, Venus → Invidia, Saturnus → Orgolio, and Luna → Vanitate.
- Two or more qualifying bodies are automatically a tie regardless of their relative progress. Zero or multiple qualifiers use the dynamic next-Ossos-ruler fallback after the last effective Ossos ruler, skipping Pigritia while it is declining. A replacement occupies only Pigritia's month and never changes either rotation cursor.
- Reign ordinals count each final effective ruler's appearances within the current year, including Pigritia replacements, and reset at the new year without resetting either rotation. A future conspiracy override may change only `effectiveRulerId`; it must not change the opportunity ruler, regular ruler, decision season, cursor positions, or Pigritia alternation.
- Two continuous 179-day seasons = a 358-day seasonal cycle
- Six deterministic circular orbits and three ranked three-body pulls

The epoch is `1970-01-01T00:00:00.000Z`. The calendar and lunar clocks share this epoch, but they do not share a second duration or an hour duration. Calendar and lunar elapsed seconds are both derived directly and retroactively from elapsed real milliseconds; lunar time uses 1009-millisecond lunar seconds, and neither counter is converted from the other. Mechanical modules own stable IDs, durations, ordering, orbital periods, tie-breaking, thresholds, calculations, and relationships. They never contain configured proper nouns, localized text, symbols, or formatted display values. Month state keeps the opportunity, regular, and effective rulers separate. It is reconstructed by a deterministic chronological replay from the epoch; no mutable history, browser storage, server state, or Pull calculation participates in historical month decisions.

Raw calendar state retains numeric `year`, `weekOfYear`, `dayOfYear`, `dayOfWeek`, and period-day values. Each raw period also exposes a neutral `namedDayId`, using one of `named-day-01` through `named-day-05` on a configured named day and `null` otherwise. Raw state exposes independent `totalSeconds` and `totalLunarSeconds` counters. Lunar state retains cycle, day, cycle length, phase ID, and self-describing 1009/59/67/31 time metadata. Roman conversion and in-universe names exist only in the presentation layer.

The shared scheduler recursively targets the earlier of the next 997 ms calendar-second boundary and 1009 ms lunar-second boundary. It uses one timer and recalculates the full state from `Date.now()` on every update and whenever the page becomes visible, avoiding accumulated timer drift.

## Architecture

1. `public/core/` contains immutable numeric rules and deterministic, presentation-neutral mechanics.
2. `public/config/nomenclature.json` contains the single active set of in-game proper nouns and symbols.
3. `public/locales/` contains generic UI terminology, templates, status/accessibility text, and Outcome-type names.
4. The presentation context resolves raw IDs through the validated nomenclature and locale data.

`public/nomenclature-loader.js` owns the fixed nomenclature path, and `public/locale-loader.js` owns the locale allowlist and direct locale request. `public/presentation-context-loader.js` starts locale and nomenclature loading concurrently and constructs their shared context. A page therefore requires exactly two configuration JSON requests—one locale file and `/config/nomenclature.json`—instead of an indexed, serial request chain. `public/app-bootstrap.js` applies the loaded context, prepares renderers, clears `aria-busy`, and starts `public/live-state.js`.

The project has no framework, build system, database, backend time API, WebSocket, authentication system, external font, date library, server-side fictional calculation, or backend configuration-selection endpoint.

## Page layouts

- Calendario presents two cards: the calendar date and the lunar cycle. The date-card title displays the configured year name, Roman year, and current season name on one line, for example `Annus Solis LXII · Ossos`. Its second line displays the weekday, named-day or Roman-day designation, a separator, and the configured month or Interregno name. The lunar card remains unchanged, with the cycle name and Roman cycle number as its title and the current phase as its subtitle. Detailed season metadata and progress remain available on Tempore. Week number, day-of-year progress, fictional clock, and JSON controls remain absent.
- Outcome begins directly with the selected celestial object and retains its classification, tide, Pull, and orbit data without a visible Outcome card title. Its bottom progress card displays progress through the current tide; the selected body's orbital-progress line remains separate in the top Outcome area.
- Weather begins directly with the Time card, including both fictional and lunar clocks, then shows Season and Progress. It has no separate page-header card.

Every page preserves a visually hidden configured page heading for document structure and displays the application name, localized epoch, and v8.16 version in its footer.

## JSON schema v18

The public `createCalendarJson()` serialization API remains available even though no page exposes visible JSON or clipboard controls. Its top-level fields are:

- `calendarVersion: "v18"`
- `nomenclature`: schema version and application display name, with no requested/resolved selection
- `locale`: requested/resolved IDs, language tag, and locale schema version
- `source`: Unix milliseconds and ISO UTC
- `state`: raw canonical IDs and numeric mechanics without names or symbols
- `display`: configured names, symbols, localized text, and formatted values

The v18 raw state contains both elapsed-second counters and the lunar clock's 1009/59/67/31 unit metadata. Every raw month or Interregno period contains its numeric `day` and neutral `namedDayId`; no named-day proper noun appears in raw state. Raw and display progress include continuous `tide` progress, while calendar-hour `hour` progress remains available for Tempore. A raw month rulership records the neutral decision-season ID; opportunity, regular, and effective ruler IDs; skip state and opportunity number; source; yearly effective reign number and ordinal ID; and replacement method, selected body ID, and fallback reason. Its immutable decision snapshot includes the timestamp, final-Interregno day and hour, independent calendar and lunar counters, six neutral body IDs with raw progress fractions, and every qualifying body ID. Interregnos contain no month rulership.

The display calendar maps the rotation season, rulers, decision bodies, qualifying bodies, selected replacement body, and optional named day through the active nomenclature. Its `namedDay` field is an `{ id, name }` entity or `null`, while `dayDesignation` is always the final configured name or Roman numeral used in the rendered date. It adds ISO UTC and formatted orbital progress while retaining the raw numeric values. The generated month name always follows the final effective ruler. Raw state contains no configured names, symbols, generated month names, or formatted percentages. Lunar display retains `cycleName`, `formattedCycle`, and `formattedSummary` alongside phase, tide, time, and tide-time fields. The schema contains no universe-selection metadata.

## Routes and server

| Route | Purpose |
|---|---|
| `/` | Redirect to `/calendario.html`, preserving only a non-empty locale |
| `/calendario.html` | Calendar date with current season, plus lunar-cycle view; no visible clock or JSON |
| `/destino.html` | Outcome selection, tides, tide progress, Pulls, and orbits |
| `/tempore.html` | Fictional times, season, and selected progress |
| `/config/nomenclature.json` | The one read-only nomenclature configuration |
| `/health` | `{"ok":true,"version":"v8.16"}` |

Static `.html`, `.css`, `.js`, and `.json` responses—including locale and nomenclature configuration—use explicit MIME types and `Cache-Control: no-cache`. They also include deterministic weak ETags and Last-Modified validators, so repeat requests can revalidate with a bodyless `304 Not Modified` response instead of retransferring unchanged files. Other static formats retain a short revalidating cache policy. Dynamic, redirect, and error responses remain `no-store` and do not participate in static revalidation.

The server prevents traversal and dotfile access, returns generic errors, provides CSP and related security headers on both 200 and 304 static responses, supports conditional `GET`/`HEAD`, preserves canonical HTTPS redirect precedence, and shuts down gracefully. These improvements use only Node built-in modules; no dependency, build step, file watcher, service worker, or compatibility layer was added.

The former English page paths and modules are intentionally unsupported. They have no redirects, aliases, compatibility files, or duplicate pages and return ordinary static 404 responses.

## Editing nomenclature

1. Edit only `public/config/nomenclature.json`.
2. Keep every canonical neutral ID, required entity, and category ordering.
3. Preserve each entity shape: calendar includes non-empty `yearName` and `monthReign.name`; month rulers, reign ordinals, weekdays, named days, and Interregnos use `{ id, name }`; lunar cycle uses `{ name }`; and only celestial bodies use symbols.
4. Keep Outcome types, translations, templates, and mechanics out of the file.
5. Run `npm test` before deployment.

## Adding a locale

1. Add its locale JSON file, translating every message, template, and Outcome-type name without changing keys, IDs, or named placeholders.
2. Add its ID and fixed same-origin path to the `LOCALE_FILES` registry in `public/locale-loader.js`.
3. Add or update loader, validation, and presentation tests, then run `npm test`.

The nomenclature file uses schema version 7, including named calendar days and the ordinal Interregno names. Locale files use schema version 7, including the `{dayDesignation}` calendar-period templates. The Calendar JSON API uses schema v18.

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
test/{core,loaders,lunar-clock,month-rulership,presentation,server}.test.js
```

## Deployment

Heroku deployment is unchanged. The included `Procfile` runs `npm start`; Node remains pinned through `.nvmrc` and `package.json`. No deployment credentials or GitHub Actions workflow are stored in the repository. Configure environment-specific values as platform variables.

## License

Released under the [MIT License](LICENSE).
