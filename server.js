import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(__dirname, 'public');
const port = Number.parseInt(process.env.PORT ?? '3000', 10) || 3000;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function send(response, statusCode, headers, body) {
  response.writeHead(statusCode, headers);
  response.end(body);
}

const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET') {
    send(response, 405, { Allow: 'GET', 'Content-Type': 'text/plain; charset=utf-8' }, 'Method Not Allowed');
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  if (requestUrl.pathname === '/health') {
    send(response, 200, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ ok: true, version: 'v1' }));
    return;
  }

  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    send(response, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Bad Request');
    return;
  }

  const relativePath = decodedPathname === '/' ? 'index.html' : decodedPathname.replace(/^\/+/, '');
  const requestedFile = path.resolve(publicDirectory, relativePath);
  if (requestedFile !== publicDirectory && !requestedFile.startsWith(`${publicDirectory}${path.sep}`)) {
    send(response, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found');
    return;
  }

  try {
    const fileStats = await stat(requestedFile);
    if (!fileStats.isFile()) {
      throw new Error('Requested path is not a file');
    }
    const content = await readFile(requestedFile);
    const contentType = contentTypes[path.extname(requestedFile).toLowerCase()] ?? 'application/octet-stream';
    send(response, 200, { 'Content-Type': contentType }, content);
  } catch {
    send(response, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found');
  }
});

server.listen(port, () => {
  console.log(`Fictional Calendar is available at http://localhost:${port}`);
});
