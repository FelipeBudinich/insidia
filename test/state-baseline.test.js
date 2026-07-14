import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  calculateAbsoluteMonthStartDay,
  calculateCalendarState
} from '../public/core/mechanics.js';
import * as rules from '../public/core/rules.js';

const CALENDAR_DAY_MILLISECONDS = rules.FICTIONAL_SECONDS_PER_DAY
  * rules.REAL_MS_PER_FICTIONAL_SECOND;
const LUNAR_HOUR_MILLISECONDS = rules.LUNAR_SECONDS_PER_HOUR
  * rules.REAL_MS_PER_LUNAR_SECOND;
const LUNAR_DAY_MILLISECONDS = rules.LUNAR_SECONDS_PER_DAY
  * rules.REAL_MS_PER_LUNAR_SECOND;
const LUNAR_CYCLE_MILLISECONDS = rules.LUNAR_SECONDS_PER_CYCLE
  * rules.REAL_MS_PER_LUNAR_SECOND;
const FIRST_TIDE_SECONDS = rules.TIDE_RULES[0].durationHours
  * rules.LUNAR_SECONDS_PER_HOUR;
const FIRST_INFREQUENT_SECOND = Math.floor(FIRST_TIDE_SECONDS * 0.85) + 1;
const FIRST_RARE_SECOND = Math.floor(FIRST_TIDE_SECONDS * 0.99) + 1;
const REPLACEMENT_MONTH_INDEX = (12 * rules.MONTHS_PER_YEAR) + 2;

