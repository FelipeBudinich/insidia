# Insidia

Insidia is a live fictional clock, calendar, season cycle, lunar cycle, tide cycle, and six-body orbital alignment model. All fictional calculations run in the browser from the current Unix timestamp; the small Node.js server only serves the static application and its health endpoint.

**Current release:** v6

## Fictional time and calendar

- 997 real milliseconds equal one fictional second.
- 59 fictional seconds equal one fictional minute.
- 61 fictional minutes equal one fictional hour.
- 23 fictional hours equal one calendar day.
- 7 calendar days make a week.
- Each year has 11 months of 29 days, 10 three-day Inter Regna, and a final four-day Inter Regnum from Month 11 to Month 1: 353 days total.

Inter Regnum days are full calendar days: they have a time of day and continue the week cycle, but do not belong to a month.

## Seasonal cycle

The season system is an independent, continuous 358-day cycle made from two seasons:

- **Bones:** 179 fictional calendar days
- **Tears:** 179 fictional calendar days

A seasonal day is the existing 23-hour calendar day; seasons do not use the 31-hour lunar day. Bones begins at the Unix epoch, is followed by Tears, and Tears is followed by Bones in the next seasonal cycle.

The 353-day calendar year and 358-day seasonal cycle are deliberately different. Seasons do not reset at month boundaries, Inter Regna, or New Year. Calendar Year 2 therefore begins on Tears Day 175; the next Bones cycle begins five days later, on Year 2, Month 1, Day 6. Seasons are fictional names only—no real climate, meteorological, orbital, or geographical data is used.

## Lunar cycle and tides

The fictional lunar system uses the same seconds, minutes, and hours as the calendar, but its day is independent: one lunar day lasts **31 fictional hours**. A lunar cycle contains **13 lunar days**, for a complete cycle of **403 fictional hours**.

The phases occur in this exact order: Rebirth, Horn, Crescent, Passage, Growing, Waxing, Ascent, Apex, Bite, Waning, Receding, Veil, and Death. Each phase lasts one complete lunar day. After Death, Rebirth begins the next lunar cycle.

Every lunar day contains a tide sequence:

- Low: 17 hours
- High: 13 hours
- Parted: 1 hour

Lunar days and tides do not reset at calendar midnight, calendar month boundaries, Inter Regna, or New Year. They advance directly from total elapsed fictional seconds.

## Celestial orbits

| Body | Orbital period |
|------|----------------|
| ☿ Mercury | 89 fictional days |
| ♀ Venus | 223 fictional days |
| ♂ Mars | 683 fictional days |
| ♃ Jupiter | 4,337 fictional days |
| ♄ Saturn | 7,919 fictional days |
| ☾ Moon | 13 lunar days (403 fictional hours) |

Planetary orbital periods use the existing 23-hour fictional calendar day. The Moon instead completes one orbit over the 13-phase lunar cycle: 13 lunar days of 31 fictional hours, or 403 fictional hours total. All six bodies begin at 0% at the epoch and advance uniformly through independent circular normalized orbits. Progress includes fictional hours, minutes, and seconds rather than changing only at a day boundary. At each exact orbital boundary, progress resets from just below 100% to 0% and the body's one-based orbit count increments.

The model has no real orbital eccentricity, inclination, retrograde motion, physical position, or real astronomical data. On its circular scale, 0% and 100% are the same point.

## Orbital Pulls

The orbital pull model evaluates all twenty possible three-body combinations once per timestamp using raw, unrounded progress fractions. It ranks candidates in deterministic epsilon groups while preserving circular wrap-around: 99%, 0%, and 1% span 2%, not 99%.

- **Dominant Pull:** the first-ranked, smallest-span trio.
- **Minor Pull:** the second-ranked distinct trio, including when it shares Dominant Pull's span.
- **Negative Pull:** the largest-span trio; it may duplicate another pull when every span is tied.

Fixed priority is used only to break equal-span ties. Its order is Moon, Venus, Mars, Mercury, Jupiter, Saturn. Tied trios are compared by their lowest-priority member first, then their next-lowest-priority member, with canonical IDs as the final fallback. Strictly smaller spans win the ascending ranking and strictly larger spans win Negative Pull regardless of priority.

