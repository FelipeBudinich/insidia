import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { calculateCalendarState } from '../public/core/mechanics.js';
import {
  FICTIONAL_SECONDS_PER_DAY,
  REAL_MS_PER_FICTIONAL_SECOND,
  SEASON_LENGTH_DAYS
} from '../public/core/rules.js';
import { validateLocale } from '../public/locale-loader.js';
import { validateNomenclature } from '../public/nomenclature-loader.js';
import { createPresentationContext } from '../public/nomenclature.js';
import { createDisplayData } from '../public/presentation.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readPublic = (file) => readFile(path.join(root, 'public', file), 'utf8');
const PAGE_SHELLS = Object.freeze([
  ['calendario.html', 'page-01', 'calendario-page.js', '/calendario.html'],
  ['destino.html', 'page-02', 'destino-page.js', '/destino.html'],
  ['tempore.html', 'page-03', 'tempore-page.js', '/tempore.html'],
  ['identitate.html', 'page-04', 'identitate-page.js', '/identitate.html'],
  ['inventario.html', 'page-05', 'inventario-page.js', '/inventario.html'],
  ['subordinatos.html', 'page-06', 'subordinatos-page.js', '/subordinatos.html'],
  ['locus.html', 'page-07', 'locus-page.js', '/locus.html'],
  ['rutas.html', 'page-08', 'rutas-page.js', '/rutas.html'],
  ['explorar.html', 'page-09', 'explorar-page.js', '/explorar.html']
]);
const PAGE_ROUTES = Object.freeze(PAGE_SHELLS.map(([, , , route]) => route));

async function productionContext() {
  const [nomenclatureSource, localeSource] = await Promise.all([
    readPublic('config/nomenclature.json'),
    readPublic('locales/en.json')
  ]);
  const nomenclature = validateNomenclature(JSON.parse(nomenclatureSource));
  const locale = validateLocale(JSON.parse(localeSource));
  return createPresentationContext({
    nomenclatureResult: {
      schemaVersion: nomenclature.schemaVersion,
      nomenclature
    },
    localeResult: {
      requestedLocaleId: 'en',
      resolvedLocaleId: 'en',
      schemaVersion: locale.schemaVersion,
      locale
    }
  });
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listSourceFiles(fullPath) : [fullPath];
  }));
  return nested.flat();
}

test('package and visible application versions are v8.20', async () => {
  const [packageJson, packageLock, bootstrap] = await Promise.all([
    readFile(path.join(root, 'package.json'), 'utf8'),
    readFile(path.join(root, 'package-lock.json'), 'utf8'),
    readPublic('app-bootstrap.js')
  ]);
  assert.equal(JSON.parse(packageJson).version, '8.20.0');
  assert.equal(JSON.parse(packageLock).version, '8.20.0');
  assert.match(bootstrap, /const APPLICATION_VERSION = '8\.20'/);
});

test('Calendario preserves the v8.1 time, title, JSON, and copy removals', async () => {
  const [html, script] = await Promise.all([readPublic('calendario.html'), readPublic('calendario-page.js')]);
  for (const removed of [
    'id="fictional-time"', 'class="primary-clock"', '<header class="heading"',
    'json-details', 'json-output', 'copy-json', 'copy-status', 'JSON output', 'Copy JSON'
  ]) assert.ok(!html.includes(removed), removed);
  for (const removed of [
    'createCalendarJson', 'captureLiveState', '#fictional-time', 'navigator.clipboard',
    'execCommand', 'textarea', 'currentSnapshot', '#json-output', '#copy-json', '#copy-status'
  ]) assert.ok(!script.includes(removed), removed);
  assert.match(html, /<h1 id="page-heading" class="visually-hidden" data-page-name><\/h1>/);
  assert.match(html, /<section class="calendar-card" aria-labelledby="page-heading">\s*<div class="date">/);
  assert.match(script, /bootstrapPage\('page-01', createCalendarioPageRenderer\)/);
});