const COMPLETE_STATE_BASELINES = Object.freeze([
  ['epoch', 0, 'e23b4190d0afa995af3beca9a95064aab3be0c7eb352d929d05a8e965a3abf91'],
  ['calendar second before', rules.REAL_MS_PER_FICTIONAL_SECOND - 1, 'e23b4190d0afa995af3beca9a95064aab3be0c7eb352d929d05a8e965a3abf91'],
  ['calendar second at', rules.REAL_MS_PER_FICTIONAL_SECOND, 'bfa24007091df37c2cf79d093ad087bafa2756612ded4752991ae13a24aa38a8'],
  ['lunar second before', rules.REAL_MS_PER_LUNAR_SECOND - 1, 'bfa24007091df37c2cf79d093ad087bafa2756612ded4752991ae13a24aa38a8'],
  ['lunar second at', rules.REAL_MS_PER_LUNAR_SECOND, '42b2f79c4667be5cb3d20353c1fdabf0d67073360f319b4c766e1a94d4ff24ba'],
  ['month boundary before', (29 * CALENDAR_DAY_MILLISECONDS) - 1, 'fe8ddcc5a9493450cf4399f9e48632914fbf39335ddbb0acdc2ff745c179531f'],
  ['month boundary at', 29 * CALENDAR_DAY_MILLISECONDS, '24b5c4af322feeb80f73445ab231860878cdb62f4409318c3179da1facffc1d8'],
  ['Interregno boundary before', (32 * CALENDAR_DAY_MILLISECONDS) - 1, '798a7fc327c25029129e2763a07946c7e5cf86cf8a27ec666350045f9cff6292'],
  ['Interregno boundary at', 32 * CALENDAR_DAY_MILLISECONDS, '9390eda131b262c90eb31361e03b2b69ca3e2bfca236e8a1316a94708c4deb17'],
  ['season boundary before', (rules.SEASON_LENGTH_DAYS * CALENDAR_DAY_MILLISECONDS) - 1, '9636de071dbf873163f2f6f2bcb6f823b7506234a1ffcb883160a9f89947b3f9'],
  ['season boundary at', rules.SEASON_LENGTH_DAYS * CALENDAR_DAY_MILLISECONDS, '846b1e227cf911da80216bf22fa16c6fcaf63f9e6aca57db547a8f8b72fbbe5e'],
  ['lunar day before', LUNAR_DAY_MILLISECONDS - 1, '722eaa68d5185fb8e2276e1a6f0cc74a3e386f8fb339b1309cf61040b48dfbcd'],
  ['lunar day at', LUNAR_DAY_MILLISECONDS, '1decd600cd32233e0675483bb5f005a10cebb1634717f9a02e13b8627415938d'],
  ['lunar cycle before', LUNAR_CYCLE_MILLISECONDS - 1, '2256b818ebf39cb87e5987be3b128d7add7f87bfe77f9dd747199b83faaf3035'],
  ['lunar cycle at', LUNAR_CYCLE_MILLISECONDS, '02f5b3d95ef0a4c3c3ddf367569c95d9a069c384ab68be054d12132a450474f6'],
  ['second tide before', (17 * LUNAR_HOUR_MILLISECONDS) - 1, 'f4e712cbaa6ae082fccf7d2f3ee7d64981e91109c8f4b62ace047faabc0007c6'],
  ['second tide at', 17 * LUNAR_HOUR_MILLISECONDS, '369b33e8dba5c2d874fe8d70ae3190099c24236037d0fb3f4675738b34e4928e'],
  ['third tide before', (30 * LUNAR_HOUR_MILLISECONDS) - 1, '524324469f87169a6402781081a526ae06a58b985bfb8dc9f4e028eb14b7ffb0'],
  ['third tide at', 30 * LUNAR_HOUR_MILLISECONDS, 'e43a5fe6554d59bb0ba7bb0bae4953b135569fdb848ece86d4cb1863a9d8db64'],
  ['next lunar-day first tide', 31 * LUNAR_HOUR_MILLISECONDS, '1decd600cd32233e0675483bb5f005a10cebb1634717f9a02e13b8627415938d'],
  ['Outcome threshold before Infrequens', (FIRST_INFREQUENT_SECOND * rules.REAL_MS_PER_LUNAR_SECOND) - 1, 'd8fa7657bfc4795dd794b5e54f9891fa08b50206bef76ea47f715be633a87a61'],
  ['Outcome threshold at Infrequens', FIRST_INFREQUENT_SECOND * rules.REAL_MS_PER_LUNAR_SECOND, '33987bcf56c15a47e77663449f73835678a94493b54db056625699c72b188d2c'],
  ['Outcome threshold before Rarum', (FIRST_RARE_SECOND * rules.REAL_MS_PER_LUNAR_SECOND) - 1, '6f9b12c3a569440fd37524ef82a0e54f2afc0d11f6f69c294ece8d15ec50522d'],
  ['Outcome threshold at Rarum', FIRST_RARE_SECOND * rules.REAL_MS_PER_LUNAR_SECOND, '242f154d441ba196cc14d93f65fdcc73eb4d7457766064ea350691cd15c098ee'],
  ['representative orbital month replacement', calculateAbsoluteMonthStartDay(REPLACEMENT_MONTH_INDEX) * CALENDAR_DAY_MILLISECONDS, '5f42468af1e655b53591c259439630f64bd9109725e64c524764183ae39635d8'],
  ['current-era 2026 timestamp', Date.parse('2026-07-14T00:00:00.000Z'), '55fcd2eb2ac82a904e48a57610fc1484a66f745eb81df8446379f1e0c627c794']
]);

function completeStateDigest(realUnixMilliseconds) {
  return createHash('sha256')
    .update(JSON.stringify(calculateCalendarState(realUnixMilliseconds)))
    .digest('hex');
}

test('complete public calendar state remains byte-equivalent at representative boundaries', () => {
  for (const [label, timestamp, expectedDigest] of COMPLETE_STATE_BASELINES) {
    assert.equal(completeStateDigest(timestamp), expectedDigest, label);
  }
});

test('representative replacement baseline exercises a real single-body replacement', () => {
  const timestamp = calculateAbsoluteMonthStartDay(REPLACEMENT_MONTH_INDEX)
    * CALENDAR_DAY_MILLISECONDS;
  const rulership = calculateCalendarState(timestamp).calendar.period.rulership;
  assert.equal(rulership.source, 'alternating_skip_single_body');
  assert.equal(rulership.replacement.applied, true);
  assert.equal(rulership.replacement.selectedBodyId, 'body-04');
  assert.equal(rulership.effectiveRulerId, 'ruler-03');
});
