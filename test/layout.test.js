import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readPublic = (file) => readFile(path.join(root, 'public', file), 'utf8');

test('Calendar removes visible time, title, JSON, and copy controls', async () => {
  const [html, script] = await Promise.all([readPublic('calendar.html'), readPublic('calendar-page.js')]);
  for (const removed of [
    'id="fictional-time"', 'class="primary-clock"', '<header class="heading"',
    'json-details', 'json-output', 'copy-json', 'copy-status', 'JSON output', 'Copy JSON'
  ]) assert.ok(!html.includes(removed), removed);
  for (const removed of [
    'createCalendarJson', 'captureLiveState', '#fictional-time', 'navigator.clipboard',
    'execCommand', 'textarea', 'currentSnapshot', '#json-output', '#copy-json', '#copy-status'
  ]) assert.ok(!script.includes(removed), removed);
  assert.match(html, /<h1 id="calendar-page-heading" class="visually-hidden" data-message-key="page\.calendar"><\/h1>/);
  assert.match(html, /<section class="calendar-card" aria-labelledby="calendar-page-heading">\s*<div class="date">/);
});

test('Calendar preserves date and lunar structures in visible order', async () => {
  const html = await readPublic('calendar.html');
  for (const id of ['fictional-year','fictional-period','fictional-metadata','fictional-date-accessible','lunar-phase','lunar-metadata']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  const calendarIndex = html.indexOf('<section class="calendar-card"');
  const lunarIndex = html.indexOf('<section class="lunar-section"');
  const footerIndex = html.indexOf('<footer>');
  assert.ok(calendarIndex < lunarIndex && lunarIndex < footerIndex);
});

test('Outcome removes its visible title and begins its card with the selected body', async () => {
  const html = await readPublic('outcome.html');
  assert.match(html, /<h1 id="outcome-page-heading" class="visually-hidden" data-message-key="page\.outcome"><\/h1>/);
  assert.match(html, /<section class="outcome-section" aria-labelledby="outcome-page-heading"><p id="outcome-body"/);
  assert.doesNotMatch(html, /id="outcome-heading"|class="heading outcome-heading"/);
  const section = html.slice(html.indexOf('<section class="outcome-section"'), html.indexOf('</section>', html.indexOf('<section class="outcome-section"')));
  assert.equal((section.match(/data-message-key="page\.outcome"/g) ?? []).length, 0);
  for (const id of ['outcome-body','outcome-type','outcome-attempts','outcome-source','outcome-progress','outcome-rule','outcome-tiebreak']) {
    assert.match(section, new RegExp(`id="${id}"`));
  }
});

test('Weather removes its page header and begins visibly with Time', async () => {
  const html = await readPublic('weather.html');
  assert.doesNotMatch(html, /class="page-header"|class="page-kicker"/);
  assert.match(html, /<h1 id="weather-page-heading" class="visually-hidden" data-message-key="page\.weather"><\/h1>/);
  const main = html.slice(html.indexOf('<main class="container">'), html.indexOf('</main>'));
  assert.equal(main.indexOf('<section'), main.indexOf('<section class="time-section"'));
  for (const preserved of [
    'id="fictional-time"', 'id="lunar-time"', 'data-season-name', 'data-season-progress',
    'id="lunar-day-progress"', 'id="day-progress"', 'id="hour-progress"'
  ]) assert.ok(html.includes(preserved), preserved);
});

test('each page has one localized version element and it is inside the complete footer', async () => {
  for (const file of ['calendar.html','outcome.html','weather.html']) {
    const html = await readPublic(file);
    assert.equal((html.match(/data-version/g) ?? []).length, 1, file);
    const footer = html.slice(html.indexOf('<footer>'), html.indexOf('</footer>') + '</footer>'.length);
    assert.match(footer, /data-application-name/);
    assert.match(footer, /data-epoch/);
    assert.match(footer, /class="version footer-version" data-version>v8\.1/);
    assert.equal((footer.match(/aria-hidden="true"/g) ?? []).length, 2);
    assert.equal(html.indexOf('data-version'), html.indexOf('data-version', html.indexOf('<footer>')));
  }
});

test('removed layout and JSON selectors no longer remain in shared CSS', async () => {
  const css = await readPublic('styles.css');
  for (const selector of [
    '.page-header', '.page-kicker', '.primary-clock', '.outcome-heading', '.json-details',
    '.json-toolbar', '.json-content', '.copy-status', '.clipboard-fallback'
  ]) assert.ok(!css.includes(selector), selector);
  assert.doesNotMatch(css, /(^|\n)button\s*\{|(^|\n)pre\s*\{|(^|\n)summary\s*\{/);
  assert.match(css, /\.footer-version\s*\{\s*white-space:\s*nowrap;/);
});

test('JSON serialization remains public schema v10 with calendar time intact', async () => {
  const [presentation, mechanics] = await Promise.all([readPublic('presentation.js'), readPublic('core/mechanics.js')]);
  assert.match(presentation, /export function createCalendarJson/);
  assert.match(presentation, /calendarVersion: 'v10'/);
  assert.match(presentation, /time: formatClock\(state\.calendar\.time\)/);
  assert.match(mechanics, /time: \{ hour, minute, second \}/);
});