test('Calendario preserves date and lunar structures with the footer directly after the lunar card', async () => {
  const html = await readPublic('calendario.html');
  for (const id of ['fictional-year','fictional-period','fictional-date-accessible','lunar-summary']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(html, /fictional-metadata|class="metadata"/);
  const card = html.slice(html.indexOf('<section class="calendar-card"'), html.indexOf('</section>', html.indexOf('<section class="calendar-card"')));
  const paragraphs = [...card.matchAll(/<p\b[^>]*>/g)].map(([tag]) => tag);
  assert.equal(paragraphs.length, 3);
  assert.equal(paragraphs.filter((tag) => !tag.includes('visually-hidden')).length, 2);
  assert.match(card, /id="fictional-year" class="year"/);
  assert.match(card, /id="fictional-period" class="period"/);
  assert.match(card, /id="fictional-date-accessible" class="visually-hidden"/);
  const calendarIndex = html.indexOf('<section class="calendar-card"');
  const lunarIndex = html.indexOf('<section class="lunar-section"');
  const footerIndex = html.indexOf('<footer>');
  assert.ok(calendarIndex < lunarIndex && lunarIndex < footerIndex);
  assert.equal(html.indexOf('<section class="season-section"'), -1);
});

test('Calendario contains no standalone season-card markup', async () => {
  const html = await readPublic('calendario.html');
  for (const removed of [
    'season-heading',
    'data-message-key="section.season"',
    'data-season-name',
    'data-season-metadata',
    'data-season-cycle-metadata',
    'data-season-next',
    'data-season-progress',
    'data-season-progress-bar'
  ]) {
    assert.equal(html.includes(removed), false, removed);
  }
  assert.doesNotMatch(html, /<section class="season-section"|<progress/);
});

test('Calendario lunar card uses one visible configured summary line', async () => {
  const html = await readPublic('calendario.html');
  const start = html.indexOf('<section class="lunar-section"');
  const section = html.slice(start, html.indexOf('</section>', start) + '</section>'.length);
  assert.match(section, /<section class="lunar-section" aria-labelledby="lunar-summary">/);
  assert.match(section, /<div class="date">\s*<p id="lunar-summary" class="year"><\/p>\s*<\/div>/);
  const paragraphs = [...section.matchAll(/<p\b[^>]*>/g)].map(([tag]) => tag);
  assert.equal(paragraphs.length, 1);
  assert.equal(paragraphs.filter((tag) => !tag.includes('visually-hidden')).length, 1);
  assert.match(section, /id="lunar-summary" class="year"/);
  assert.doesNotMatch(section, /lunar-cycle-title|lunar-phase-subtitle|lunar-name|section\.lunar|label\.phase|lunar-metadata|data-message-key|•/);
  assert.doesNotMatch(html, /Lunar Cycle|Phase|Lunar Day|Ciclo lunar|Fase|Día lunar/);
});

test('Destino preserves its title removal and begins with the selected body', async () => {
  const [html, script] = await Promise.all([readPublic('destino.html'), readPublic('destino-page.js')]);
  assert.match(html, /<h1 id="page-heading" class="visually-hidden" data-page-name><\/h1>/);
  assert.match(html, /<section class="outcome-section" aria-labelledby="page-heading"><p id="outcome-body"/);
  assert.doesNotMatch(html, /id="outcome-heading"|class="heading outcome-heading"/);
  const section = html.slice(html.indexOf('<section class="outcome-section"'), html.indexOf('</section>', html.indexOf('<section class="outcome-section"')));
  for (const id of ['outcome-body','outcome-type','outcome-attempts','outcome-source','outcome-progress','outcome-rule','outcome-tiebreak']) {
    assert.match(section, new RegExp(`id="${id}"`));
  }
  assert.match(script, /bootstrapPage\('page-02', createDestinoPageRenderer\)/);
  assert.match(script, /createOutcomeRenderer\(root, context, 'page-02'\)/);
});

test('Destino uses the current tide progress contract and composes its dedicated renderer', async () => {
  const [html, script, renderers] = await Promise.all([
    readPublic('destino.html'), readPublic('destino-page.js'), readPublic('renderers.js')
  ]);
  const start = html.indexOf('<section class="progress-section"');
  const progressSection = html.slice(start, html.indexOf('</section>', start) + '</section>'.length);
  assert.ok(start >= 0);
  for (const expected of [
    'id="tide-progress"', 'id="tide-progress-value"', 'for="tide-progress"',
    'data-message-key="label.currentTideProgress"'
  ]) assert.ok(progressSection.includes(expected), expected);
  for (const removed of ['id="hour-progress"', 'id="hour-progress-value"', 'data-message-key="label.currentHour"']) {
    assert.ok(!progressSection.includes(removed), removed);
  }

  assert.match(script, /import \{[^}]*createTideProgressRenderer[^}]*\} from '\.\/renderers\.js';/);
  assert.match(script, /const renderProgress = createTideProgressRenderer\(root\);/);
  assert.match(script, /renderProgress\(state\)/);
  assert.doesNotMatch(script, /createHourProgressRenderer/);

  const tideRendererStart = renderers.indexOf('export function createTideProgressRenderer');
  const tideRendererEnd = renderers.indexOf('export function createSeasonRenderer', tideRendererStart);
  const tideRenderer = renderers.slice(tideRendererStart, tideRendererEnd);
  assert.ok(tideRendererStart >= 0);
  assert.match(tideRenderer, /state\.progress\.tide\.percentage/);
  assert.match(tideRenderer, /state\.progress\.tide\.fraction/);
  assert.doesNotMatch(tideRenderer, /state\.progress\.hour/);
  assert.doesNotMatch(renderers, /createHourProgressRenderer/);
});