Alignment percentage is 100 minus the circular-span percentage and does not affect selection. Pulls measure fictional orbital-phase clustering, not physical gravity.

## Continuous progress

The Progress card tracks the current lunar cycle, lunar phase, 179-day season, 353-day calendar year, 23-hour calendar day, and 61-minute fictional hour. Each fraction includes the current fictional second, remains between 0 and 1, and resets at its own boundary. Display percentages are truncated to six decimal places so the final second before a boundary never appears as a false 100%.

Season progress measures only the current Bones or Tears season, not the full 358-day seasonal cycle. Lunar-phase progress uses the 31-hour lunar day, while lunar-cycle progress spans all 13 lunar days.

## Epoch

At Unix epoch `1970-01-01T00:00:00.000Z`, Insidia begins with:

- **Calendar:** Year 1, Month 1, Day 1, `00:00:00`
- **Season:** Seasonal Cycle 1, Bones, Day 1 of 179
- **Lunar:** Cycle 1, Day 1 of 13, Rebirth, `00:00:00`
- **Tide:** Low, Hour 1 of 17
- **Orbits:** Mercury, Venus, Mars, Jupiter, Saturn, and Moon at 0%
- **Dominant Pull:** Moon, Venus, Mars; circular span 0%; alignment 100%
- **Minor Pull:** Moon, Venus, Mercury; circular span 0%; alignment 100%
- **Negative Pull:** Moon, Venus, Mars; circular span 0%; alignment 100%

## Features

- Live, drift-resistant browser-side calculations from `Date.now()`
- Month, Inter Regnum, week, day-of-year, and independent season metadata
- Independent 358-day Bones/Tears season display
- Independent lunar phase and 31-hour lunar clock display
- Low, High, and Parted tide status with elapsed period time
- Smooth progress for six independent fictional orbital cycles
- Dominant, Minor, and Negative orbital pull ranking with deterministic fixed-priority tie-breaking
- Smooth second-level progress for the lunar cycle, lunar phase, current season, year, day, and hour
- Collapsible, two-space-formatted JSON snapshot containing season, lunar, tide, and orbital state
- Copy button that creates and copies one fresh, coherent snapshot
- Responsive, system-font interface with light/dark mode support
- Hardened static-file server with explicit security headers and graceful shutdown

## Requirements

- Node.js 24 (use `.nvmrc` for local parity with production)

## Installation and local usage

```sh
npm ci
npm test
npm start
```

