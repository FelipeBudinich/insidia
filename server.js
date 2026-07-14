import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPLICATION_VERSION } from './public/version.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 3000;
const FORCE_SHUTDOWN_TIMEOUT_MS = 25_000;
const INTERNAL_URL_BASE = 'http://internal.invalid';

const CONTENT_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
});

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'none'",
  "worker-src 'none'",
  "manifest-src 'self'"
].join('; ');

const BASE_SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), clipboard-read=(), clipboard-write=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-DNS-Prefetch-Control': 'off',
  'X-Frame-Options': 'DENY',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-XSS-Protection': '0'
});

function isProduction(environment) {
  return environment === 'production';
}

function getSecurityHeaders(environment) {
  if (!isProduction(environment)) {
    return { ...BASE_SECURITY_HEADERS };
  }
  return {
    ...BASE_SECURITY_HEADERS,
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
}

function getCacheControl(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.html' || extension === '.js' || extension === '.css' || extension === '.json') {
    return 'no-cache';
  }
  return 'public, max-age=300, must-revalidate';
}

function getContentType(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export function createStaticEtag(fileStats) {
  const size = Math.trunc(fileStats.size).toString(16);
  const modifiedMilliseconds = fileStats.mtimeMs.toString(16);
  return `W/"${size}-${modifiedMilliseconds}"`;
}

function headerValue(value) {
  return Array.isArray(value) ? value.join(',') : value;
}

function weakEtagValue(value) {
  return value.trim().replace(/^W\//i, '');
}

function matchesIfNoneMatch(value, etag) {
  const header = headerValue(value);
  if (typeof header !== 'string') return false;
  const current = weakEtagValue(etag);
  return header.split(',').some((candidate) => {
    const trimmed = candidate.trim();
    return trimmed === '*' || weakEtagValue(trimmed) === current;
  });
}

function matchesIfModifiedSince(value, fileStats) {
  const header = headerValue(value);
  if (typeof header !== 'string') return false;
  const suppliedTime = Date.parse(header);
  if (Number.isNaN(suppliedTime)) return false;
  const modifiedTime = Math.floor(fileStats.mtimeMs / 1000) * 1000;
  return modifiedTime <= suppliedTime;
}

function createHeaders(environment, headers = {}) {
  return { ...getSecurityHeaders(environment), ...headers };
}

function sendResponse(response, method, environment, statusCode, headers, body = '') {
  const responseBody = Buffer.isBuffer(body) ? body : Buffer.from(body);
  response.writeHead(statusCode, createHeaders(environment, {
    ...headers,
    'Content-Length': responseBody.byteLength
  }));
  response.end(method === 'HEAD' ? undefined : responseBody);
}

function sendNotModified(response, environment, headers) {
  response.writeHead(304, createHeaders(environment, headers));
  response.end();
}

function sendStaticHead(response, environment, headers, contentLength) {
  response.writeHead(200, createHeaders(environment, {
    ...headers,
    'Content-Length': contentLength
  }));
  response.end();
}

function sendNotFound(response, method, environment) {
  sendResponse(response, method, environment, 404, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8'
  }, 'Non trovate');
}

function sendBadRequest(response, method, environment) {
  sendResponse(response, method, environment, 400, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8'
  }, 'Requesta invalide');
}

function sendInternalServerError(response, method, environment) {
  sendResponse(response, method, environment, 500, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8'
  }, 'Error interne del servitor');
}

function isMissingFileError(error) {
  return error?.code === 'ENOENT' || error?.code === 'ENOTDIR';
}

function decodeRequestPathname(pathname) {
  let decodedPathname = pathname;
  for (let index = 0; index < 2; index += 1) {
    try {
      const nextPathname = decodeURIComponent(decodedPathname);
      if (nextPathname === decodedPathname) {
        break;
      }
      decodedPathname = nextPathname;
    } catch {
      throw new TypeError('Request pathname has invalid percent encoding');
    }
  }
  return decodedPathname;
}

function resolvePublicFile(publicDirectory, pathname) {
  const decodedPathname = decodeRequestPathname(pathname);
  if (decodedPathname.includes('\0') || decodedPathname.includes('\\')) {
    return null;
  }

  const pathSegments = decodedPathname.split('/').filter(Boolean);
  if (pathSegments.some((segment) => segment.startsWith('.'))) {
    return null;
  }

  if (decodedPathname === '/') {
    return null;
  }
  const relativePath = pathSegments.join(path.sep);
  const requestedFile = path.resolve(publicDirectory, relativePath);
  const relativeToPublicDirectory = path.relative(publicDirectory, requestedFile);
  if (
    relativeToPublicDirectory.startsWith('..')
    || path.isAbsolute(relativeToPublicDirectory)
  ) {
    return null;
  }
  return requestedFile;
}

