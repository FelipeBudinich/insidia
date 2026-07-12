import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';
import { createStaticServer, installGracefulShutdown, parsePort } from '../server.js';

async function start() { const server = createStaticServer({ environment: 'development' }); server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server; }
async function stop(server) { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
function request(server, path, method = 'GET') { return new Promise((resolve, reject) => { const req = http.request({ host: '127.0.0.1', port: server.address().port, path, method }, (res) => { const chunks=[]; res.on('data',(chunk)=>chunks.push(chunk)); res.on('end',()=>resolve({ status:res.statusCode, headers:res.headers, body:Buffer.concat(chunks).toString() })); }); req.on('error',reject); req.end(); }); }

test('root redirects to calendar while preserving context query', async () => { const server=await start(); try { const response=await request(server,'/?universe=demonstration&locale=es'); assert.equal(response.status,302); assert.equal(response.headers.location,'/calendar.html?universe=demonstration&locale=es'); } finally { await stop(server); } });
test('health reports v7.1 JSON', async () => { const server=await start(); try { const response=await request(server,'/health'); assert.equal(response.status,200); assert.equal(response.headers['content-type'],'application/json; charset=utf-8'); assert.deepEqual(JSON.parse(response.body),{ok:true,version:'v7.1'}); } finally { await stop(server); } });
test('HTML, modules, and JSON have correct MIME and no-cache', async () => { const server=await start(); try { for (const [file,type] of [['/calendar.html','text/html; charset=utf-8'],['/core/mechanics.js','text/javascript; charset=utf-8'],['/universes/index.json','application/json; charset=utf-8']]) { const response=await request(server,file); assert.equal(response.status,200); assert.equal(response.headers['content-type'],type); assert.equal(response.headers['cache-control'],'no-cache'); assert.ok(response.headers['content-security-policy'].includes("default-src 'self'")); } } finally { await stop(server); } });
test('HEAD returns headers without a body', async () => { const server=await start(); try { const response=await request(server,'/calendar.html','HEAD'); assert.equal(response.status,200); assert.equal(response.body,''); } finally { await stop(server); } });
test('unknown and traversal paths do not expose files', async () => { const server=await start(); try { for (const path of ['/missing','/%2e%2e/package.json','/.git/config','/%252e%252e%252fserver.js']) { const response=await request(server,path); assert.equal(response.status,404,path); assert.equal(response.body,'Not Found'); } } finally { await stop(server); } });
test('unsupported methods return 405', async () => { const server=await start(); try { const response=await request(server,'/','POST'); assert.equal(response.status,405); assert.equal(response.headers.allow,'GET, HEAD'); } finally { await stop(server); } });
test('PORT parser defaults and validates', () => { assert.equal(parsePort(undefined),3000); assert.equal(parsePort('8080'),8080); assert.throws(()=>parsePort('0'),RangeError); assert.throws(()=>parsePort('abc'),RangeError); });

test('SIGTERM closes the server gracefully', () => {
  const handlers = new Map();
  const calls = [];
  const processRef = {
    exitCode: undefined,
    on(event, handler) { handlers.set(event, handler); }
  };
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
