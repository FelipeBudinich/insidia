import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { PAGE_DEFINITIONS, PAGE_IDS } from '../public/page-definitions.js';
import { APPLICATION_VERSION, PACKAGE_VERSION } from '../public/version.js';
import { PUBLIC_DIRECTORY, readJson, readPublic } from './helpers.js';

const PAGE_FILES = Object.freeze([
  ['calendario.html', 'page-01', 'calendario-page.js'],
  ['destino.html', 'page-02', 'destino-page.js'],
  ['tempore.html', 'page-03', 'tempore-page.js'],
  ['identitate.html', 'page-04', 'static-page.js'],
  ['inventario.html', 'page-05', 'static-page.js'],
  ['subordinatos.html', 'page-06', 'static-page.js'],
  ['locus.html', 'page-07', 'location-page.js'],
  ['rutas.html', 'page-08', 'location-page.js'],
  ['explorar.html', 'page-09', 'static-page.js']
]);

test('package, browser, and health version source agree on v8.25', async () => {
  const packageJson = await readJson('package.json');
  const packageLock = await readJson('package-lock.json');
  assert.equal(PACKAGE_VERSION, '8.25.0');
  assert.equal(APPLICATION_VERSION, '8.25');
  assert.equal(packageJson.version, PACKAGE_VERSION);
  assert.equal(packageLock.version, PACKAGE_VERSION);
  assert.equal(packageLock.packages[''].version, PACKAGE_VERSION);
});

test('all nine pages expose one empty navigation placeholder and fixed current page ID', async () => {
  for (const [fileName, pageId, scriptName] of PAGE_FILES) {
    const html = await readPublic(fileName);
    assert.match(html, new RegExp(`<html lang="ia" aria-busy="true" data-current-page-id="${pageId}">`), fileName);
    assert.equal(
      html.match(/<nav class="primary-nav" data-navigation aria-label="Navigation principal"><\/nav>/g)?.length,
      1,
      fileName
    );
    assert.doesNotMatch(html, /data-navigation-category-pages|data-navigation-submenu-pages/, fileName);
    assert.match(html, new RegExp(`<script type="module" src="/${scriptName}"><\\/script>`), fileName);
    assert.equal(html.match(/data-version/g)?.length, 1, fileName);
    assert.match(html, /<span class="version footer-version" data-version><\/span>/, fileName);
  }
});

test('fixed page definitions retain all nine routes and order', () => {
  assert.deepEqual(PAGE_IDS, PAGE_FILES.map(([, pageId]) => pageId));
  assert.deepEqual(
    PAGE_IDS.map((pageId) => PAGE_DEFINITIONS[pageId].route),
    ['/calendario.html', '/destino.html', '/tempore.html', '/identitate.html', '/inventario.html', '/subordinatos.html', '/locus.html', '/rutas.html', '/explorar.html']
  );
});

test('trivial historical page modules are deleted and shared entries are present', async () => {
  for (const fileName of [
    'identitate-page.js', 'inventario-page.js', 'subordinatos-page.js',
    'locus-page.js', 'rutas-page.js', 'explorar-page.js', 'templates.js'
  ]) {
    await assert.rejects(access(path.join(PUBLIC_DIRECTORY, fileName)), { code: 'ENOENT' });
  }
  for (const fileName of ['static-page.js', 'location-page.js', 'live-page-bootstrap.js', 'config-loader.js']) {
    await access(path.join(PUBLIC_DIRECTORY, fileName));
  }
});

test('generic static shells retain their configured content sections', async () => {
  const expectedSections = new Map([
    ['identitate.html', ['01', '02', '03', '09', '07']],
    ['inventario.html', ['04', '13']],
    ['subordinatos.html', ['11', '12']],
    ['explorar.html', ['06']]
  ]);
  for (const [fileName, sectionIds] of expectedSections) {
    const html = await readPublic(fileName);
    assert.deepEqual(
      [...html.matchAll(/data-page-section-id="page-section-(\d{2})"/g)].map((match) => match[1]),
      sectionIds,
      fileName
    );
  }
});

test('live page shells retain their visible page-specific structures', async () => {
  const [calendario, destino, tempore] = await Promise.all([
    readPublic('calendario.html'),
    readPublic('destino.html'),
    readPublic('tempore.html')
  ]);
  assert.match(calendario, /id="fictional-year"/);
  assert.match(calendario, /id="fictional-period"/);
  assert.match(calendario, /id="lunar-summary"/);
  assert.doesNotMatch(calendario, /fictional-time|JSON output|clipboard/);
  assert.match(destino, /id="outcome-body"/);
  assert.match(destino, /data-tide-name/);
  assert.equal(destino.match(/data-pull-id=/g)?.length, 3);
  assert.equal(destino.match(/data-body-id=/g)?.length, 6);
  assert.match(tempore, /id="fictional-time"/);
  assert.match(tempore, /id="lunar-time"/);
  assert.match(tempore, /data-season-progress-bar/);
});

test('scripts and styles remain local with no external browser assets', async () => {
  for (const [fileName] of PAGE_FILES) {
    const html = await readPublic(fileName);
    assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)="https?:/i, fileName);
    assert.doesNotMatch(html, /<script(?![^>]*type="module")/i, fileName);
  }
  const css = await readPublic('styles.css');
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
