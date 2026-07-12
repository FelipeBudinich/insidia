# Insidia

Insidia v8.1 is a live fictional calendar with one universal mechanical model, one active in-game nomenclature configuration, and localized generic UI language. All calculations run in the browser from `Date.now()`; the Node.js server only serves static files, redirects `/`, and exposes `/health`.

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
/calendar.html?locale=en
/outcome.html?locale=en
/weather.html?locale=es
```

English is the default. Unknown locale IDs resolve to the default declared in `public/locales/index.json`; known malformed locale files stop bootstrap visibly. Navigation preserves only the resolved `locale` value and drops unrelated parameters.

There is no universe selector, universe query parameter, alternate world configuration, cookie, local-storage setting, header, route, or configurable frontend path for changing in-game nomenclature.

## One fixed nomenclature configuration

The only production nomenclature file is:

```text
public/config/nomenclature.json
```

The browser always loads it from the fixed same-origin URL `/config/nomenclature.json`. Editing this file and redeploying is sufficient to rename the application/world, months, weekdays, Inter Regna, seasons, lunar phases, tides, celestial bodies and symbols, and Orbital Pulls. JavaScript and HTML changes are not required.

The nomenclature file contains names and symbols only. Validation requires complete canonical ID coverage and rejects missing, duplicate, unknown, empty, or non-string entities; wrong schema versions; Outcome types; locale messages or templates; and mechanical fields such as durations, orbital periods, priorities, and thresholds. A missing, malformed, or invalid file stops live rendering and shows the accessible configuration-error view—there are no hard-coded or partial fallbacks.

Outcome-type names are generic language classifications owned by locale files:

- English: Common, Uncommon, Rare
- Spanish: Común, Poco común, Raro

Changing locale translates Outcome types and generic UI prose without changing configured proper nouns, symbols, IDs, or numeric state.

## Mechanics

- 997 real milliseconds = 1 fictional second
- 59 seconds = 1 minute; 61 minutes = 1 hour; 23 hours = 1 calendar day
- 7 days = 1 week
- 11 × 29-day months, ten 3-day Inter Regna, and one 4-day final Inter Regnum = 353 days
- Two continuous 179-day seasons = a 358-day seasonal cycle
- 31-hour lunar days and 13-day lunar cycles
- Tides last 17, 13, and 1 lunar hours
- Six deterministic circular orbits and three ranked three-body pulls

The epoch is `1970-01-01T00:00:00.000Z`. Mechanical modules own stable IDs, durations, ordering, orbital periods, tie-breaking, thresholds, calculations, and relationships. They never contain configured proper nouns, localized text, symbols, or formatted display values.

The shared scheduler recursively targets the next 997 ms boundary and recalculates the full state from `Date.now()` whenever the page becomes visible, avoiding accumulated timer drift.

## Architecture

1. `public/core/` contains immutable numeric rules and deterministic, presentation-neutral mechanics.
2. `public/config/nomenclature.json` contains the single active set of in-game proper nouns and symbols.
3. `public/locales/` contains generic UI terminology, templates, status/accessibility text, and Outcome-type names.
4. The presentation context resolves raw IDs through the validated nomenclature and locale data.

`public/nomenclature-loader.js` owns the fixed configuration path. `public/locale-loader.js` handles locale selection. `public/app-bootstrap.js` completes and validates both loads before applying labels, preparing renderers, clearing `aria-busy`, and starting `public/live-state.js`.

The project has no framework, build system, database, backend time API, WebSocket, authentication system, external font, date library, server-side fictional calculation, or backend configuration-selection endpoint.

## Page layouts

- Calendar begins directly with the date and calendar metadata, followed by lunar phase/day/cycle details. It has no visible page-card title, fictional clock, or JSON controls.
- Outcome begins directly with the selected celestial object and retains its classification, tide, Pull, orbit, and progress data without a visible Outcome card title.
- Weather begins directly with the Time card, including both fictional and lunar clocks, then shows Season and Progress. It has no separate page-header card.

Every page preserves a visually hidden localized page heading for document structure and displays the application name, localized epoch, and v8.1 version in its footer.

## JSON schema v10

The public `createCalendarJson()` serialization API remains available even though no page exposes visible JSON or clipboard controls. Its top-level fields are:

- `calendarVersion: "v10"`
- `nomenclature`: schema version and application display name, with no requested/resolved selection
- `locale`: requested/resolved IDs, language tag, and locale schema version
- `source`: Unix milliseconds and ISO UTC
- `state`: raw canonical IDs and numeric mechanics without names or symbols
- `display`: configured names, symbols, localized text, and formatted values

The v10 schema contains no universe-selection metadata. Removing the visible JSON interface did not change raw state, display serialization, nomenclature metadata, or locale metadata.

## Routes and server

| Route | Purpose |
|---|---|
| `/` | Redirect to `/calendar.html`, preserving only a non-empty locale |
| `/calendar.html` | Date, calendar metadata, lunar phase, lunar day, and lunar cycle; no visible clock, JSON, or card title |
| `/weather.html` | Begins with fictional/lunar Time, followed by Season and Progress; no separate page header |
| `/outcome.html` | Begins with the selected celestial object, followed by Outcome, tide, pulls, orbits, and hour progress |
| `/config/nomenclature.json` | The one read-only nomenclature configuration |
| `/health` | `{"ok":true,"version":"v8.1"}` |

Static `.html`, `.css`, `.js`, and `.json` responses use explicit MIME types and `Cache-Control: no-cache`. The server prevents traversal and dotfile access, returns generic errors, provides CSP and related security headers, supports `GET`/`HEAD`, preserves canonical HTTPS redirect precedence, and shuts down gracefully.

## Editing nomenclature

1. Edit only `public/config/nomenclature.json`.
2. Keep every neutral ID and required entity.
3. Change only display names, short names, and celestial symbols.
4. Keep Outcome types, translations, templates, and mechanics out of the file.
5. Run `npm test` before deployment.

## Adding a locale

1. Add its ID and same-origin file path to `public/locales/index.json`.
2. Copy an existing locale file.
3. Translate every message, template, and Outcome-type name without changing keys, IDs, or named placeholders.
4. Run `npm test`.

## Project structure

```text
public/
  config/nomenclature.json
  core/{rules,mechanics,formatting}.js
  locales/{index,en,es}.json
  {calendar,outcome,weather}.html
  {calendar,outcome,weather}-page.js
  app-bootstrap.js
  locale-loader.js
  nomenclature-loader.js
  nomenclature.js
  presentation-context-loader.js
  presentation.js
  live-state.js
  renderers.js
  styles.css
server.js
test/{core,loaders,presentation,server}.test.js
```

## Deployment

Heroku deployment is unchanged. The included `Procfile` runs `npm start`; Node remains pinned through `.nvmrc` and `package.json`. No deployment credentials or GitHub Actions workflow are stored in the repository. Configure environment-specific values as platform variables.

## License

Released under the [MIT License](LICENSE).