test('Tempore preserves its header removal and begins visibly with Time', async () => {
  const [html, script] = await Promise.all([readPublic('tempore.html'), readPublic('tempore-page.js')]);
  assert.doesNotMatch(html, /class="page-header"|class="page-kicker"/);
  assert.match(html, /<h1 id="page-heading" class="visually-hidden" data-page-name><\/h1>/);
  const main = html.slice(html.indexOf('<main class="container">'), html.indexOf('</main>'));
  assert.equal(main.indexOf('<section'), main.indexOf('<section class="time-section"'));
  for (const preserved of [
    'id="fictional-time"', 'id="lunar-time"', 'data-season-name', 'data-season-progress',
    'id="lunar-day-progress"', 'id="day-progress"', 'id="hour-progress"',
    'id="hour-progress-value"', 'data-message-key="label.currentHour"'
  ]) assert.ok(html.includes(preserved), preserved);
  assert.match(script, /bootstrapPage\('page-03', createTemporePageRenderer\)/);
  assert.match(script, /import \{[^}]*createSeasonRenderer[^}]*\} from '\.\/renderers\.js';/);
  assert.match(script, /const renderSeason = createSeasonRenderer\(root, context\);/);
  assert.match(script, /renderSeason\(state\)/);

  const renderers = await readPublic('renderers.js');
  const weatherStart = renderers.indexOf('export function createWeatherProgressRenderer');
  const weatherEnd = renderers.indexOf('export function formatAttemptsUntilRare', weatherStart);
  const weatherRenderer = renderers.slice(weatherStart, weatherEnd);
  assert.match(weatherRenderer, /\['hour', '#hour-progress', '#hour-progress-value'\]/);
  assert.match(weatherRenderer, /state\.progress\[row\.key\]\.percentage/);
  assert.match(weatherRenderer, /state\.progress\[row\.key\]\.fraction/);
});

test('each configured page has one localized v8.20 footer version', async () => {
  for (const [file] of PAGE_SHELLS) {
    const html = await readPublic(file);
    assert.equal((html.match(/data-version/g) ?? []).length, 1, file);
    const footer = html.slice(html.indexOf('<footer>'), html.indexOf('</footer>') + '</footer>'.length);
    assert.match(footer, /data-application-name/);
    assert.match(footer, /data-epoch/);
    assert.match(footer, /class="version footer-version" data-version>v8\.20/);
    assert.equal((footer.match(/aria-hidden="true"/g) ?? []).length, 2);
    assert.equal(html.indexOf('data-version'), html.indexOf('data-version', html.indexOf('<footer>')));
  }
});

