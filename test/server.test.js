import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createStaticServer,
  parseCanonicalOrigin,
  parsePort
} from '../server.js';
import { calculateFictionalCalendar, createCalendarJson } from '../public/calendar.js';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function startTestServer(options = {}) {
  const server = createStaticServer({ environment: 'development', ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
}

async function stopServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function request(server, requestPath, { method = 'GET', headers = {} } = {}) {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const clientRequest = http.request({
      host: '127.0.0.1',
      port: address.port,
      path: requestPath,
      method,
      headers
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        body: Buffer.concat(chunks).toString(),
        headers: response.headers,
        statusCode: response.statusCode
      }));
    });
    clientRequest.on('error', reject);
    clientRequest.end();
  });
}

function assertSecurityHeaders(headers) {
  const csp = headers['content-security-policy'];
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['x-xss-protection'], '0');
  assert.equal(headers['referrer-policy'], 'no-referrer');
  assert.equal(headers['cross-origin-opener-policy'], 'same-origin');
  assert.equal(headers['cross-origin-resource-policy'], 'same-origin');
  assert.equal(headers['permissions-policy'], 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), clipboard-read=(), clipboard-write=(self)');
  assert.equal(headers['x-dns-prefetch-control'], 'off');
  assert.equal(headers['x-permitted-cross-domain-policies'], 'none');
  assert.equal(headers['x-powered-by'], undefined);
  for (const directive of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'none'"]) {
    assert.ok(csp.includes(directive));
  }
  assert.ok(!csp.includes("'unsafe-inline'"));
  assert.ok(!csp.includes("'unsafe-eval'"));
}

test('GET and HEAD root redirect securely to the calendar route', async () => {
  const server = await startTestServer();
  try {
    const getResponse = await request(server, '/');
    const headResponse = await request(server, '/', { method: 'HEAD' });
    assert.equal(getResponse.statusCode, 302);
    assert.equal(getResponse.headers.location, '/calendar.html');
    assert.equal(getResponse.headers['cache-control'], 'no-store');
    assert.equal(getResponse.body, '');
    assertSecurityHeaders(getResponse.headers);
    assert.equal(headResponse.statusCode, 302);
    assert.equal(headResponse.headers.location, '/calendar.html');
    assert.equal(headResponse.headers['cache-control'], 'no-store');
    assert.equal(headResponse.body, '');
    assert.equal(headResponse.headers['content-security-policy'], getResponse.headers['content-security-policy']);
  } finally {
    await stopServer(server);
  }
});

