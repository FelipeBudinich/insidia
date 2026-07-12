# Insidia

Insidia v7 is a live fictional calendar whose mechanics, fictional nomenclature, and interface language are independent layers. Every time calculation runs in the browser from `Date.now()`; the Node server only serves static files, redirects `/`, and exposes `/health`.

## Run locally

Node.js 24 is the supported runtime (see `.nvmrc`). There are no dependencies or build step.

```sh
npm ci
npm test
npm start
```

Open [http://localhost:3000](http://localhost:3000). Set `PORT` to override port 3000.

## Selecting a universe and locale

Use query parameters on any page:

```text
/calendar.html?universe=insidia&locale=en
/outcome.html?universe=demonstration&locale=es
```

The built-in universes are `insidia` and `demonstration`; the built-in locales are `en` and `es`. Missing or unknown IDs fall back to the defaults declared in `public/universes/index.json` and `public/locales/index.json`. Navigation retains the resolved selection. The root redirect preserves its query string.

Universe packs contain only fictional display data: application name, months, weekdays, Inter Regna, seasons, lunar phases, tides, celestial bodies, pulls, and outcome types. Locale packs contain only generic interface messages and named-placeholder templates. Both loaders require same-origin JSON, validate exact schemas and canonical IDs, reject incomplete packs, and load the whole selected pack before exposing it.

## Mechanics

- 997 real milliseconds = 1 fictional second
- 59 seconds = 1 minute; 61 minutes = 1 hour; 23 hours = 1 calendar day
- 7 days = 1 week
- 11 months × 29 days, ten 3-day Inter Regna, and one final 4-day Inter Regnum = 353 days
- Two continuous 179-day seasons = a 358-day seasonal cycle
- 31-hour lunar days and 13-day lunar cycles
- Tides last 17, 13, and 1 lunar hours
- Six deterministic circular orbits and three ranked three-body pulls

The epoch is `1970-01-01T00:00:00.000Z`. Weekdays, seasons, lunar state, tides, and orbits continue through month, Inter Regnum, and year boundaries. The scheduler recursively targets the next 997 ms boundary and recalculates the complete state immediately whenever the page becomes visible, so it does not accumulate timer drift.

## Three-layer architecture

1. `public/core/` contains immutable numeric rules, formatting primitives, and deterministic mechanics. It emits canonical IDs and numbers only—never names, symbols, localized strings, or formatted presentation.
2. `public/universes/` supplies fictional proper nouns and symbols; `public/locales/` supplies interface language and templates.
3. `public/presentation.js`, `public/nomenclature.js`, and the renderers resolve raw IDs through the selected presentation context.

`public/calendar.js` is a compatibility entry point that re-exports the focused modules. `public/live-state.js` owns the shared scheduler. `public/app-bootstrap.js` loads and validates context before it starts rendering. The HTML contains neutral placeholders rather than default-universe proper nouns.

There is no framework, build system, database, backend time API, WebSocket, authentication system, external font, date library, or server-side fictional calculation.

## JSON schema v9

The Calendar page shows a collapsible, two-space-formatted snapshot and copies a fresh snapshot at click time. Its stable top-level fields are:

- `calendarVersion: "v9"`
- `universe`: requested/resolved IDs, display name, and pack schema version
- `locale`: requested/resolved IDs, language tag, and pack schema version
- `source`: Unix milliseconds and ISO UTC
- `state`: raw canonical IDs and numeric mechanics without presentation strings
- `display`: resolved names, symbols, labels, and formatted values

Clipboard API failures fall back to the browser copy command; an accessible live status reports success or manual-copy guidance.

## Routes and server

| Route | Purpose |
|---|---|
| `/` | Redirect to `/calendar.html`, preserving the query string |
| `/calendar.html` | Calendar, clock, lunar phase, and v9 JSON snapshot |
| `/weather.html` | Calendar/lunar clocks, season, and progress |
| `/outcome.html` | Tide-driven outcome, pulls, orbits, and hour progress |
| `/health` | `{"ok":true,"version":"v7"}` |

Static `.html`, `.css`, `.js`, and `.json` responses use explicit MIME types and `Cache-Control: no-cache`. The server prevents traversal, returns generic errors, provides security headers, supports `GET`/`HEAD`, and can optionally enforce an HTTPS `CANONICAL_ORIGIN` in production.

## Adding a universe

1. Add its ID and same-origin manifest path to `public/universes/index.json`.
2. Copy one existing universe directory.
3. Keep every canonical ID unchanged and edit only names/symbols.
4. Keep mechanics out of the pack; duration, orbit, threshold, and priority fields are rejected.
5. Run `npm test`.

## Adding a locale

1. Add its ID and file path to `public/locales/index.json`.
2. Copy an existing locale JSON file.
3. Translate every message and template without changing keys or named placeholders.
4. Run `npm test`.

## Project structure

```text
public/
  core/{rules,mechanics,formatting}.js
  universes/{index,insidia/*,demonstration/*}.json
  locales/{index,en,es}.json
  {calendar,outcome,weather}.html
  {calendar,outcome,weather}-page.js
  app-bootstrap.js
  live-state.js
  nomenclature.js
  presentation.js
  renderers.js
  styles.css
server.js
test/{core,presentation,server}.test.js
```

## Deployment

The included `Procfile` runs `npm start` and is compatible with Heroku GitHub deployment. No deployment credentials or GitHub Actions workflow are stored in the repository. Configure environment-specific values as platform variables.

## License

Released under the [MIT License](LICENSE).