test('nine pages use neutral IDs, fixed routes, one active link, and matching modules', async () => {
  for (const [file, activeId, module] of PAGE_SHELLS) {
    const html = await readPublic(file);
    assert.equal((html.match(/data-page-id=/g) ?? []).length, 9);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(html, new RegExp(`data-page-id="${activeId}"[^>]*aria-current="page"`));
    for (const route of PAGE_ROUTES) assert.ok(html.includes(`href="${route}"`), `${file}: ${route}`);
    assert.match(html, new RegExp(`src="/${module}"`));
    assert.doesNotMatch(html, /data-page-link/);
  }
});

test('all pages use the exact neutral three-category navigation hierarchy', async () => {
  for (const [file] of PAGE_SHELLS) {
    const html = await readPublic(file);
    assert.equal((html.match(/<header class="site-header">/g) ?? []).length, 1, file);
    assert.equal((html.match(/<nav class="primary-nav"/g) ?? []).length, 1, file);
    assert.equal((html.match(/<div class="primary-nav-categories">/g) ?? []).length, 1, file);
    assert.equal((html.match(/class="navigation-category-link"/g) ?? []).length, 3, file);
    assert.equal((html.match(/<div class="secondary-nav"/g) ?? []).length, 3, file);
    assert.equal((html.match(/<div class="tertiary-nav"/g) ?? []).length, 0, file);
    assert.equal((html.match(/data-page-id=/g) ?? []).length, 9, file);
    assert.equal((html.match(/data-navigation-group-id=/g) ?? []).length, 3, file);
    assert.equal((html.match(/data-navigation-target-page-id=/g) ?? []).length, 3, file);
    assert.equal((html.match(/data-navigation-target-page-id="page-01"/g) ?? []).length, 1, file);
    assert.equal((html.match(/data-navigation-target-page-id="page-04"/g) ?? []).length, 1, file);
    assert.equal((html.match(/data-navigation-target-page-id="page-07"/g) ?? []).length, 1, file);
    assert.equal((html.match(/<a\b[^>]*>\s*<\/a>/g) ?? []).length, 12, file);

    const categoryStart = html.indexOf('<div class="primary-nav-categories">');
    const categories = html.slice(categoryStart, html.indexOf('</div>', categoryStart));
    const categoryAnchors = [...categories.matchAll(/<a\b([^>]*)><\/a>/g)].map((match) => match[1]);
    assert.equal(categoryAnchors.length, 3, file);
    assert.match(categoryAnchors[0], /data-navigation-group-id="navigation-group-02"/);
    assert.match(categoryAnchors[0], /data-navigation-target-page-id="page-04"/);
    assert.doesNotMatch(categoryAnchors[0], /data-page-id=/);
    assert.match(categoryAnchors[1], /data-navigation-group-id="navigation-group-01"/);
    assert.match(categoryAnchors[1], /data-navigation-target-page-id="page-01"/);
    assert.match(categoryAnchors[2], /data-navigation-group-id="navigation-group-03"/);
    assert.match(categoryAnchors[2], /data-navigation-target-page-id="page-07"/);
    assert.doesNotMatch(categoryAnchors[2], /data-page-id=/);
    assert.match(categoryAnchors[2], /data-navigation-category-pages="page-07 page-08 page-09"/);

    const submenus = [...html.matchAll(/<div class="secondary-nav"([^>]*)>([\s\S]*?)<\/div>/g)];
    const personage = submenus.find((match) => match[1].includes('navigation-category-personage'));
    const almanac = submenus.find((match) => match[1].includes('navigation-category-almanac'));
    const location = submenus.find((match) => match[1].includes('navigation-category-location'));
    assert.ok(personage, file);
    assert.ok(almanac, file);
    assert.ok(location, file);
    assert.match(personage[1], /data-navigation-submenu-pages="page-04 page-05 page-06"[^>]*hidden/);
    assert.deepEqual([...personage[2].matchAll(/data-page-id="([^"]+)"/g)].map((match) => match[1]), ['page-04', 'page-05', 'page-06']);
    assert.match(almanac[1], /data-navigation-submenu-pages="page-01 page-02 page-03"[^>]*hidden/);
    assert.deepEqual([...almanac[2].matchAll(/data-page-id="([^"]+)"/g)].map((match) => match[1]), ['page-01', 'page-02', 'page-03']);
    assert.match(location[1], /data-navigation-submenu-pages="page-07 page-08 page-09"[^>]*hidden/);
    assert.deepEqual([...location[2].matchAll(/data-page-id="([^"]+)"/g)].map((match) => match[1]), ['page-07', 'page-08', 'page-09']);
    assert.doesNotMatch(location[2], /data-page-id="page-(?:10|11)"/);
    assert.match(location[2], /data-page-id="page-09" href="\/explorar\.html"/);
    assert.doesNotMatch(html, /tertiary-nav|navigation-category-explorar|navigation-subcategory-link|page-10|page-11|\/observationes\.html|\/decisiones\.html/);
    assert.doesNotMatch(html, /href="\/(?:almanac|personage|location|mappa|pensamentos|commandamento|investigationes|ordines)\.html"/);
  }
  for (const removed of [
    'almanac.html', 'almanac-page.js',
    'personage.html', 'personage-page.js',
    'pensamentos.html', 'pensamentos-page.js',
    'commandamento.html', 'commandamento-page.js',
    'mappa.html', 'mappa-page.js', 'location.html',
    'observationes.html', 'observationes-page.js',
    'decisiones.html', 'decisiones-page.js',
    'investigationes.html', 'ordines.html'
  ]) await assert.rejects(readPublic(removed), removed);
});

test('static page shells contain only their exact configured sections', async () => {
  for (const [file, module, pageId, sectionIds] of [
    ['identitate.html', 'identitate-page.js', 'page-04', ['01','02','03','09','07']],
    ['inventario.html', 'inventario-page.js', 'page-05', ['04','13']],
    ['subordinatos.html', 'subordinatos-page.js', 'page-06', ['11','12']]
  ]) {
    const [html, script] = await Promise.all([readPublic(file), readPublic(module)]);
    assert.equal((html.match(/class="content-section"/g) ?? []).length, sectionIds.length, file);
    assert.deepEqual([...html.matchAll(/data-page-section-id="page-section-(\d{2})"/g)].map((match) => match[1]), sectionIds, file);
    for (const sectionId of sectionIds) {
      assert.match(html, new RegExp(`aria-labelledby="page-section-${sectionId}-heading"[^]*id="page-section-${sectionId}-heading"[^]*data-page-section-id="page-section-${sectionId}"`));
    }
    assert.match(script, new RegExp(`bootstrapStaticPage\\('${pageId}'\\)`));
    assert.doesNotMatch(script, /bootstrapPage|startLiveState|calculateCalendarState/);
    assert.doesNotMatch(html, /Empty|None|Coming soon|Próximamente/);
  }

  const identitateHtml = await readPublic('identitate.html');
  assert.equal((identitateHtml.match(/data-page-section-id="page-section-07"/g) ?? []).length, 1);
  assert.ok(identitateHtml.indexOf('data-page-section-id="page-section-09"') < identitateHtml.indexOf('data-page-section-id="page-section-07"'));
  assert.doesNotMatch(identitateHtml, /page-section-(?:06|08|10)/);

  const [rutasHtml, rutasScript] = await Promise.all([readPublic('rutas.html'), readPublic('rutas-page.js')]);
  assert.equal((rutasHtml.match(/class="content-section"/g) ?? []).length, 1);
  assert.match(rutasHtml, /<section class="content-section" aria-labelledby="rutas-content-heading">\s*<h2 id="rutas-content-heading" class="content-section-title" data-page-name><\/h2>/);
  assert.equal((rutasHtml.match(/data-page-section-id/g) ?? []).length, 0);
  assert.match(rutasScript, /bootstrapStaticPage\('page-08'\)/);
  assert.doesNotMatch(rutasScript, /bootstrapPage|startLiveState|calculateCalendarState/);

  const [explorarHtml, explorarScript] = await Promise.all([readPublic('explorar.html'), readPublic('explorar-page.js')]);
  assert.equal((explorarHtml.match(/class="content-section"/g) ?? []).length, 1);
  assert.match(explorarHtml, /<section class="content-section" aria-labelledby="page-section-06-heading">\s*<h2 id="page-section-06-heading" class="content-section-title" data-page-section-id="page-section-06"><\/h2>/);
  assert.equal((explorarHtml.match(/data-page-section-id/g) ?? []).length, 1);
  assert.equal((explorarHtml.match(/data-page-name/g) ?? []).length, 1);
  assert.doesNotMatch(explorarHtml, /page-section-07|explorar-content-heading|tertiary-nav|Empty|None|Coming soon|Próximamente/);
  assert.match(explorarScript, /bootstrapStaticPage\('page-09'\)/);
  assert.doesNotMatch(explorarScript, /bootstrapPage|startLiveState|calculateCalendarState/);

  const [locusHtml, locusScript] = await Promise.all([readPublic('locus.html'), readPublic('locus-page.js')]);
  assert.equal((locusHtml.match(/class="location-section"/g) ?? []).length, 1);
  assert.equal((locusHtml.match(/data-current-location/g) ?? []).length, 1);
  assert.match(locusHtml, /<section class="location-section" aria-labelledby="current-location-heading">[^]*id="current-location-heading"[^]*data-message-key="label\.currentLocation"[^]*class="location-name" data-current-location/);
  assert.doesNotMatch(locusHtml, /Santiago|coordinates|iframe|img|geolocation/);
  assert.match(locusScript, /bootstrapStaticPage\('page-07'\)/);
  assert.doesNotMatch(locusScript, /bootstrapPage|startLiveState|calculateCalendarState/);
  assert.match(locusHtml, /data-navigation-submenu-pages="page-07 page-08 page-09"/);
  const productionSource = (await Promise.all((await listSourceFiles(path.join(root, 'public'))).map((file) => readFile(file, 'utf8')))).join('\n');
  assert.doesNotMatch(productionSource, /navigator\.geolocation|<iframe|maps\.google|mapbox|leaflet/i);
});

test('removed layout and JSON selectors no longer remain in shared CSS', async () => {
  const css = await readPublic('styles.css');
  for (const selector of [
    '.page-header', '.page-kicker', '.primary-clock', '.outcome-heading', '.json-details',
    '.json-toolbar', '.json-content', '.copy-status', '.clipboard-fallback', '.metadata'
  ]) assert.ok(!css.includes(selector), selector);
  assert.doesNotMatch(css, /(^|\n)button\s*\{|(^|\n)pre\s*\{|(^|\n)summary\s*\{/);
  assert.match(css, /\.footer-version\s*\{\s*white-space:\s*nowrap;/);
  assert.doesNotMatch(css, /\.lunar-summary\b/);
  assert.match(css, /\.date p\s*\{\s*margin:\s*0;/);
  assert.match(css, /\.year\s*\{[^}]*font-size:[^}]*font-weight:/);
  assert.match(css, /\.period\s*\{[^}]*margin-top:[^}]*font-size:/);
  const body = css.match(/body\s*\{[^}]*\}/)?.[0] ?? '';
  const pageShell = css.match(/\.page-shell\s*\{[^}]*\}/)?.[0] ?? '';
  const siteHeader = css.match(/\.site-header\s*\{[^}]*\}/)?.[0] ?? '';
  const primaryNav = css.match(/\.primary-nav\s*\{[^}]*\}/)?.[0] ?? '';
  const categories = css.match(/\.primary-nav-categories\s*\{[^}]*\}/)?.[0] ?? '';
  const secondary = css.match(/\.secondary-nav\s*\{[^}]*\}/)?.[0] ?? '';
  assert.doesNotMatch(body, /display:\s*grid|place-items:\s*center/);
  assert.match(body, /padding:\s*0 1\.25rem 1\.25rem/);
  assert.match(pageShell, /margin-inline:\s*auto/);
  assert.match(siteHeader, /position:\s*sticky/);
  assert.match(siteHeader, /top:\s*0/);
  assert.match(siteHeader, /z-index:\s*(?:[1-9]\d*)/);
  assert.match(siteHeader, /background:\s*Canvas/);
  assert.doesNotMatch(siteHeader, /position:\s*fixed/);
  assert.doesNotMatch(primaryNav, /display:\s*grid|grid-template-columns|gap:|margin-bottom/);
  assert.match(categories, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(secondary, /grid-template-columns:\s*repeat\(auto-fit, minmax\(7rem, 1fr\)\)/);
  assert.match(css, /\.secondary-nav\[hidden\]\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /\.tertiary-nav|\.navigation-subcategory-link/);
  assert.match(css, /\.navigation-category-link\[data-active-section="true"\]/);
  assert.doesNotMatch(css, /\.primary-nav a \+ a/);
  for (const selector of ['.content-section', '.location-section', '.content-section-title', '.location-name']) {
    assert.ok(css.includes(selector), selector);
  }
  for (const preserved of [
    '.section-label', '.group-label', '.lunar-metadata', '.lunar-time', '.lunar-name',
    '.season-section', '.season-name', '.season-metadata', '.season-cycle-metadata',
    '.weather-progress', '.weather-progress-heading'
  ]) assert.ok(css.includes(preserved), preserved);
});

test('JSON serialization is schema v19 with calendar time intact', async () => {
  const [presentation, mechanics] = await Promise.all([readPublic('presentation.js'), readPublic('core/mechanics.js')]);
  assert.match(presentation, /export function createCalendarJson/);
  assert.match(presentation, /calendarVersion: 'v19'/);
  assert.match(presentation, /time: formatClock\(state\.calendar\.time\)/);
  assert.match(mechanics, /time: \{ hour, minute, second \}/);
});

test('repository prose contains only the approved period terminology', async () => {
  const sourceFiles = [
    path.join(root, 'README.md'),
    ...await listSourceFiles(path.join(root, 'public')),
    ...await listSourceFiles(path.join(root, 'test'))
  ];
  const obsoleteSpacedForm = /Inter\s+(?:Regnum|Regna|Rengum)/i;
  const obsoleteUnspacedLatinForm = /Interregn(?:um|a)/;
  for (const file of sourceFiles) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, obsoleteSpacedForm, file);
    assert.doesNotMatch(source, obsoleteUnspacedLatinForm, file);
  }
});

