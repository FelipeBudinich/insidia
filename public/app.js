import {
  CALENDAR_EPOCH_UNIX_MS,
  REAL_MS_PER_FICTIONAL_SECOND,
  calculateFictionalCalendar,
  createCalendarJson,
  formatFictionalDate,
  formatFictionalTime,
  formatLunarTime,
  formatOrbitalPercentage,
  formatTideTime
} from './calendar.js';

const timeElement = document.querySelector('#fictional-time');
const yearElement = document.querySelector('#fictional-year');
const periodElement = document.querySelector('#fictional-period');
const metadataElement = document.querySelector('#fictional-metadata');
const seasonNameElement = document.querySelector('#season-name');
const seasonMetadataElement = document.querySelector('#season-metadata');
const seasonCycleMetadataElement = document.querySelector('#season-cycle-metadata');
const lunarPhaseElement = document.querySelector('#lunar-phase');
const lunarMetadataElement = document.querySelector('#lunar-metadata');
const lunarTimeElement = document.querySelector('#lunar-time');
const tideNameElement = document.querySelector('#tide-name');
const tideMetadataElement = document.querySelector('#tide-metadata');
const tideTimeElement = document.querySelector('#tide-time');
const orbitalBodyElements = new Map(
  [...document.querySelectorAll('[data-orbital-body]')].map((row) => [
    row.dataset.orbitalBody,
    {
      metadata: row.querySelector('[data-orbital-metadata]'),
      percentage: row.querySelector('[data-orbital-percentage]'),
      progress: row.querySelector('progress')
    }
  ])
);
const pullElements = new Map(
  [...document.querySelectorAll('[data-pull-key]')].map((pullElement) => [
    pullElement.dataset.pullKey,
    {
      members: pullElement.querySelector('[data-pull-members]'),
      span: pullElement.querySelector('[data-pull-span]'),
      alignment: pullElement.querySelector('[data-pull-alignment]'),
      selection: pullElement.querySelector('[data-pull-selection]')
    }
  ])
);
const progressElements = new Map(
  [...document.querySelectorAll('[data-progress-key]')].map((row) => [
    row.dataset.progressKey,
    {
      bar: row.querySelector('progress'),
      percentage: row.querySelector('[data-progress-percentage]')
    }
  ])
);
const jsonElement = document.querySelector('#json-output');
const copyButton = document.querySelector('#copy-json');
const copyStatusElement = document.querySelector('#copy-status');

let timeoutId;
let currentJsonSnapshot = '';

function render(realUnixMilliseconds = Date.now()) {
  const calendarValue = calculateFictionalCalendar(realUnixMilliseconds);
  const formattedTime = formatFictionalTime(calendarValue);
  const formattedDate = formatFictionalDate(calendarValue);
  const { lunar, orbits, progress, season } = calendarValue;
  const snapshot = JSON.stringify(createCalendarJson(calendarValue, realUnixMilliseconds), null, 2);

  timeElement.textContent = formattedTime;
  yearElement.textContent = `Year ${calendarValue.year}`;
  periodElement.textContent = calendarValue.period.type === 'month'
    ? `Month ${calendarValue.period.month} · Day ${calendarValue.period.day}`
    : `Inter Regnum ${calendarValue.period.fromMonth} → ${calendarValue.period.toMonth} · Day ${calendarValue.period.day} of ${calendarValue.period.length}`;
  metadataElement.textContent = `Week ${calendarValue.weekOfYear} · Day ${calendarValue.dayOfWeek} of 7 · Day ${calendarValue.dayOfYear} of 353`;
  seasonNameElement.textContent = season.name;
  seasonMetadataElement.textContent = `Day ${season.day} of ${season.lengthDays} · Seasonal Cycle ${season.cycle}`;
  seasonCycleMetadataElement.textContent = `Seasonal Day ${season.dayOfCycle} of ${season.cycleLengthDays} · Next: ${season.next.name}`;
  lunarPhaseElement.textContent = lunar.phase.name;
  lunarMetadataElement.textContent = `Lunar Day ${lunar.day} of ${lunar.cycleLengthDays} · Cycle ${lunar.cycle}`;
  lunarTimeElement.textContent = `Lunar time ${formatLunarTime(lunar)}`;
  tideNameElement.textContent = lunar.tide.name;
  tideMetadataElement.textContent = `Hour ${lunar.tide.hour} of ${lunar.tide.durationHours}`;
  tideTimeElement.textContent = `${formatTideTime(lunar)} into ${lunar.tide.name}`;
  for (const body of orbits.bodies) {
    const bodyElements = orbitalBodyElements.get(body.id);
    const periodLength = body.orbitalPeriodLunarDays ?? body.orbitalPeriodDays;
    bodyElements.metadata.textContent = `Orbit ${body.orbit} · Day ${body.dayOfOrbit} of ${periodLength}`;
    bodyElements.percentage.textContent = formatOrbitalPercentage(body.progressFraction);
    bodyElements.progress.value = body.progressFraction;
  }
  for (const pullKey of ['dominantPull', 'minorPull', 'negativePull']) {
    const pull = orbits[pullKey];
    const elements = pullElements.get(pullKey);
    elements.members.textContent = pull.members.map((member) => member.name).join(' · ');
    elements.span.textContent = `Circular span ${formatOrbitalPercentage(pull.spanFraction)}`;
    elements.alignment.textContent = `Alignment ${formatOrbitalPercentage(1 - pull.spanFraction)}`;
    elements.selection.textContent = pull.tieBreak.applied
      ? `Fixed-priority tie-break applied among ${pull.tieBreak.tiedCombinationCount} tied trios`
      : `No fixed-priority tie-break · selected from ${pull.evaluatedCombinationCount} trios`;
  }
  for (const [key, progressValue] of Object.entries(progress)) {
    const elements = progressElements.get(key);
    elements.bar.value = progressValue.fraction;
    elements.percentage.textContent = progressValue.formatted;
  }
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

function copyWithLegacyCommand(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.inset = '0 auto auto 0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.padding = '0';
  textarea.style.border = '0';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) {
    throw new Error('Copy command was unavailable');
  }
}

function copyWithClipboardApi(text) {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error('Clipboard API timed out'));
    }, 500);

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
  if (navigator.clipboard?.writeText) {
    try {
      await copyWithClipboardApi(text);
      return;
    } catch {
      // Some embedded browsers expose the API but deny write permission.
    }
  }
  copyWithLegacyCommand(text);
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
