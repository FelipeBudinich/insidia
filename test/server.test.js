import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';
import { createStaticEtag, createStaticServer, installGracefulShutdown, parsePort } from '../server.js';

async function start(options = {}) {
  const server = createStaticServer({ environment: 'development', ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
}

async function stop(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function request(server, requestPath, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: requestPath, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
}

function assertSecurityHeaders(headers) {
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['referrer-policy'], 'no-referrer');
  assert.equal(headers['cross-origin-opener-policy'], 'same-origin');
  assert.equal(headers['cross-origin-resource-policy'], 'same-origin');
  assert.match(headers['content-security-policy'], /default-src 'self'/);
  assert.match(headers['content-security-policy'], /connect-src 'self'/);
  assert.doesNotMatch(headers['content-security-policy'], /unsafe-inline|unsafe-eval/);
}

test('root redirect preserves only a non-empty locale for GET and HEAD', async () => {
  const server = await start();
  const cases = [
    ['/', '/calendario.html'],
    ['/?locale=es', '/calendario.html?locale=es'],
    ['/?universe=other&locale=es', '/calendario.html?locale=es'],
    ['/?universe=other', '/calendario.html'],
    ['/?locale=es&unused=value', '/calendario.html?locale=es'],
    ['/?unused=value&locale=en', '/calendario.html?locale=en'],
    ['/?locale=', '/calendario.html']
  ];
  try {
    for (const [requestPath, location] of cases) {
      for (const method of ['GET', 'HEAD']) {
        const response = await request(server, requestPath, { method });
        assert.equal(response.status, 302, `${method} ${requestPath}`);
        assert.equal(response.headers.location, location, `${method} ${requestPath}`);
        assert.equal(response.headers['cache-control'], 'no-store');
        assert.equal(response.body, '');
        assertSecurityHeaders(response.headers);
      }
    }
  } finally { await stop(server); }
});

test('canonical HTTPS redirect takes precedence and preserves the original request URL', async () => {
  const server = await start({ environment: 'production', canonicalOrigin: 'https://example.test' });
  try {
    const response = await request(server, '/?universe=other&locale=es', { headers: { host: 'wrong.test', 'x-forwarded-proto': 'http' } });
    assert.equal(response.status, 308);
    assert.equal(response.headers.location, 'https://example.test/?universe=other&locale=es');
    assert.equal(response.headers['strict-transport-security'], 'max-age=31536000; includeSubDomains');
  } finally { await stop(server); }
});

test('health reports v8.5 JSON for GET and HEAD', async () => {
  const server = await start();
  try {
    const get = await request(server, '/health');
    const head = await request(server, '/health', { method: 'HEAD' });
    assert.equal(get.status, 200);
    assert.equal(get.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(get.headers['cache-control'], 'no-store');
    assert.equal(get.body, '{"ok":true,"version":"v8.5"}');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assertSecurityHeaders(get.headers);
  } finally { await stop(server); }
});

test('fixed nomenclature has JSON MIME, no-cache, and no configurable endpoint', async () => {
  const server = await start();
  try {
    const response = await request(server, '/config/nomenclature.json', {
      headers: { 'x-nomenclature': '/other.json', 'x-universe': 'other' }
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(response.headers['cache-control'], 'no-cache');
    assert.equal(JSON.parse(response.body).application.displayName, 'Insidia');
    for (const requestPath of ['/config?file=nomenclature.json', '/universes/index.json', '/universe-loader.js']) {
      assert.equal((await request(server, requestPath)).status, 404);
    }
  } finally { await stop(server); }
});

test('successful static files include MIME, caching, validators, and security headers', async () => {
  const server = await start();
  try {
    for (const [file, type] of [
      ['/calendario.html', 'text/html; charset=utf-8'],
      ['/destino.html', 'text/html; charset=utf-8'],
      ['/tempore.html', 'text/html; charset=utf-8'],
      ['/calendario-page.js', 'text/javascript; charset=utf-8'],
      ['/destino-page.js', 'text/javascript; charset=utf-8'],
      ['/tempore-page.js', 'text/javascript; charset=utf-8'],
      ['/styles.css', 'text/css; charset=utf-8'],
      ['/core/mechanics.js', 'text/javascript; charset=utf-8'],
      ['/locales/en.json', 'application/json; charset=utf-8'],
      ['/config/nomenclature.json', 'application/json; charset=utf-8']
    ]) {
      const response = await request(server, file);
      const head = await request(server, file, { method: 'HEAD' });
      assert.equal(response.status, 200, file);
      assert.equal(response.headers['content-type'], type, file);
      assert.equal(response.headers['cache-control'], 'no-cache', file);
      assert.match(response.headers.etag, /^W\/"[0-9a-f]+-[0-9a-f]+(?:\.[0-9a-f]+)?"$/, file);
      assert.equal(Number.isNaN(Date.parse(response.headers['last-modified'])), false, file);
      assertSecurityHeaders(response.headers);
      assert.equal(head.status, 200, `HEAD ${file}`);
      assert.equal(head.body, '', `HEAD ${file}`);
      assert.equal(head.headers['content-type'], type, `HEAD ${file}`);
      assert.equal(head.headers['cache-control'], 'no-cache', `HEAD ${file}`);
      assert.equal(head.headers.etag, response.headers.etag, `HEAD ${file}`);
      assert.equal(head.headers['last-modified'], response.headers['last-modified'], `HEAD ${file}`);
      assert.equal(Number(head.headers['content-length']), Buffer.byteLength(response.body), `HEAD ${file}`);
      assertSecurityHeaders(head.headers);
    }
  } finally { await stop(server); }
});

test('static ETags are deterministic, path-free metadata validators', () => {
  const first = createStaticEtag({ size: 4096, mtimeMs: 123456789 });
  assert.equal(first, 'W/"1000-75bcd15"');
  assert.equal(createStaticEtag({ size: 4096, mtimeMs: 123456789 }), first);
  assert.notEqual(createStaticEtag({ size: 4097, mtimeMs: 123456789 }), first);
  assert.notEqual(createStaticEtag({ size: 4096, mtimeMs: 123456790 }), first);
  assert.notEqual(createStaticEtag({ size: 4096, mtimeMs: 123456789.5 }), first);
  assert.doesNotMatch(first.slice(2), /\/|\\|calendario/);
});

test('If-None-Match supports exact, wildcard, lists, weak comparison, and nonmatches', async () => {
  const server = await start();
  try {
    const initial = await request(server, '/calendario.html');
    const etag = initial.headers.etag;
    for (const value of [etag, '*', `"other", ${etag}`, etag.replace(/^W\//, '')]) {
      const response = await request(server, '/calendario.html', { headers: { 'if-none-match': value } });
      assert.equal(response.status, 304, value);
      assert.equal(response.body, '', value);
      assert.equal(response.headers.etag, etag, value);
      assert.equal(response.headers['last-modified'], initial.headers['last-modified'], value);
      assert.equal(response.headers['cache-control'], initial.headers['cache-control'], value);
      assert.equal(response.headers['content-length'], undefined, value);
      assertSecurityHeaders(response.headers);
    }
    assert.equal((await request(server, '/calendario.html', { headers: { 'if-none-match': 'W/"not-current"' } })).status, 200);
  } finally { await stop(server); }
});

test('If-Modified-Since handles matching, stale, invalid, and If-None-Match precedence', async () => {
  const server = await start();
  try {
    const initial = await request(server, '/styles.css');
    const modified = Date.parse(initial.headers['last-modified']);
    const matching = await request(server, '/styles.css', { headers: { 'if-modified-since': initial.headers['last-modified'] } });
    assert.equal(matching.status, 304);
    assert.equal(matching.body, '');
    assert.equal(matching.headers.etag, initial.headers.etag);
    assertSecurityHeaders(matching.headers);
    assert.equal((await request(server, '/styles.css', {
      headers: { 'if-modified-since': new Date(modified - 86_400_000).toUTCString() }
    })).status, 200);
    assert.equal((await request(server, '/styles.css', { headers: { 'if-modified-since': 'not-a-date' } })).status, 200);
    assert.equal((await request(server, '/styles.css', {
      headers: {
        'if-none-match': 'W/"not-current"',
        'if-modified-since': new Date(modified + 86_400_000).toUTCString()
      }
    })).status, 200);
  } finally { await stop(server); }
});

test('static HEAD returns validators and length without a body, including conditional 304', async () => {
  const server = await start();
  try {
    const get = await request(server, '/calendario.html');
    const head = await request(server, '/calendario.html', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.equal(head.headers.etag, get.headers.etag);
    assert.equal(head.headers['last-modified'], get.headers['last-modified']);
    assert.equal(Number(head.headers['content-length']), Buffer.byteLength(get.body));
    const conditional = await request(server, '/calendario.html', {
      method: 'HEAD', headers: { 'if-none-match': get.headers.etag }
    });
    assert.equal(conditional.status, 304);
    assert.equal(conditional.body, '');
    assert.equal(conditional.headers.etag, get.headers.etag);
    assert.equal(conditional.headers['content-length'], undefined);
    assertSecurityHeaders(conditional.headers);
  } finally { await stop(server); }
});

test('conditional headers do not revalidate dynamic, redirect, or error responses', async () => {
  const server = await start();
  const headers = {
    'if-none-match': '*',
    'if-modified-since': new Date(Date.now() + 86_400_000).toUTCString()
  };
  try {
    for (const [requestPath, status] of [['/', 302], ['/health', 200], ['/missing', 404]]) {
      const response = await request(server, requestPath, { headers });
      assert.equal(response.status, status, requestPath);
      assert.equal(response.headers['cache-control'], 'no-store', requestPath);
      assert.equal(response.headers.etag, undefined, requestPath);
      assert.equal(response.headers['last-modified'], undefined, requestPath);
      assertSecurityHeaders(response.headers);
    }
  } finally { await stop(server); }
});

test('former HTML routes and page modules are ordinary generic 404s for GET and HEAD', async () => {
  const server = await start();
  const oldPaths = [
    '/calendar.html','/outcome.html','/weather.html',
    '/calendar-page.js','/outcome-page.js','/weather-page.js'
  ];
  try {
    for (const requestPath of oldPaths) {
      const get = await request(server, requestPath);
      const head = await request(server, requestPath, { method: 'HEAD' });
      assert.equal(get.status, 404, requestPath);
      assert.equal(get.body, 'Not Found', requestPath);
      assert.equal(get.headers['cache-control'], 'no-store');
      assertSecurityHeaders(get.headers);
      assert.equal(head.status, 404, requestPath);
      assert.equal(head.body, '');
      assert.equal(head.headers['cache-control'], 'no-store');
      assertSecurityHeaders(head.headers);
    }
  } finally { await stop(server); }
});

test('unknown, dotfile, malformed, and traversal paths fail safely', async () => {
  const server = await start();
  try {
    for (const requestPath of ['/missing','/%2e%2e/package.json','/.git/config','/%252e%252e%252fserver.js']) {
      const response = await request(server, requestPath);
      assert.equal(response.status, 404, requestPath);
      assert.equal(response.body, 'Not Found');
    }
    assert.equal((await request(server, '/%')).status, 400);
  } finally { await stop(server); }
});

test('unsupported methods return 405', async () => {
  const server = await start();
  try {
    const response = await request(server, '/', { method: 'POST' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.allow, 'GET, HEAD');
    assertSecurityHeaders(response.headers);
  } finally { await stop(server); }
});

test('PORT parser defaults and validates', () => {
  assert.equal(parsePort(undefined), 3000);
  assert.equal(parsePort('8080'), 8080);
  assert.throws(() => parsePort('0'), RangeError);
  assert.throws(() => parsePort('abc'), RangeError);
});

test('SIGTERM closes the server gracefully', () => {
  const handlers = new Map();
  const calls = [];
  const processRef = { exitCode: undefined, on(event, handler) { handlers.set(event, handler); } };
  const server = {
    close(callback) { calls.push('close'); callback(); },
    closeAllConnections() { calls.push('closeAllConnections'); },
    closeIdleConnections() { calls.push('closeIdleConnections'); }
  };
  installGracefulShutdown(server, processRef);
  handlers.get('SIGTERM')();
  assert.deepEqual(calls, ['close', 'closeIdleConnections']);
  assert.equal(processRef.exitCode, 0);
});