test('Interregno proper names are sourced only from nomenclature', async () => {
  for (const file of [
    'presentation.js', 'calendario-page.js', 'calendario.html',
    'locales/en.json', 'locales/es.json', 'core/rules.js', 'core/mechanics.js'
  ]) {
    assert.doesNotMatch(await readPublic(file), /Interregno/, file);
  }
  const nomenclature = JSON.parse(await readPublic('config/nomenclature.json'));
  assert.deepEqual(nomenclature.calendar.interRegna.map(({ name }) => name), [
    'Primus Interregno', 'Secundus Interregno', 'Tertius Interregno',
    'Quartus Interregno', 'Quintus Interregno', 'Sextus Interregno',
    'Septimus Interregno', 'Octavus Interregno', 'Nonus Interregno',
    'Decimus Interregno', 'Undecimus Interregno'
  ]);
});

test('Calendario renderer arranges the presentation-ready lunar summary values', async () => {
  const renderer = await readPublic('calendario-page.js');
  for (const removed of [
    '#lunar-metadata', 'lunar.metadata', 'label.lunarDay',
    'cycleLengthDays', 'state.lunar.day', 'state.lunar.cycle', 'state.lunar.phaseId',
    'formatRomanNumeral', 'context.getLunarPhase', 'context.lunarCycleName',
    'display.lunar.formattedSummary', '.split('
  ]) assert.ok(!renderer.includes(removed), removed);
  assert.doesNotMatch(renderer, /querySelector\('#lunar-phase'\)/);
  assert.match(renderer, /querySelector\('#lunar-summary'\)/);
  assert.doesNotMatch(renderer, /lunar-cycle-title|lunar-phase-subtitle/);
  assert.match(renderer, /lunarSummary\.textContent = `\$\{display\.lunar\.cycleName\} \$\{display\.lunar\.formattedCycle\} · \$\{display\.lunar\.phase\.name\}`/);
  assert.equal((renderer.match(/createDisplayData\(state, context\)/g) ?? []).length, 1);
});

