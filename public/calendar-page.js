import { bootstrapPage } from './app-bootstrap.js';
import { captureLiveState } from './live-state.js';
import { createCalendarJson, createDisplayData } from './presentation.js';

function fallbackCopy(text, root) {
  const area = root.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.className = 'clipboard-fallback';
  root.body.append(area);
  area.select();
  const copied = root.execCommand?.('copy') === true;
  area.remove();
  if (!copied) throw new Error('Copy command failed');
}

async function copyText(text, root) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* use fallback */ }
  }
  fallbackCopy(text, root);
}

bootstrapPage('calendar', (root, context) => {
  const year = root.querySelector('#fictional-year');
  const period = root.querySelector('#fictional-period');
  const time = root.querySelector('#fictional-time');
  const metadata = root.querySelector('#fictional-metadata');
  const accessibleDate = root.querySelector('#fictional-date-accessible');
  const phase = root.querySelector('#lunar-phase');
  const lunarMetadata = root.querySelector('#lunar-metadata');
  const json = root.querySelector('#json-output');
  const copyButton = root.querySelector('#copy-json');
  const copyStatus = root.querySelector('#copy-status');
  let currentSnapshot = '';

  function render(state, realUnixMilliseconds) {
    const display = createDisplayData(state, context);
    year.textContent = `${context.message('label.year')} ${state.calendar.year}`;
    period.textContent = display.calendar.periodLabel;
    time.textContent = display.calendar.time;
    metadata.textContent = display.calendar.metadata;
    accessibleDate.textContent = display.formattedDate;
    phase.textContent = display.lunar.phase.name;
    lunarMetadata.textContent = context.format('lunar.metadata', {
      lunarDayLabel: context.message('label.lunarDay'), day: state.lunar.day,
      length: state.lunar.cycleLengthDays, cycleLabel: context.message('label.cycle'), cycle: state.lunar.cycle
    });
    currentSnapshot = JSON.stringify(createCalendarJson(state, realUnixMilliseconds, context), null, 2);
    json.textContent = currentSnapshot;
  }

  copyButton.addEventListener('click', async () => {
    const { calendarValue, realUnixMilliseconds } = captureLiveState();
    render(calendarValue, realUnixMilliseconds);
    try {
      await copyText(currentSnapshot, root);
      copyStatus.textContent = context.message('status.copied');
    } catch {
      copyStatus.textContent = context.message('status.copyFailure');
    }
  });
  return render;
});
