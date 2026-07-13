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

test('package and visible application versions are v8.17', async () => {
  const [packageJson, packageLock, bootstrap] = await Promise.all([
    readFile(path.join(root, 'package.json'), 'utf8'),
    readFile(path.join(root, 'package-lock.json'), 'utf8'),
    readPublic('app-bootstrap.js')
  ]);
  assert.equal(JSON.parse(packageJson).version, '8.17.0');
  assert.equal(JSON.parse(packageLock).version, '8.17.0');
  assert.match(bootstrap, /const APPLICATION_VERSION = '8\.17'/);
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

test('each configured page has one localized v8.17 footer version', async () => {
  for (const file of ['calendario.html','destino.html','tempore.html','personage.html','pensamentos.html','commandamento.html','mappa.html']) {
    const html = await readPublic(file);
    assert.equal((html.match(/data-version/g) ?? []).length, 1, file);
    const footer = html.slice(html.indexOf('<footer>'), html.indexOf('</footer>') + '</footer>'.length);
    assert.match(footer, /data-application-name/);
    assert.match(footer, /data-epoch/);
    assert.match(footer, /class="version footer-version" data-version>v8\.17/);
    assert.equal((footer.match(/aria-hidden="true"/g) ?? []).length, 2);
    assert.equal(html.indexOf('data-version'), html.indexOf('data-version', html.indexOf('<footer>')));
  }
});

test('new pages use neutral IDs, fixed routes, one active link, and renamed modules', async () => {
  const pages = [
    ['calendario.html','page-01','calendario-page.js'],
    ['destino.html','page-02','destino-page.js'],
    ['tempore.html','page-03','tempore-page.js'],
    ['personage.html','page-04','personage-page.js'],
    ['pensamentos.html','page-05','pensamentos-page.js'],
    ['commandamento.html','page-06','commandamento-page.js'],
    ['mappa.html','page-07','mappa-page.js']
  ];
  for (const [file, activeId, module] of pages) {
    const html = await readPublic(file);
    assert.equal((html.match(/data-page-id=/g) ?? []).length, 7);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(html, new RegExp(`data-page-id="${activeId}"[^>]*aria-current="page"`));
    for (const route of ['/calendario.html','/destino.html','/tempore.html','/personage.html','/pensamentos.html','/commandamento.html','/mappa.html']) assert.ok(html.includes(`href="${route}"`));
    assert.match(html, new RegExp(`src="/${module}"`));
    assert.doesNotMatch(html, /data-page-link/);
  }
});

test('static page shells contain only their exact neutral configured sections', async () => {
  for (const [file, module, pageId, sectionIds] of [
    ['personage.html', 'personage-page.js', 'page-04', ['01','02','03','04','05']],
    ['pensamentos.html', 'pensamentos-page.js', 'page-05', ['06','07','08','09']],
    ['commandamento.html', 'commandamento-page.js', 'page-06', ['10','11','12']]
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

  const [mappaHtml, mappaScript] = await Promise.all([readPublic('mappa.html'), readPublic('mappa-page.js')]);
  assert.equal((mappaHtml.match(/class="location-section"/g) ?? []).length, 1);
  assert.equal((mappaHtml.match(/data-current-location/g) ?? []).length, 1);
  assert.match(mappaHtml, /<section class="location-section" aria-labelledby="current-location-heading">[^]*id="current-location-heading"[^]*data-message-key="label\.currentLocation"[^]*class="location-name" data-current-location/);
  assert.doesNotMatch(mappaHtml, /Santiago|coordinates|iframe|img|geolocation/);
  assert.match(mappaScript, /bootstrapStaticPage\('page-07'\)/);
  assert.doesNotMatch(mappaScript, /bootstrapPage|startLiveState|calculateCalendarState/);
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
  assert.match(css, /repeat\(auto-fit, minmax\(7rem, 1fr\)\)/);
  assert.match(css, /gap:\s*1px/);
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