Open [http://localhost:3000](http://localhost:3000); the server redirects the root route to `/calendar.html`. To use a different port, set `PORT` before starting the server:

```sh
PORT=5001 NODE_ENV=production npm start
```

The application validates an explicit `PORT` and listens on `0.0.0.0`, which is suitable for Heroku dynos. `CANONICAL_ORIGIN` is optional; without it, no canonical redirect is forced.

## Routes

| Route | Purpose |
|---|---|
| `/` | Redirects to `/calendar.html` |
| `/calendar.html` | Calendar, lunar phase and timing, selected progress values, and complete JSON output |
| `/treasure.html` | Tide, celestial orbits, and all orbital pulls |
| `/weather.html` | Season and season progress |
| `/health` | Application health response |

All three HTML pages use normal navigation links and calculate the same complete fictional state from the same Unix epoch through one shared browser scheduler. Each page displays a different subset of that state. Calendar no longer shows visual cards for Season, Tide, Celestial Orbits, or Orbital Pulls, but its JSON output still exports the complete state, including those fields and season progress. Reloading or switching routes never resets a cycle because no fictional counters are stored in memory, local storage, or on the server. The Node.js server stores no fictional state and handles only static files, the health response, and the root redirect.

## Health check and JSON schema

`GET /health` returns:

```json
{"ok":true,"version":"v6"}
```

The copied calendar JSON schema remains `"calendarVersion":"v8"`. V6 simplifies the Calendar presentation without changing calculations or restructuring the complete fictional snapshot. The application release version and JSON schema version are intentionally independent.

## Architecture

The frontend uses three real HTML documents, vanilla CSS, and JavaScript ES modules. [`public/calendar.js`](public/calendar.js) is the pure state calculator, [`public/live-state.js`](public/live-state.js) owns the single drift-resistant browser scheduler used by every page, and [`public/renderers.js`](public/renderers.js) contains shared season, tide, orbit, and pull renderers. Page-specific modules bind only the elements their document displays. The Node.js server serves static files, the health endpoint, and a relative root redirect. There is no client-side router, database, frontend framework, build step, runtime dependency, server-side fictional calculation, or real-world astronomy integration.

## Deploying to Heroku

Insidia v6 remains prepared for Heroku's native GitHub automatic deployment integration. The UI change does not alter the Procfile or automatic deployment configuration. No GitHub Actions workflow exists for v6.

### Requirements

- A Heroku account and Heroku app
- This GitHub repository
- Node.js 24 locally for parity with Heroku

The root [Procfile](Procfile) defines the only dyno process:

```text
web: npm start
```

### Automatic GitHub deployment

1. Open the Heroku app's **Deploy** tab.
2. Select **GitHub** as the deployment method and connect `FelipeBudinich/insidia`.
3. Select the deployment branch, normally `main`.
4. Enable **Automatic Deploys** for that branch.
5. Leave **Wait for CI to pass before deploy** disabled for v6 because no CI workflow exists yet. Run `npm test` locally before pushing instead.

Heroku builds and releases successful GitHub pushes directly; no Heroku Git remote, deployment script, or committed deployment credential is required.

### Optional canonical origin

Set this Heroku Config Var when the app has a final HTTPS address:

```text
CANONICAL_ORIGIN=https://your-app-name.herokuapp.com
```

Replace it with the canonical custom HTTPS origin when applicable. Heroku normally supplies `NODE_ENV=production`; do not store environment values or credentials in source files.

### Verify a deployment

Open:

```text
https://your-app-name.herokuapp.com/
https://your-app-name.herokuapp.com/health
```

The health endpoint must return `{"ok":true,"version":"v6"}`. To inspect logs and dyno status:

```sh
heroku logs --tail --app <app-name>
heroku ps --app <app-name>
```

If the web process is not running, scale it explicitly:

```sh
heroku ps:scale web=1 --app <app-name>
```

For custom domains, use Heroku Automated Certificate Management or another properly configured TLS certificate; never disable certificate validation.

### Security operations

- Enable MFA on both Heroku and GitHub.
- Restrict collaborator access and enable branch protection for the deployment branch when appropriate.
- Run Heroku Production Check after deployment.
- Store environment-specific values in Heroku Config Vars, never committed credentials.
- Periodically review Node.js support status.

## Project structure

```text
.
├── public/
│   ├── calendar.html       # Calendar, lunar, progress, and complete JSON route
│   ├── treasure.html       # Tide, orbit, and pull route
│   ├── weather.html        # Season route
│   ├── calendar.js         # Pure fictional-state calculations
│   ├── live-state.js       # Shared drift-resistant scheduler
│   ├── renderers.js        # Shared focused-state renderers
│   ├── calendar-page.js    # Calendar page binding and JSON copy behavior
│   ├── treasure-page.js    # Treasure page binding
│   ├── weather-page.js     # Weather page binding
│   └── styles.css          # Shared responsive styling
├── test/
│   ├── calendar.test.js
│   ├── lunar.test.js
│   ├── orbits.test.js
│   ├── progress.test.js
│   ├── season.test.js
│   └── server.test.js
├── Procfile            # Heroku web process
├── .nvmrc              # Node.js production major
├── server.js           # Hardened static Node.js server
├── package.json
└── README.md
```

## Testing

Run the pure calendar/season/lunar/tide/orbital and server integration tests with Node's built-in test runner:

```sh
npm test
npm audit --omit=dev
```

The suite covers calendar and season boundaries, lunar phases and tides, six second-level progress boundaries, planetary and Moon orbital resets, Moon/lunar-cycle synchronization, circular wrap-around, all twenty orbital pull candidates, grouped epsilon ranking, Minor and Negative Pull selection, raw-fraction ordering, fixed-priority tie-break rules, all three HTML routes and their navigation, shared scheduler architecture, redirects, HTTP methods, cache/security headers, path containment, canonical redirects, port and origin validation, and SIGTERM shutdown.

## License

Released under the [MIT License](LICENSE).
