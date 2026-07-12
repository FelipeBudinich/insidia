import { bootstrapPage } from './app-bootstrap.js';
import { createDisplayData } from './presentation.js';

function createCalendarioPageRenderer(root, context) {
  const year = root.querySelector('#fictional-year');
  const period = root.querySelector('#fictional-period');
  const accessibleDate = root.querySelector('#fictional-date-accessible');
  const lunarSummary = root.querySelector('#lunar-summary');

  return function renderCalendario(state) {
    const display = createDisplayData(state, context);
    year.textContent = display.calendar.formattedYear;
    period.textContent = display.calendar.periodLabel;
    accessibleDate.textContent = display.formattedDate;
    lunarSummary.textContent = display.lunar.formattedSummary;
  };
}

bootstrapPage('page-01', createCalendarioPageRenderer);
