import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { PAGE_DEFINITIONS, PAGE_IDS } from '../public/page-definitions.js';
import { APPLICATION_VERSION, PACKAGE_VERSION } from '../public/version.js';
import { PUBLIC_DIRECTORY, readJson, readPublic } from './helpers.js';

const PAGE_FILES = Object.freeze([
  ['calendario.html', 'page-01', 'calendario-page.js', 'Calendario', 'navigation-group-01'],
  ['destino.html', 'page-02', 'destino-page.js', 'Destino', 'navigation-group-01'],
  ['tempore.html', 'page-03', 'tempore-page.js', 'Tempore', 'navigation-group-01'],
  ['identitate.html', 'page-04', 'static-page.js', 'Identitate', 'navigation-group-02'],
  ['inventario.html', 'page-05', 'static-page.js', 'Inventario', 'navigation-group-02'],
  ['subordinatos.html', 'page-06', 'static-page.js', 'Subordinatos', 'navigation-group-02'],
  ['locus.html', 'page-07', 'location-page.js', 'Locus', 'navigation-group-03'],
  ['rutas.html', 'page-08', 'location-page.js', 'Rutas', 'navigation-group-03'],
  ['explorar.html', 'page-09', 'static-page.js', 'Explorar', 'navigation-group-03']
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

test('all nine pages expose a complete meaningful shell and their exact entry module', async () => {
  for (const [fileName, pageId, scriptName, pageName, activeGroupId] of PAGE_FILES) {
    const html = await readPublic(fileName);
    assert.match(html, new RegExp(`<html lang="ia" aria-busy="true" data-current-page-id="${pageId}">`), fileName);
    assert.match(html, new RegExp(`<title>${pageName} · Insidia<\\/title>`), fileName);
    assert.match(html, /<meta name="description" content="[^"]+ pro Insidia\.">/, fileName);
    assert.match(html, new RegExp(`<h1 id="page-heading" class="visually-hidden" data-page-name>${pageName}<\\/h1>`), fileName);
    const navigation = html.match(/<nav class="primary-nav" data-navigation aria-label="Navigation principal">[\s\S]*?<\/nav>/)?.[0];
    assert.ok(navigation, fileName);
    assert.equal(navigation.match(/data-navigation-group-id=/g)?.length, 3, fileName);
    assert.equal(navigation.match(/data-page-id=/g)?.length, 3, fileName);
    assert.equal(navigation.match(/data-active-section="true"/g)?.length, 1, fileName);
    assert.equal(navigation.match(/aria-current="page"/g)?.length, 1, fileName);
    assert.match(navigation, /Personage[\s\S]*Almanac[\s\S]*Location/, fileName);
    assert.match(navigation, new RegExp(`data-navigation-group-id="${activeGroupId}"[^>]*data-active-section="true"`), fileName);
    assert.match(navigation, new RegExp(`data-page-id="${pageId}"[^>]*aria-current="page"`), fileName);
    assert.doesNotMatch(html, /data-navigation-category-pages|data-navigation-submenu-pages/, fileName);
    assert.match(html, new RegExp(`<script type="module" src="/${scriptName}"><\\/script>`), fileName);
    assert.ok(html.indexOf(`<script type="module" src="/${scriptName}"></script>`) < html.indexOf('</head>'), fileName);
    for (const resource of [
      '/config/nomenclature.json', '/app-bootstrap.js', '/nomenclature-loader.js',
      '/config-loader.js', '/neutral-ids.js'
    ]) assert.match(html, new RegExp(`(?:href|src)="${resource.replaceAll('.', '\\.') }"`), `${fileName}: ${resource}`);
    if (pageId === 'page-07' || pageId === 'page-08') {
      assert.match(html, /href="\/regions\/world\.json"/, fileName);
      assert.match(html, /href="\/world-loader\.js"/, fileName);
    } else {
      assert.doesNotMatch(html, /href="\/regions\/world\.json"/, fileName);
    }
    assert.equal(html.match(/data-version/g)?.length, 1, fileName);
    assert.match(html, /<span data-application-name>Insidia<\/span>/, fileName);
    assert.match(html, /<span data-epoch>Epoca: 1970-01-01 00:00:00 UTC<\/span>/, fileName);
    assert.match(html, /<span class="version footer-version" data-version aria-label="Version del application 8\.25">v8\.25<\/span>/, fileName);
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
  for (const fileName of [
    'static-page.js', 'location-page.js', 'live-page-bootstrap.js', 'config-loader.js',
    'neutral-ids.js', 'performance.js'
  ]) {
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
    for (const match of html.matchAll(/<h2[^>]+data-page-section-id="[^"]+">([^<]+)<\/h2>/g)) {
      assert.notEqual(match[1].trim(), '', fileName);
    }
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
