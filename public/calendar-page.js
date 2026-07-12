import {
  createCalendarJson,
  formatFictionalDate
} from './calendar.js';
import { captureLiveState, startLiveState } from './live-state.js';

const yearElement = document.querySelector('#fictional-year');
const periodElement = document.querySelector('#fictional-period');
const metadataElement = document.querySelector('#fictional-metadata');
const accessibleDateElement = document.querySelector('#fictional-date-accessible');
const lunarPhaseElement = document.querySelector('#lunar-phase');
const lunarMetadataElement = document.querySelector('#lunar-metadata');
const jsonElement = document.querySelector('#json-output');
const copyButton = document.querySelector('#copy-json');
const copyStatusElement = document.querySelector('#copy-status');

let currentJsonSnapshot = '';

function renderCalendarPage(calendarValue, realUnixMilliseconds) {
  const formattedDate = formatFictionalDate(calendarValue);
  yearElement.textContent = `Year ${calendarValue.year}`;
  periodElement.textContent = calendarValue.period.type === 'month'
    ? `Month ${calendarValue.period.month} · Day ${calendarValue.period.day}`
    : `Inter Regnum ${calendarValue.period.fromMonth} → ${calendarValue.period.toMonth} · Day ${calendarValue.period.day} of ${calendarValue.period.length}`;
  metadataElement.textContent = `Week ${calendarValue.weekOfYear} · Day ${calendarValue.dayOfWeek} of 7 · Day ${calendarValue.dayOfYear} of 353`;
  accessibleDateElement.textContent = formattedDate;

  lunarPhaseElement.textContent = calendarValue.lunar.phase.name;
  lunarMetadataElement.textContent = `Lunar Day ${calendarValue.lunar.day} of ${calendarValue.lunar.cycleLengthDays} · Cycle ${calendarValue.lunar.cycle}`;
  currentJsonSnapshot = JSON.stringify(
    createCalendarJson(calendarValue, realUnixMilliseconds),
    null,
    2
  );
  jsonElement.textContent = currentJsonSnapshot;
}

function copyWithClipboardApi(text) {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(
      () => reject(new Error('Clipboard API timed out')),
      500
    );
    navigator.clipboard.writeText(text).then(
      () => {
        window.clearTimeout(timeoutId);
        resolve();
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

async function copyText(text) {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard API is unavailable');
  }
  await copyWithClipboardApi(text);
}

copyButton.addEventListener('click', async () => {
  const { calendarValue, realUnixMilliseconds } = captureLiveState();
  renderCalendarPage(calendarValue, realUnixMilliseconds);
  try {
    await copyText(currentJsonSnapshot);
    copyStatusElement.textContent = 'Copied';
  } catch {
    copyStatusElement.textContent = 'Unable to copy. Select the JSON and copy it manually.';
  }
});

startLiveState(renderCalendarPage);