function isSecureForwardedRequest(request) {
  const forwardedProto = request.headers['x-forwarded-proto'];
  const values = (Array.isArray(forwardedProto) ? forwardedProto.join(',') : forwardedProto ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length > 0 && values.every((value) => value.toLowerCase() === 'https');
}

function isCanonicalHost(request, canonicalOrigin) {
  const host = request.headers.host;
  if (typeof host !== 'string') {
    return false;
  }
  return host.toLowerCase() === new URL(canonicalOrigin).host.toLowerCase();
}

function createCanonicalLocation(canonicalOrigin, requestUrl) {
  const canonicalUrl = new URL(canonicalOrigin);
  canonicalUrl.pathname = requestUrl.pathname;
  canonicalUrl.search = requestUrl.search;
  return canonicalUrl.toString();
}

function createStaticVersion(fileStats) {
  return `${fileStats.size}:${fileStats.mtimeMs}`;
}

function createStaticCacheEntry(filePath, fileStats) {
  return {
    version: createStaticVersion(fileStats),
    fileStats,
    headers: {
      'Cache-Control': getCacheControl(filePath),
      'Content-Type': getContentType(filePath),
      ETag: createStaticEtag(fileStats),
      'Last-Modified': fileStats.mtime.toUTCString()
    },
    body: undefined,
    bodyPromise: undefined
  };
}

function writeClientError(socket, environment) {
  if (!socket.writable) {
    socket.destroy();
    return;
  }

  const body = 'Requesta invalide';
  const headers = createHeaders(environment, {
    Connection: 'close',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'text/plain; charset=utf-8'
  });
  const headerLines = Object.entries(headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join('\r\n');
  socket.end(`HTTP/1.1 400 Bad Request\r\n${headerLines}\r\n\r\n${body}`);
}

export function parsePort(value) {
  if (value === undefined) {
    return DEFAULT_PORT;
  }
  if (typeof value !== 'string') {
    throw new TypeError('PORT must be a string when supplied');
  }
  if (!/^\d+$/.test(value)) {
    throw new RangeError('PORT must be an integer between 1 and 65535');
  }

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new RangeError('PORT must be an integer between 1 and 65535');
  }
  return port;
}

export function parseCanonicalOrigin(value) {
  if (value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new TypeError('CANONICAL_ORIGIN must be a string when supplied');
  }

  let parsedOrigin;
  try {
    parsedOrigin = new URL(value);
  } catch {
    throw new TypeError('CANONICAL_ORIGIN must be a valid HTTPS origin');
  }

  if (
    parsedOrigin.protocol !== 'https:'
    || parsedOrigin.username
    || parsedOrigin.password
    || parsedOrigin.pathname !== '/'
    || parsedOrigin.search
    || parsedOrigin.hash
  ) {
    throw new RangeError('CANONICAL_ORIGIN must be an HTTPS origin without credentials, path, query, or fragment');
  }
  return parsedOrigin.origin;
}

export function createStaticServer(options = {}) {
  const environment = options.environment ?? process.env.NODE_ENV;
  const publicDirectory = path.resolve(options.publicDirectory ?? path.join(__dirname, 'public'));
  const statFile = options.fileSystem?.stat
    ? options.fileSystem.stat.bind(options.fileSystem)
    : stat;
  const readStaticFile = options.fileSystem?.readFile
    ? options.fileSystem.readFile.bind(options.fileSystem)
    : readFile;
  const staticCache = new Map();
  const canonicalOrigin = parseCanonicalOrigin(
    options.canonicalOrigin === undefined ? process.env.CANONICAL_ORIGIN : options.canonicalOrigin
  );

  const server = http.createServer({
    headersTimeout: 30_000,
    keepAliveTimeout: 95_000,
    maxHeaderSize: 16 * 1024,
    requestTimeout: 30_000,
    requireHostHeader: true
  }, async (request, response) => {
    const method = request.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      sendResponse(response, method, environment, 405, {
        Allow: 'GET, HEAD',
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8'
      }, 'Methodo non permittite');
      return;
    }

    let requestUrl;
    try {
      requestUrl = new URL(request.url ?? '/', INTERNAL_URL_BASE);
    } catch {
      sendBadRequest(response, method, environment);
      return;
    }

    if (
      isProduction(environment)
      && canonicalOrigin
      && (!isCanonicalHost(request, canonicalOrigin) || !isSecureForwardedRequest(request))
    ) {
      sendResponse(response, method, environment, 308, {
        'Cache-Control': 'no-store',
        Location: createCanonicalLocation(canonicalOrigin, requestUrl)
      });
      return;
    }

    if (requestUrl.pathname === '/health') {
      sendResponse(response, method, environment, 200, {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8'
      }, JSON.stringify({ ok: true, version: `v${APPLICATION_VERSION}` }));
      return;
    }

    let requestedFile;
    try {
      const staticPathname = requestUrl.pathname === '/' ? '/locus.html' : requestUrl.pathname;
      requestedFile = resolvePublicFile(publicDirectory, staticPathname);
    } catch {
      sendBadRequest(response, method, environment);
      return;
    }

    if (!requestedFile) {
      sendNotFound(response, method, environment);
      return;
    }

    try {
      const fileStats = await statFile(requestedFile);
      if (!fileStats.isFile()) {
        staticCache.delete(requestedFile);
        sendNotFound(response, method, environment);
        return;
      }

      const version = createStaticVersion(fileStats);
      let cacheEntry = staticCache.get(requestedFile);
      if (!cacheEntry || cacheEntry.version !== version) {
        cacheEntry = createStaticCacheEntry(requestedFile, fileStats);
        staticCache.set(requestedFile, cacheEntry);
      }
      const { headers: staticHeaders } = cacheEntry;
      const etag = staticHeaders.ETag;
      const ifNoneMatch = request.headers['if-none-match'];
      if (ifNoneMatch !== undefined) {
        if (matchesIfNoneMatch(ifNoneMatch, etag)) {
          sendNotModified(response, environment, staticHeaders);
          return;
        }
      } else if (matchesIfModifiedSince(request.headers['if-modified-since'], fileStats)) {
        sendNotModified(response, environment, staticHeaders);
        return;
      }

      if (method === 'HEAD') {
        sendStaticHead(response, environment, staticHeaders, cacheEntry.fileStats.size);
        return;
      }

      if (cacheEntry.body === undefined) {
        if (!cacheEntry.bodyPromise) {
          cacheEntry.bodyPromise = readStaticFile(requestedFile);
        }
        try {
          cacheEntry.body = await cacheEntry.bodyPromise;
        } finally {
          cacheEntry.bodyPromise = undefined;
        }
      }
      sendResponse(response, method, environment, 200, staticHeaders, cacheEntry.body);
    } catch (error) {
      if (isMissingFileError(error)) {
        if (requestedFile) staticCache.delete(requestedFile);
        sendNotFound(response, method, environment);
        return;
      }
      console.error('Unexpected server error while serving a static file.');
      sendInternalServerError(response, method, environment);
    }
  });

  server.maxHeadersCount = 100;
  server.on('clientError', (_error, socket) => {
    writeClientError(socket, environment);
  });
  return server;
}

export function installGracefulShutdown(server, processRef = process) {
  let isShuttingDown = false;

  function shutdown(signal) {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    console.log(`Received ${signal}; shutting down.`);

    const forceTimer = setTimeout(() => {
      server.closeAllConnections();
      processRef.exit(1);
    }, FORCE_SHUTDOWN_TIMEOUT_MS);
    forceTimer.unref();

    server.close((error) => {
      clearTimeout(forceTimer);
      if (error) {
        console.error('Server shutdown encountered an error.');
        processRef.exitCode = 1;
        return;
      }
      processRef.exitCode = 0;
    });
    server.closeIdleConnections();
  }

  processRef.on('SIGINT', () => shutdown('SIGINT'));
  processRef.on('SIGTERM', () => shutdown('SIGTERM'));
  return shutdown;
}

export function startServer(options = {}) {
  const port = options.port ?? parsePort(process.env.PORT);
  const server = createStaticServer(options);
  installGracefulShutdown(server);
  server.once('error', () => {
    console.error('Server startup failed.');
    process.exitCode = 1;
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`Insidia is available at http://0.0.0.0:${port}`);
  });
  return server;
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  try {
    startServer();
  } catch (error) {
    console.error(`Server startup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
