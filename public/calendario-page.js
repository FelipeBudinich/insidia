import { bootstrapPage } from './app-bootstrap.js';
import { createDisplayData } from './presentation.js';

function createCalendarioPageRenderer(root, context) {
  const year = root.querySelector('#fictional-year');
  const period = root.querySelector('#fictional-period');
  const metadata = root.querySelector('#fictional-metadata');
  const accessibleDate = root.querySelector('#fictional-date-accessible');
  const phase = root.querySelector('#lunar-phase');
  const lunarMetadata = root.querySelector('#lunar-metadata');

  return function renderCalendario(state) {
    const display = createDisplayData(state, context);
    year.textContent = `${context.message('label.year')} ${state.calendar.year}`;
    period.textContent = display.calendar.periodLabel;
    metadata.textContent = display.calendar.metadata;
    accessibleDate.textContent = display.formattedDate;
    phase.textContent = display.lunar.phase.name;
    lunarMetadata.textContent = context.format('lunar.metadata', {
      lunarDayLabel: context.message('label.lunarDay'),
      day: state.lunar.day,
      length: state.lunar.cycleLengthDays,
      cycleLabel: context.message('label.cycle'),
      cycle: state.lunar.cycle
    });
  };
}

bootstrapPage('page-01', createCalendarioPageRenderer);
