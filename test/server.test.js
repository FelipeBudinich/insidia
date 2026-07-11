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

test('GET and HEAD root serve the v5.3 document with Moon and progress fallback text', async () => {
  const server = await startTestServer();
  try {
    const getResponse = await request(server, '/');
    const headResponse = await request(server, '/', { method: 'HEAD' });
    assert.equal(getResponse.statusCode, 200);
    assert.equal(getResponse.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(getResponse.headers['cache-control'], 'no-cache');
    assert.match(getResponse.body, /aria-label="Application version 5\.3">v5\.3/);
    assert.match(getResponse.body, /id="season-name" class="season-name">Bones/);
    for (const bodyName of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Moon']) {
      assert.match(getResponse.body, new RegExp(` ${bodyName}</p>`));
    }
    assert.match(getResponse.body, /Dominant Pull/);
    assert.match(getResponse.body, /Moon · Venus · Mars/);
    assert.match(getResponse.body, /13 lunar days/);
    assert.ok(!getResponse.body.includes('29' + ' fictional days'));
    for (const progressLabel of ['Lunar Cycle', 'Current Phase', 'Current Season', 'Current Year', 'Current Day', 'Current Hour']) {
      assert.match(getResponse.body, new RegExp(`>${progressLabel}<`));
    }
    assertSecurityHeaders(getResponse.headers);
    assert.equal(headResponse.statusCode, 200);
    assert.equal(headResponse.body, '');
    assert.equal(headResponse.headers['content-type'], getResponse.headers['content-type']);
    assert.equal(headResponse.headers['content-security-policy'], getResponse.headers['content-security-policy']);
  } finally {
    await stopServer(server);
  }
});

test('GET and HEAD health return the v5.3 availability response', async () => {
  const server = await startTestServer();
  try {
    const getResponse = await request(server, '/health');
    const headResponse = await request(server, '/health', { method: 'HEAD' });
    assert.equal(getResponse.statusCode, 200);
    assert.equal(getResponse.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(getResponse.headers['cache-control'], 'no-store');
    assert.equal(getResponse.body, '{"ok":true,"version":"v5.3"}');
    assertSecurityHeaders(getResponse.headers);
    assert.equal(headResponse.statusCode, 200);
    assert.equal(headResponse.body, '');
    assert.equal(headResponse.headers['cache-control'], 'no-store');
  } finally {
    await stopServer(server);
  }
});

test('unknown routes and directories return generic 404 responses', async () => {
  const server = await startTestServer();
  try {
    for (const requestPath of ['/does-not-exist', '/public/']) {
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
    const javascript = await request(server, '/app.js');
    const css = await request(server, '/styles.css');
    assert.equal(javascript.statusCode, 200);
    assert.equal(javascript.headers['content-type'], 'text/javascript; charset=utf-8');
    assert.equal(javascript.headers['cache-control'], 'no-cache');
    assert.equal(css.statusCode, 200);
    assert.equal(css.headers['content-type'], 'text/css; charset=utf-8');
    assert.equal(css.headers['cache-control'], 'no-cache');
  } finally {
    await stopServer(server);
  }
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

test('Procfile and package metadata are ready for Heroku', async () => {
  const [procfile, packageText] = await Promise.all([
    readFile(path.join(projectDirectory, 'Procfile'), 'utf8'),
    readFile(path.join(projectDirectory, 'package.json'), 'utf8')
  ]);
  const packageJson = JSON.parse(packageText);
  assert.equal(procfile.trim(), 'web: npm start');
  assert.equal(packageJson.version, '5.3.0');
  assert.equal(packageJson.engines.node, '24.x');
});

test('calendar JSON schema is v7 with Moon, progress, and all existing state', () => {
  const snapshot = createCalendarJson(calculateFictionalCalendar(0), 0);
  assert.equal(snapshot.calendarVersion, 'v7');
  assert.equal(snapshot.fictional.season.name, 'Bones');
  assert.equal(snapshot.fictional.lunar.phase.name, 'Rebirth');
  assert.equal(snapshot.fictional.lunar.tide.name, 'Low');
  assert.equal(snapshot.fictional.orbits.bodies.length, 6);
  assert.equal(Object.keys(snapshot.fictional.progress).length, 6);
});

test('retired orbital metadata and Moon duration references are absent', async () => {
  const projectFiles = [
    'README.md',
    'public/app.js',
    'public/calendar.js',
    'public/index.html',
    'test/calendar.test.js',
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