test('GET and HEAD health return the v6.6 availability response', async () => {
  const server = await startTestServer();
  try {
    const getResponse = await request(server, '/health');
    const headResponse = await request(server, '/health', { method: 'HEAD' });
    assert.equal(getResponse.statusCode, 200);
    assert.equal(getResponse.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(getResponse.headers['cache-control'], 'no-store');
    assert.equal(getResponse.body, '{"ok":true,"version":"v6.6"}');
    assertSecurityHeaders(getResponse.headers);
    assert.equal(headResponse.statusCode, 200);
    assert.equal(headResponse.body, '');
    assert.equal(headResponse.headers['cache-control'], 'no-store');
  } finally {
    await stopServer(server);
  }
});

test('all three HTML routes serve secure no-cache documents with shared navigation', async () => {
  const server = await startTestServer();
  const pageDefinitions = [
    { path: '/calendar.html', activeLabel: 'Calendar', title: 'Calendar · Insidia' },
    { path: '/outcome.html', activeLabel: 'Outcome', title: 'Outcome · Insidia' },
    { path: '/weather.html', activeLabel: 'Weather', title: 'Weather · Insidia' }
  ];
  try {
    for (const page of pageDefinitions) {
      const getResponse = await request(server, page.path);
      const headResponse = await request(server, page.path, { method: 'HEAD' });
      assert.equal(getResponse.statusCode, 200, page.path);
      assert.equal(getResponse.headers['content-type'], 'text/html; charset=utf-8', page.path);
      assert.equal(getResponse.headers['cache-control'], 'no-cache', page.path);
      assert.match(getResponse.body, new RegExp(`<title>${page.title}</title>`), page.path);
      assert.match(getResponse.body, /aria-label="Application version 6\.6">v6\.6/, page.path);
      assert.match(getResponse.body, /<nav class="primary-nav" aria-label="Primary">/, page.path);
      for (const [href, label] of [
        ['/calendar.html', 'Calendar'],
        ['/outcome.html', 'Outcome'],
        ['/weather.html', 'Weather']
      ]) {
        assert.match(getResponse.body, new RegExp(`<a href="${href}"(?: aria-current="page")?>${label}</a>`), page.path);
      }
      assert.equal((getResponse.body.match(/aria-current="page"/g) ?? []).length, 1, page.path);
      assert.match(
        getResponse.body,
        new RegExp(`<a href="${page.path}" aria-current="page">${page.activeLabel}</a>`),
        page.path
      );
      assertSecurityHeaders(getResponse.headers);
      assert.equal(headResponse.statusCode, 200, page.path);
      assert.equal(headResponse.body, '', page.path);
      assert.equal(headResponse.headers['content-type'], getResponse.headers['content-type'], page.path);
      assert.equal(headResponse.headers['cache-control'], 'no-cache', page.path);
      assertSecurityHeaders(headResponse.headers);
    }
  } finally {
    await stopServer(server);
  }
});

test('calendar route keeps date, lunar metadata, and JSON while removing clocks and Progress UI', async () => {
  const server = await startTestServer();
  try {
    const response = await request(server, '/calendar.html');
    for (const requiredContent of [
      'Fictional Calendar', 'Month 1 · Day 1', 'Week 1 · Day 1 of 7',
      'Lunar Cycle', 'Rebirth', 'Lunar Day 1 of 13 · Cycle 1',
      'JSON output', 'Copy JSON',
      'Epoch: 1970-01-01 00:00:00 UTC'
    ]) {
      assert.ok(response.body.includes(requiredContent), requiredContent);
    }
    for (const removedMarkup of [
      'class="season-section"',
      'data-tide-name',
      'class="orbital-section"',
      'data-pull-key="dominantPull"',
      'data-pull-key="minorPull"',
      'data-pull-key="negativePull"',
      'id="fictional-time"',
      'id="lunar-time"',
      'id="progress-heading"',
      'class="progress-section"',
      'data-progress-key',
      'data-progress-percentage'
    ]) {
      assert.ok(!response.body.includes(removedMarkup), removedMarkup);
    }
    assert.match(response.body, /src="\/calendar-page\.js"/);
  } finally {
    await stopServer(server);
  }
});

test('Outcome route begins with Outcome and retains its fields before Tide, Pulls, Orbits, and Progress', async () => {
  const server = await startTestServer();
  try {
    const response = await request(server, '/outcome.html');
    for (const requiredContent of [
      'Outcome', '☾</span> Moon', 'Outcome: Common', 'Attempts until Rare: 100',
      'Low · Minor Pull', 'Orbital progress: 0.000000%',
      'Furthest from orbit completion', 'Fixed-priority tie-break applied',
      'Tide', 'Low', 'Hour 1 of 17', '00:00:00 into Low', 'Celestial Orbits',
      'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Moon',
      'Dominant Pull', 'Minor Pull', 'Negative Pull',
      'Pulls measure fictional orbital-phase clustering, not physical gravity.',
      'Progress', 'Current Hour', 'id="hour-progress" max="100" value="0"',
      'id="hour-progress-value">0.000000%'
    ]) {
      assert.ok(response.body.includes(requiredContent), requiredContent);
    }
    const outcomeIndex = response.body.indexOf('id="outcome-heading"');
    const tideIndex = response.body.indexOf('id="tide-heading"');
    const pullsIndex = response.body.indexOf('id="orbital-pulls-heading"');
    const orbitsIndex = response.body.indexOf('id="orbital-heading"');
    const progressIndex = response.body.indexOf('id="progress-heading"');
    const footerIndex = response.body.indexOf('<footer>');
    assert.ok(outcomeIndex < tideIndex, 'Outcome must appear before Tide');
    assert.ok(tideIndex < pullsIndex, 'Tide must appear before Orbital Pulls');
    assert.ok(pullsIndex < orbitsIndex, 'Orbital Pulls must appear before Celestial Orbits');
    assert.ok(orbitsIndex < progressIndex, 'Celestial Orbits must appear before Progress');
    assert.ok(progressIndex < footerIndex, 'Progress must be the final card before the footer');
    assert.match(
      response.body,
      /<main class="container">\s*<section class="outcome-section focused-section" aria-labelledby="outcome-heading">/
    );
    assert.ok(!response.body.includes('class="page-header"'));
    assert.ok(!response.body.includes('class="page-kicker"'));
    assert.ok(!response.body.includes('<h1>Outcome</h1>'));

    const outcomeFieldIds = [
      'outcome-body', 'outcome-type', 'outcome-attempts', 'outcome-source',
      'outcome-progress', 'outcome-rule', 'outcome-tiebreak'
    ];
    const outcomeFieldIndexes = outcomeFieldIds.map((id) => response.body.indexOf(`id="${id}"`));
    assert.deepEqual([...outcomeFieldIndexes].sort((a, b) => a - b), outcomeFieldIndexes);

    const progressCard = response.body.slice(progressIndex, footerIndex);
    assert.equal((response.body.match(/id="progress-heading"/g) ?? []).length, 1);
    for (const excludedRow of [
      'Lunar Cycle', 'Current Phase', 'Current Season', 'Current Year', 'Current Day'
    ]) {
      assert.ok(!progressCard.includes(excludedRow), excludedRow);
    }
    assert.equal((response.body.match(/0\.000000%/g) ?? []).length >= 9, true);
    assert.match(response.body, /src="\/outcome-page\.js"/);
    assert.ok(!response.body.includes('JSON output'));
  } finally {
    await stopServer(server);
  }
});

test('superseded classification names are absent from source and styling', async () => {
  const [calendarSource, rendererSource, outcomeHtml, styles] = await Promise.all([
    readFile(path.join(projectDirectory, 'public/calendar.js'), 'utf8'),
    readFile(path.join(projectDirectory, 'public/renderers.js'), 'utf8'),
    readFile(path.join(projectDirectory, 'public/outcome.html'), 'utf8'),
    readFile(path.join(projectDirectory, 'public/styles.css'), 'utf8')
  ]);
  const removedWord = ['re', 'ward'].join('');
  const removedApiName = ['calculateOutcome', 'Re', 'ward'].join('');
  for (const source of [calendarSource, rendererSource, outcomeHtml, styles]) {
    assert.ok(!source.toLowerCase().includes(removedWord));
  }
  assert.ok(!calendarSource.includes(removedApiName));
});

test('weather route orders Time, Season, and exactly three selected Progress rows', async () => {
  const server = await startTestServer();
  try {
    const response = await request(server, '/weather.html');
    for (const requiredContent of [
      'id="time-heading" class="section-label">Time',
      'Current Fictional Time', 'id="fictional-time" class="weather-clock">00:00:00',
      'Current Lunar Time', 'id="lunar-time" class="weather-clock">00:00:00',
      'Season', 'Bones', 'Day 1 of 179 · Seasonal Cycle 1',
      'Seasonal Day 1 of 358', 'Next: Tears', 'Progress: 0.000000%',
      'id="progress-heading" class="section-label">Progress',
      'Current Lunar Day', 'id="lunar-day-progress" max="100" value="0"',
      'id="lunar-day-progress-value">0.000000%',
      'Current Day', 'id="day-progress" max="100" value="0"',
      'id="day-progress-value">0.000000%',
      'Current Hour', 'id="hour-progress" max="100" value="0"',
      'id="hour-progress-value">0.000000%'
    ]) {
      assert.ok(response.body.includes(requiredContent), requiredContent);
    }
    assert.match(response.body, /aria-label="Current season progress"/);
    const timeIndex = response.body.indexOf('id="time-heading"');
    const seasonIndex = response.body.indexOf('id="season-heading"');
    const progressIndex = response.body.indexOf('id="progress-heading"');
    const footerIndex = response.body.indexOf('<footer>');
    assert.ok(timeIndex < seasonIndex, 'Time must appear before Season');
    assert.ok(seasonIndex < progressIndex, 'Season must appear before Progress');
    assert.ok(progressIndex < footerIndex, 'Progress must be the final card');
    const progressCard = response.body.slice(progressIndex, footerIndex);
    assert.equal((progressCard.match(/class="progress-item"/g) ?? []).length, 3);
    for (const excludedRow of ['Lunar Cycle', 'Current Phase', 'Current Season', 'Current Year']) {
      assert.ok(!progressCard.includes(excludedRow), excludedRow);
    }
    assert.match(response.body, /src="\/weather-page\.js"/);
    assert.ok(!response.body.includes('JSON output'));
  } finally {
    await stopServer(server);
  }
});

test('unknown routes and directories return generic 404 responses', async () => {
  const server = await startTestServer();
  try {
    for (const requestPath of ['/does-not-exist', '/missing.html', '/missing.js', '/public/']) {
      const response = await request(server, requestPath);
      assert.equal(response.statusCode, 404);
      assert.equal(response.body, 'Not Found');
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.ok(!response.body.includes(projectDirectory));
    }
  } finally {
    await stopServer(server);
  }
});

test('unsupported methods return 405 and declare supported methods', async () => {
  const server = await startTestServer();
  try {
    const response = await request(server, '/', { method: 'POST' });
    assert.equal(response.statusCode, 405);
    assert.equal(response.body, 'Method Not Allowed');
    assert.equal(response.headers.allow, 'GET, HEAD');
    assert.equal(response.headers['cache-control'], 'no-store');
    assertSecurityHeaders(response.headers);
  } finally {
    await stopServer(server);
  }
});

test('malformed encoding and representative traversal paths fail safely', async () => {
  const server = await startTestServer();
  try {
    const malformed = await request(server, '/%');
    assert.equal(malformed.statusCode, 400);
    assert.equal(malformed.body, 'Bad Request');

    for (const requestPath of [
      '/../package.json',
      '/%2e%2e/package.json',
      '/%2E%2E%2Fpackage.json',
      '/%252e%252e%252fpackage.json',
      '/.env',
      '/.git/config',
      '/%00',
      '/public/../../server.js'
    ]) {
      const response = await request(server, requestPath);
      assert.equal(response.statusCode, 404, requestPath);
      assert.equal(response.body, 'Not Found', requestPath);
      assert.ok(!response.body.includes('server.js'), requestPath);
    }
  } finally {
    await stopServer(server);
  }
});

test('static JavaScript and CSS use explicit types and no-cache', async () => {
  const server = await startTestServer();
  try {
    const css = await request(server, '/styles.css');
    for (const scriptPath of [
      '/calendar.js', '/live-state.js', '/renderers.js',
      '/calendar-page.js', '/outcome-page.js', '/weather-page.js'
    ]) {
      const javascript = await request(server, scriptPath);
      assert.equal(javascript.statusCode, 200, scriptPath);
      assert.equal(javascript.headers['content-type'], 'text/javascript; charset=utf-8', scriptPath);
      assert.equal(javascript.headers['cache-control'], 'no-cache', scriptPath);
    }
    assert.equal(css.statusCode, 200);
    assert.equal(css.headers['content-type'], 'text/css; charset=utf-8');
    assert.equal(css.headers['cache-control'], 'no-cache');
  } finally {
    await stopServer(server);
  }
});

test('calendar copy uses the Clipboard API and keeps the manual-selection failure state', async () => {
  const [calendarPage, calendarHtml] = await Promise.all([
    readFile(path.join(projectDirectory, 'public/calendar-page.js'), 'utf8'),
    readFile(path.join(projectDirectory, 'public/calendar.html'), 'utf8')
  ]);
  const deprecatedCommand = ['exec', 'Command'].join('');
  const removedHelper = ['copyWith', 'LegacyCommand'].join('');
  const hiddenInputElement = ['text', 'area'].join('');

  assert.match(calendarPage, /navigator\.clipboard\.writeText\(text\)/);
  assert.match(calendarPage, /Clipboard API is unavailable/);
  assert.match(
    calendarPage,
    /Unable to copy\. Select the JSON and copy it manually\./
  );
  assert.ok(!calendarPage.includes(deprecatedCommand));
  assert.ok(!calendarPage.includes(removedHelper));
  assert.ok(!calendarPage.includes(hiddenInputElement));
  assert.match(calendarHtml, /<pre id="json-output" tabindex="0">/);
});

test('all page modules use the shared live-state scheduler and shared renderers', async () => {
  const liveState = await readFile(path.join(projectDirectory, 'public/live-state.js'), 'utf8');
  const renderers = await readFile(path.join(projectDirectory, 'public/renderers.js'), 'utf8');
  const calendarPage = await readFile(path.join(projectDirectory, 'public/calendar-page.js'), 'utf8');
  const pageModuleNames = ['calendar-page.js', 'outcome-page.js', 'weather-page.js'];

  assert.match(liveState, /calculateFictionalCalendar\(realUnixMilliseconds\)/);
  assert.match(liveState, /const realUnixMilliseconds = Date\.now\(\)/);
  assert.match(liveState, /window\.setTimeout\(update/);
  assert.match(liveState, /visibilitychange/);
  assert.ok(!renderers.includes('Date.now'));
  assert.ok(!renderers.includes('calculateFictionalCalendar'));
  assert.ok(!renderers.includes('innerHTML'));
  assert.match(renderers, /export function createOutcomeRenderer/);
  for (const removedCalendarBinding of [
    'createSeasonRenderer',
    'createTideRenderer',
    'createCelestialOrbitsRenderer',
    'createOrbitalPullsRenderer',
    'data-season-',
    'data-tide-',
    'data-orbital-body',
    'data-pull-key',
    'formatFictionalTime',
    'formatLunarTime',
    '#fictional-time',
    '#lunar-time',
    'data-progress-key',
    'progressElements'
  ]) {
    assert.ok(!calendarPage.includes(removedCalendarBinding), removedCalendarBinding);
  }

  for (const moduleName of pageModuleNames) {
    const moduleText = await readFile(path.join(projectDirectory, 'public', moduleName), 'utf8');
    assert.match(moduleText, /from '\.\/live-state\.js'/, moduleName);
    assert.match(moduleText, /startLiveState\(/, moduleName);
    assert.ok(!moduleText.includes('setInterval'), moduleName);
    assert.ok(!moduleText.includes('scheduleNextUpdate'), moduleName);
    assert.ok(!moduleText.includes('REAL_MS_PER_FICTIONAL_SECOND'), moduleName);
    assert.ok(!moduleText.includes('calculateFictionalCalendar'), moduleName);
    assert.ok(!moduleText.includes('innerHTML'), moduleName);
  }
  const outcomePage = await readFile(path.join(projectDirectory, 'public/outcome-page.js'), 'utf8');
  const weatherPage = await readFile(path.join(projectDirectory, 'public/weather-page.js'), 'utf8');
  const outcomeCall = outcomePage.indexOf('renderOutcome(calendarValue.outcome)');
  const tideCall = outcomePage.indexOf('renderTide(calendarValue)');
  const pullsCall = outcomePage.indexOf('renderOrbitalPulls(calendarValue)');
  const orbitsCall = outcomePage.indexOf('renderCelestialOrbits(calendarValue)');
  assert.ok(outcomeCall < tideCall && tideCall < pullsCall && pullsCall < orbitsCall);
  const timeCall = weatherPage.indexOf('renderTime(calendarValue)');
  const seasonCall = weatherPage.indexOf('renderSeason(calendarValue)');
  const progressCall = weatherPage.indexOf('renderProgress(calendarValue)');
  assert.ok(timeCall < seasonCall && seasonCall < progressCall);
  assert.match(renderers, /formatFictionalTime\(calendarValue\)/);
  assert.match(renderers, /formatLunarTime\(calendarValue\.lunar\)/);
  assert.match(renderers, /\['lunarPhase', '#lunar-day-progress', '#lunar-day-progress-value'\]/);
  assert.match(renderers, /\['day', '#day-progress', '#day-progress-value'\]/);
  assert.match(renderers, /\['hour', '#hour-progress', '#hour-progress-value'\]/);
  assert.match(renderers, /row\.progress\.value = progressValue\.percentage/);

  await assert.rejects(
    readFile(path.join(projectDirectory, 'public/index.html'), 'utf8'),
    { code: 'ENOENT' }
  );
  await assert.rejects(
    readFile(path.join(projectDirectory, 'public/app.js'), 'utf8'),
    { code: 'ENOENT' }
  );
});

test('production adds HSTS while development omits it', async () => {
  const productionServer = await startTestServer({ environment: 'production' });
  const developmentServer = await startTestServer({ environment: 'development' });
  try {
    const productionResponse = await request(productionServer, '/health');
    const developmentResponse = await request(developmentServer, '/health');
    assert.equal(productionResponse.headers['strict-transport-security'], 'max-age=31536000; includeSubDomains');
    assert.equal(developmentResponse.headers['strict-transport-security'], undefined);
  } finally {
    await stopServer(productionServer);
    await stopServer(developmentServer);
  }
});

test('port parsing accepts only valid explicit TCP ports', () => {
  assert.equal(parsePort(undefined), 3000);
  assert.equal(parsePort('1'), 1);
  assert.equal(parsePort('3000'), 3000);
  assert.equal(parsePort('65535'), 65535);
  for (const value of ['', ' ', '0', '-1', '65536', '1.5', '3000abc', 3000, null]) {
    assert.throws(() => parsePort(value), /PORT/);
  }
});

test('canonical origin parsing only accepts normalized HTTPS origins', () => {
  assert.equal(parseCanonicalOrigin(undefined), null);
  assert.equal(parseCanonicalOrigin('https://example.com'), 'https://example.com');
  assert.equal(parseCanonicalOrigin('https://example.com/'), 'https://example.com');
  for (const value of [
    'http://example.com',
    'https://user:pass@example.com',
    'https://example.com/path',
    'https://example.com/?query=1',
    'https://example.com/#fragment',
    'javascript:alert(1)',
    'example.com',
    null
  ]) {
    assert.throws(() => parseCanonicalOrigin(value), /CANONICAL_ORIGIN/);
  }
});

test('canonical redirects use only the validated origin and secure protocol chain', async () => {
  const server = await startTestServer({
    canonicalOrigin: 'https://canonical.example',
    environment: 'production'
  });
  try {
    const hostileHost = await request(server, '/path?value=1', {
      headers: { Host: 'attacker.example', 'X-Forwarded-Proto': 'https' }
    });
    assert.equal(hostileHost.statusCode, 308);
    assert.equal(hostileHost.headers.location, 'https://canonical.example/path?value=1');
    assert.equal(hostileHost.headers['cache-control'], 'no-store');
    assertSecurityHeaders(hostileHost.headers);

    const hostileRoot = await request(server, '/', {
      headers: { Host: 'attacker.example', 'X-Forwarded-Proto': 'https' }
    });
    assert.equal(hostileRoot.statusCode, 308);
    assert.equal(hostileRoot.headers.location, 'https://canonical.example/');

    for (const forwardedProto of ['http', 'https,http', 'http,https', 'HTTPS,http']) {
      const response = await request(server, '/health', {
        headers: { Host: 'canonical.example', 'X-Forwarded-Proto': forwardedProto }
      });
      assert.equal(response.statusCode, 308, forwardedProto);
      assert.equal(response.headers.location, 'https://canonical.example/health', forwardedProto);
    }

    const canonicalSecureRequest = await request(server, '/does-not-exist', {
      headers: { Host: 'canonical.example', 'X-Forwarded-Proto': 'HTTPS, https' }
    });
    assert.equal(canonicalSecureRequest.statusCode, 404);
    assert.equal(canonicalSecureRequest.headers.location, undefined);

    const canonicalSecureRoot = await request(server, '/', {
      headers: { Host: 'canonical.example', 'X-Forwarded-Proto': 'HTTPS, https' }
    });
    assert.equal(canonicalSecureRoot.statusCode, 302);
    assert.equal(canonicalSecureRoot.headers.location, '/calendar.html');
  } finally {
    await stopServer(server);
  }
});

test('server hardening limits are configured', () => {
  const server = createStaticServer();
  try {
    assert.equal(server.requestTimeout, 30_000);
    assert.equal(server.headersTimeout, 30_000);
    assert.equal(server.keepAliveTimeout, 95_000);
    assert.equal(server.maxHeadersCount, 100);
  } finally {
    server.close();
  }
});

test('malformed raw HTTP invokes a generic client error response', async () => {
  const server = await startTestServer();
  const address = server.address();
  try {
    const rawResponse = await new Promise((resolve, reject) => {
      const socket = net.connect(address.port, '127.0.0.1');
      const chunks = [];
      socket.on('connect', () => socket.write('GET / HTTP/1.1\r\nHost: example.test\r\nBroken Header\r\n\r\n'));
      socket.on('data', (chunk) => chunks.push(chunk));
      socket.on('end', () => resolve(Buffer.concat(chunks).toString()));
      socket.on('error', reject);
    });
    assert.match(rawResponse, /^HTTP\/1\.1 400 Bad Request/);
    assert.match(rawResponse, /Content-Security-Policy:/);
    assert.ok(!rawResponse.includes('Parse Error'));
  } finally {
    await stopServer(server);
  }
});

test('Procfile and Node 24 package metadata are synchronized for Heroku', async () => {
  const [procfile, packageText, lockText, nvmrc] = await Promise.all([
    readFile(path.join(projectDirectory, 'Procfile'), 'utf8'),
    readFile(path.join(projectDirectory, 'package.json'), 'utf8'),
    readFile(path.join(projectDirectory, 'package-lock.json'), 'utf8'),
    readFile(path.join(projectDirectory, '.nvmrc'), 'utf8')
  ]);
  const packageJson = JSON.parse(packageText);
  const packageLock = JSON.parse(lockText);
  assert.equal(procfile.trim(), 'web: npm start');
  assert.equal(packageJson.version, '6.6.0');
  assert.equal(packageJson.engines.node, '24.x');
  assert.equal(packageLock.packages[''].engines.node, '24.x');
  assert.equal(nvmrc.trim(), '24');
});

test('calendar JSON schema is v8 with all three orbital pulls', () => {
  const snapshot = createCalendarJson(calculateFictionalCalendar(0), 0);
  assert.equal(snapshot.calendarVersion, 'v8');
  assert.equal(snapshot.fictional.season.name, 'Bones');
  assert.equal(snapshot.fictional.lunar.phase.name, 'Rebirth');
  assert.equal(snapshot.fictional.lunar.tide.name, 'Low');
  assert.equal(snapshot.fictional.orbits.bodies.length, 6);
  assert.ok(snapshot.fictional.season);
  assert.ok(snapshot.fictional.time);
  assert.ok(snapshot.fictional.lunar.time);
  assert.ok(snapshot.fictional.lunar.tide);
  assert.ok(snapshot.fictional.orbits.dominantPull);
  assert.ok(snapshot.fictional.orbits.minorPull);
  assert.ok(snapshot.fictional.orbits.negativePull);
  assert.ok(snapshot.fictional.progress.season);
  assert.equal('outcome' in snapshot.fictional, false);
  assert.deepEqual(
    Object.keys(snapshot.fictional.orbits).filter((key) => key.endsWith('Pull')),
    ['dominantPull', 'minorPull', 'negativePull']
  );
  assert.deepEqual(Object.keys(snapshot.fictional.progress), [
    'lunarCycle', 'lunarPhase', 'season', 'year', 'day', 'hour'
  ]);
});

test('retired orbital metadata and Moon duration references are absent', async () => {
  const projectFiles = [
    'README.md',
    'public/calendar-page.js',
    'public/calendar.js',
    'public/calendar.html',
    'public/renderers.js',
    'public/outcome.html',
    'public/weather.html',
    'test/calendar.test.js',
    'test/outcome.test.js',
    'test/lunar.test.js',
    'test/orbits.test.js',
    'test/progress.test.js',
    'test/season.test.js'
  ];
  const retiredMoonDayCount = String(20 + 9);
  const retiredNames = [
    'earth' + 'ProximityRank',
    'earth' + '_proximity',
    'orbitalPeriodDays: ' + retiredMoonDayCount,
    retiredMoonDayCount + ' fictional days',
    "Moon's " + retiredMoonDayCount + '-day orbit'
  ];
  for (const projectFile of projectFiles) {
    const content = await readFile(path.join(projectDirectory, projectFile), 'utf8');
    for (const retiredName of retiredNames) {
      assert.ok(!content.includes(retiredName), `${retiredName} remains in ${projectFile}`);
    }
  }
});

async function findAvailablePort() {
  const portServer = net.createServer();
  portServer.listen(0, '127.0.0.1');
  await once(portServer, 'listening');
  const { port } = portServer.address();
  await new Promise((resolve, reject) => portServer.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function waitForHealth(port) {
  let lastError;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await new Promise((resolve, reject) => {
        const request = http.get({ host: '127.0.0.1', path: '/health', port }, resolve);
        request.on('error', reject);
      });
      if (response.statusCode === 200) {
        response.resume();
        return;
      }
      response.resume();
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw lastError ?? new Error('Server did not become healthy');
}

test('SIGTERM closes the production server cleanly', { timeout: 8_000 }, async () => {
  const port = await findAvailablePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: projectDirectory,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port) },
    stdio: 'ignore'
  });

  try {
    await waitForHealth(port);
    child.kill('SIGTERM');
    const [exitCode, signal] = await once(child, 'exit');
    assert.equal(signal, null);
    assert.equal(exitCode, 0);
  } finally {
    if (!child.killed) {
      child.kill('SIGKILL');
    }
  }
});
