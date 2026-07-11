import {
  CALENDAR_EPOCH_UNIX_MS,
  REAL_MS_PER_FICTIONAL_SECOND,
  calculateFictionalCalendar,
  createCalendarJson,
  formatFictionalDate,
  formatFictionalTime,
  formatLunarTime,
  formatTideTime
} from './calendar.js';

const timeElement = document.querySelector('#fictional-time');
const yearElement = document.querySelector('#fictional-year');
const periodElement = document.querySelector('#fictional-period');
const metadataElement = document.querySelector('#fictional-metadata');
const lunarPhaseElement = document.querySelector('#lunar-phase');
const lunarMetadataElement = document.querySelector('#lunar-metadata');
const lunarTimeElement = document.querySelector('#lunar-time');
const tideNameElement = document.querySelector('#tide-name');
const tideMetadataElement = document.querySelector('#tide-metadata');
const tideTimeElement = document.querySelector('#tide-time');
const jsonElement = document.querySelector('#json-output');
const copyButton = document.querySelector('#copy-json');
const copyStatusElement = document.querySelector('#copy-status');

let timeoutId;
let currentJsonSnapshot = '';

function render(realUnixMilliseconds = Date.now()) {
  const calendarValue = calculateFictionalCalendar(realUnixMilliseconds);
  const formattedTime = formatFictionalTime(calendarValue);
  const formattedDate = formatFictionalDate(calendarValue);
  const { lunar } = calendarValue;
  const snapshot = JSON.stringify(createCalendarJson(calendarValue, realUnixMilliseconds), null, 2);

  timeElement.textContent = formattedTime;
  yearElement.textContent = `Year ${calendarValue.year}`;
  periodElement.textContent = calendarValue.period.type === 'month'
    ? `Month ${calendarValue.period.month} · Day ${calendarValue.period.day}`
    : `Inter Regnum ${calendarValue.period.fromMonth} → ${calendarValue.period.toMonth} · Day ${calendarValue.period.day} of ${calendarValue.period.length}`;
  metadataElement.textContent = `Week ${calendarValue.weekOfYear} · Day ${calendarValue.dayOfWeek} of 7 · Day ${calendarValue.dayOfYear} of 353`;
  lunarPhaseElement.textContent = lunar.phase.name;
  lunarMetadataElement.textContent = `Lunar Day ${lunar.day} of ${lunar.cycleLengthDays} · Cycle ${lunar.cycle}`;
  lunarTimeElement.textContent = `Lunar time ${formatLunarTime(lunar)}`;
  tideNameElement.textContent = lunar.tide.name;
  tideMetadataElement.textContent = `Hour ${lunar.tide.hour} of ${lunar.tide.durationHours}`;
  tideTimeElement.textContent = `${formatTideTime(lunar)} into ${lunar.tide.name}`;
  document.querySelector('#fictional-date-accessible').textContent = formattedDate;
  jsonElement.textContent = snapshot;
  currentJsonSnapshot = snapshot;
}

function scheduleNextUpdate() {
  window.clearTimeout(timeoutId);
  const elapsedWithinSecond = (Date.now() - CALENDAR_EPOCH_UNIX_MS) % REAL_MS_PER_FICTIONAL_SECOND;
  const millisecondsUntilNextSecond = REAL_MS_PER_FICTIONAL_SECOND - elapsedWithinSecond;
  timeoutId = window.setTimeout(() => {
    render();
    scheduleNextUpdate();
  }, Math.max(1, millisecondsUntilNextSecond + 5));
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) {
    throw new Error('Copy command was unavailable');
  }
}

copyButton.addEventListener('click', async () => {
  render(Date.now());
  try {
    await copyText(currentJsonSnapshot);
    copyStatusElement.textContent = 'Copied';
  } catch {
    copyStatusElement.textContent = 'Unable to copy. Select the JSON and copy it manually.';
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    render();
    scheduleNextUpdate();
  }
});

render();
scheduleNextUpdate();
