# Insidia

Insidia is a live fictional clock, calendar, lunar cycle, and tide cycle. All fictional time is calculated in the browser from the current Unix timestamp; the small Node.js server only serves the static application and its health endpoint.

**Current release:** v3

## Fictional time and calendar

- 997 real milliseconds equal one fictional second.
- 59 fictional seconds equal one fictional minute.
- 61 fictional minutes equal one fictional hour.
- 23 fictional hours equal one calendar day.
- 7 calendar days make a week.
- Each year has 11 months of 29 days, 10 three-day Inter Regna, and a final four-day Inter Regnum from Month 11 to Month 1: 353 days total.

Inter Regnum days are full calendar days: they have a time of day and continue the week cycle, but do not belong to a month.

## Lunar cycle and tides

The fictional lunar system uses the same seconds, minutes, and hours as the calendar, but its day is independent: one lunar day lasts **31 fictional hours**. A lunar cycle contains **13 lunar days**, for a complete cycle of **403 fictional hours**.

The phases occur in this exact order: Rebirth, Horn, Crescent, Passage, Growing, Waxing, Ascent, Apex, Bite, Waning, Receding, Veil, and Death. Each phase lasts one complete lunar day. After Death, Rebirth begins the next lunar cycle.

Every lunar day contains a tide sequence:

- Low: 17 hours
- High: 13 hours
- Dry: 1 hour

Lunar days and tides do not reset at calendar midnight, calendar month boundaries, Inter Regna, or New Year. They advance directly from total elapsed fictional seconds; no real astronomical, geographic, or tidal data is used.

## Epoch

At Unix epoch `1970-01-01T00:00:00.000Z`, Insidia begins with:

- **Calendar:** Year 1, Month 1, Day 1, `00:00:00`
- **Lunar:** Cycle 1, Day 1 of 13, Rebirth, `00:00:00`
- **Tide:** Low, Hour 1 of 17

## Features

- Live, drift-resistant browser-side calculations from `Date.now()`
- Month, Inter Regnum, week, and day-of-year calendar metadata
- Independent lunar phase and 31-hour lunar clock display
- Low, High, and Dry tide status with elapsed period time
- Collapsible, two-space-formatted JSON snapshot containing `fictional.lunar`
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

Open [http://localhost:3000](http://localhost:3000). To use a different port, set `PORT` before starting the server:

```sh
PORT=5001 NODE_ENV=production npm start
```

The application validates an explicit `PORT` and listens on `0.0.0.0`, which is suitable for Heroku dynos. `CANONICAL_ORIGIN` is optional; without it, no canonical redirect is forced.

## Health check

`GET /health` returns:

```json
{"ok":true,"version":"v3"}
```

The calendar JSON schema deliberately remains at `"calendarVersion":"v2"`: v3 hardens deployment and server behavior without changing calendar, lunar, or tide data.

## Architecture

The frontend uses vanilla HTML, CSS, and JavaScript ES modules. [`public/calendar.js`](public/calendar.js) is a pure calculation module for calendar, lunar, and tide state. [`public/app.js`](public/app.js) renders one coherent browser-side snapshot on every fictional-second update. The Node.js server only serves static files and the health endpoint. There is no database, frontend framework, build step, runtime dependency, server-side calendar calculation, or real astronomy integration.

## Deploying to Heroku

Insidia v3 is prepared for Heroku's native GitHub automatic deployment integration. No GitHub Actions workflow exists for v3.

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
5. Leave **Wait for CI to pass before deploy** disabled for v3 because no CI workflow exists yet. Run `npm test` locally before pushing instead.

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

The health endpoint must return `{"ok":true,"version":"v3"}`. To inspect logs and dyno status:

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
│   ├── app.js          # Browser rendering, scheduling, and copy behavior
│   ├── calendar.js     # Pure calendar, lunar, and tide calculations
│   ├── index.html      # Application markup
│   └── styles.css      # Responsive system-font styling
├── test/
│   ├── calendar.test.js
│   ├── lunar.test.js
│   └── server.test.js
├── Procfile            # Heroku web process
├── .nvmrc              # Node.js production major
├── server.js           # Hardened static Node.js server
├── package.json
└── README.md
```

## Testing

Run the pure calendar/lunar/tide and server integration tests with Node's built-in test runner:

```sh
npm test
npm audit --omit=dev
```

The suite covers fictional time boundaries, lunar phases and tides, HTTP methods, cache/security headers, path containment, canonical redirects, port and origin validation, and SIGTERM shutdown.

## License

Released under the [MIT License](LICENSE).
