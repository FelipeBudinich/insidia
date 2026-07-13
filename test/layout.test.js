import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readPublic = (file) => readFile(path.join(root, 'public', file), 'utf8');

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

test('Calendario preserves date and lunar structures in visible order', async () => {
  const html = await readPublic('calendario.html');
  for (const id of ['fictional-year','fictional-period','fictional-date-accessible','lunar-cycle-title','lunar-phase-subtitle']) {
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
});

test('Calendario lunar card mirrors the two-line calendar title hierarchy', async () => {
  const html = await readPublic('calendario.html');
  const start = html.indexOf('<section class="lunar-section"');
  const section = html.slice(start, html.indexOf('</section>', start) + '</section>'.length);
  assert.match(section, /<section class="lunar-section" aria-labelledby="lunar-cycle-title">/);
  assert.match(section, /<div class="date">\s*<p id="lunar-cycle-title" class="year"><\/p>\s*<p id="lunar-phase-subtitle" class="period"><\/p>\s*<\/div>/);
  const paragraphs = [...section.matchAll(/<p\b[^>]*>/g)].map(([tag]) => tag);
  assert.equal(paragraphs.length, 2);
  assert.equal(paragraphs.filter((tag) => !tag.includes('visually-hidden')).length, 2);
  assert.match(section, /id="lunar-cycle-title" class="year"/);
  assert.match(section, /id="lunar-phase-subtitle" class="period"/);
  assert.doesNotMatch(section, /lunar-summary|lunar-name|section\.lunar|label\.phase|lunar-metadata|data-message-key|•/);
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

test('Tempore preserves its header removal and begins visibly with Time', async () => {
  const [html, script] = await Promise.all([readPublic('tempore.html'), readPublic('tempore-page.js')]);
  assert.doesNotMatch(html, /class="page-header"|class="page-kicker"/);
  assert.match(html, /<h1 id="page-heading" class="visually-hidden" data-page-name><\/h1>/);
  const main = html.slice(html.indexOf('<main class="container">'), html.indexOf('</main>'));
  assert.equal(main.indexOf('<section'), main.indexOf('<section class="time-section"'));
  for (const preserved of [
    'id="fictional-time"', 'id="lunar-time"', 'data-season-name', 'data-season-progress',
    'id="lunar-day-progress"', 'id="day-progress"', 'id="hour-progress"'
  ]) assert.ok(html.includes(preserved), preserved);
  assert.match(script, /bootstrapPage\('page-03', createTemporePageRenderer\)/);
});

test('each renamed page has one localized v8.10 footer version', async () => {
  for (const file of ['calendario.html','destino.html','tempore.html']) {
    const html = await readPublic(file);
    assert.equal((html.match(/data-version/g) ?? []).length, 1, file);
    const footer = html.slice(html.indexOf('<footer>'), html.indexOf('</footer>') + '</footer>'.length);
    assert.match(footer, /data-application-name/);
    assert.match(footer, /data-epoch/);
    assert.match(footer, /class="version footer-version" data-version>v8\.10/);
    assert.equal((footer.match(/aria-hidden="true"/g) ?? []).length, 2);
    assert.equal(html.indexOf('data-version'), html.indexOf('data-version', html.indexOf('<footer>')));
  }
});

test('new pages use neutral IDs, fixed routes, one active link, and renamed modules', async () => {
  const pages = [
    ['calendario.html','page-01','calendario-page.js'],
    ['destino.html','page-02','destino-page.js'],
    ['tempore.html','page-03','tempore-page.js']
  ];
  for (const [file, activeId, module] of pages) {
    const html = await readPublic(file);
    assert.equal((html.match(/data-page-id=/g) ?? []).length, 3);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
    assert.match(html, new RegExp(`data-page-id="${activeId}"[^>]*aria-current="page"`));
    for (const route of ['/calendario.html','/destino.html','/tempore.html']) assert.ok(html.includes(`href="${route}"`));
    assert.match(html, new RegExp(`src="/${module}"`));
    assert.doesNotMatch(html, /data-page-link/);
  }
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
  for (const preserved of ['.section-label', '.group-label', '.lunar-metadata', '.lunar-time', '.lunar-name']) assert.ok(css.includes(preserved), preserved);
});

test('JSON serialization is schema v15 with calendar time intact', async () => {
  const [presentation, mechanics] = await Promise.all([readPublic('presentation.js'), readPublic('core/mechanics.js')]);
  assert.match(presentation, /export function createCalendarJson/);
  assert.match(presentation, /calendarVersion: 'v15'/);
  assert.match(presentation, /time: formatClock\(state\.calendar\.time\)/);
  assert.match(mechanics, /time: \{ hour, minute, second \}/);
});

test('Calendario renderer arranges presentation-ready lunar title and subtitle values', async () => {
  const renderer = await readPublic('calendario-page.js');
  for (const removed of [
    '#lunar-summary', '#lunar-metadata', 'lunar.metadata', 'label.lunarDay',
    'cycleLengthDays', 'state.lunar.day', 'state.lunar.cycle', 'state.lunar.phaseId',
    'formatRomanNumeral', 'context.getLunarPhase', 'context.lunarCycleName',
    'display.lunar.formattedSummary', '.split('
  ]) assert.ok(!renderer.includes(removed), removed);
  assert.doesNotMatch(renderer, /querySelector\('#lunar-phase'\)/);
  assert.match(renderer, /querySelector\('#lunar-cycle-title'\)/);
  assert.match(renderer, /querySelector\('#lunar-phase-subtitle'\)/);
  assert.match(renderer, /lunarCycleTitle\.textContent = `\$\{display\.lunar\.cycleName\} \$\{display\.lunar\.formattedCycle\}`/);
  assert.match(renderer, /lunarPhaseSubtitle\.textContent = display\.lunar\.phase\.name/);
  assert.equal((renderer.match(/createDisplayData\(state, context\)/g) ?? []).length, 1);
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