test('Calendario combines the presentation-ready year and current season in its title', async () => {
  const renderer = await readPublic('calendario-page.js');
  assert.match(
    renderer,
    /year\.textContent\s*=\s*`\$\{display\.calendar\.formattedYear\} · \$\{display\.season\.name\}`;/
  );
  for (const removed of [
    'createSeasonRenderer', 'renderSeason', 'context.getSeason', 'state.season.id',
    'season.metadata', 'season.progress'
  ]) assert.equal(renderer.includes(removed), false, removed);
  assert.match(renderer, /period\.textContent = display\.calendar\.periodLabel/);
  assert.match(renderer, /accessibleDate\.textContent = display\.formattedDate/);
  assert.match(renderer, /display\.lunar\.cycleName/);
  assert.match(renderer, /display\.lunar\.formattedCycle/);
  assert.match(renderer, /display\.lunar\.phase\.name/);
});

test('Calendario title uses the configured current season in both season states', async () => {
  const context = await productionContext();
  const ossosDisplay = createDisplayData(calculateCalendarState(0), context);
  const lacrimasTimestamp = SEASON_LENGTH_DAYS
    * FICTIONAL_SECONDS_PER_DAY
    * REAL_MS_PER_FICTIONAL_SECOND;
  const lacrimasDisplay = createDisplayData(calculateCalendarState(lacrimasTimestamp), context);
  const ossosTitle = `${ossosDisplay.calendar.formattedYear} · ${ossosDisplay.season.name}`;
  const lacrimasTitle = `${lacrimasDisplay.calendar.formattedYear} · ${lacrimasDisplay.season.name}`;

  assert.equal(ossosTitle, 'Annus Solis I · Ossos');
  assert.match(lacrimasTitle, / · Lacrimas$/);
});

