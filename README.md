# Insidia

Insidia is a live fictional clock and calendar. Its time is calculated entirely in the browser from the current Unix timestamp, while a deliberately small Node.js server serves the static application.

**Current release:** v1

## Fictional time

- 997 real milliseconds equal one fictional second.
- 59 fictional seconds equal one fictional minute.
- 61 fictional minutes equal one fictional hour.
- 23 fictional hours equal one fictional day.

## Fictional calendar

- 7 days per week
- 11 months per year
- 29 days per month
- 10 three-day Inter Regna, each between consecutive months
- one final four-day Inter Regnum from Month 11 to Month 1
- 353 days per year

Inter Regnum days are full calendar days: they have a time of day and continue the week cycle, but do not belong to a month.

## Epoch

At Unix epoch `1970-01-01T00:00:00.000Z`, Insidia begins at Year 1, Month 1, Day 1, `00:00:00`.

## Features

- Live, drift-resistant fictional clock calculated from `Date.now()`
- Month and Inter Regnum date display with week and day-of-year metadata
- Collapsible, two-space-formatted JSON snapshot
- Copy button that creates and copies a fresh snapshot
- Responsive, system-font interface with light/dark mode support
- Static-file server health endpoint

## Requirements

- Node.js 20 or newer

## Installation and local usage

```sh
npm install
npm test
npm start
```

Open [http://localhost:3000](http://localhost:3000).

To use a different port, set the `PORT` environment variable before starting the server:

```sh
PORT=8080 npm start
```

## Health check

`GET /health` returns the server status:

```json
{"ok":true,"version":"v1"}
```

## Architecture

The frontend is vanilla HTML, CSS, and JavaScript ES modules. All fictional clock and calendar calculations live in the browser in [`public/calendar.js`](public/calendar.js). The Node.js server only serves the static files and the health endpoint. There is no database, frontend framework, build step, or server-side calendar calculation.

## Project structure

```text
.
├── public/
│   ├── app.js          # Browser rendering, scheduling, and copy behavior
│   ├── calendar.js     # Pure fictional calendar module
│   ├── index.html      # Application markup
│   └── styles.css      # Responsive system-font styling
├── test/
│   └── calendar.test.js
├── server.js           # Minimal static Node.js server
├── package.json
└── README.md
```

## Testing

Run the pure calendar module tests with Node's built-in test runner:

```sh
npm test
```

The tests cover the epoch, fictional time boundaries, month and Inter Regnum transitions, year and weekday continuity, and invalid input.

## License

Released under the [MIT License](LICENSE).