test('Calendario title changes at the live Ossos-to-Lacrimas boundary without changing year', async () => {
  const context = await productionContext();
  const boundaryTimestamp = SEASON_LENGTH_DAYS
    * FICTIONAL_SECONDS_PER_DAY
    * REAL_MS_PER_FICTIONAL_SECOND;
  const beforeDisplay = createDisplayData(calculateCalendarState(boundaryTimestamp - 1), context);
  const boundaryDisplay = createDisplayData(calculateCalendarState(boundaryTimestamp), context);
  const beforeTitle = `${beforeDisplay.calendar.formattedYear} · ${beforeDisplay.season.name}`;
  const boundaryTitle = `${boundaryDisplay.calendar.formattedYear} · ${boundaryDisplay.season.name}`;

  assert.equal(beforeDisplay.calendar.formattedYear, boundaryDisplay.calendar.formattedYear);
  assert.match(beforeTitle, / · Ossos$/);
  assert.match(boundaryTitle, / · Lacrimas$/);
});

test('Calendario rendering path omits removed numeric progress indicators', async () => {
  const renderer = await readPublic('calendario-page.js');
  const source = renderer + await readPublic('presentation.js');
  for (const removed of [
    'weekOfYear', 'dayOfYear', 'DAYS_PER_YEAR', 'label.week', 'calendar.metadata',
    '#fictional-metadata'
  ]) assert.ok(!source.includes(removed), removed);
  assert.doesNotMatch(renderer, /context\.message\(['"]label\.year|state\.calendar\.year|formatRomanNumeral/);
});
