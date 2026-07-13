import { bootstrapPage } from './app-bootstrap.js';
import { createDisplayData } from './presentation.js';
import { createSeasonRenderer } from './renderers.js';

function createCalendarioPageRenderer(root, context) {
  const year = root.querySelector('#fictional-year');
  const period = root.querySelector('#fictional-period');
  const accessibleDate = root.querySelector('#fictional-date-accessible');
  const lunarCycleTitle = root.querySelector('#lunar-cycle-title');
  const lunarPhaseSubtitle = root.querySelector('#lunar-phase-subtitle');
  const renderSeason = createSeasonRenderer(root, context);

  return function renderCalendario(state) {
    const display = createDisplayData(state, context);
    year.textContent = display.calendar.formattedYear;
    period.textContent = display.calendar.periodLabel;
    accessibleDate.textContent = display.formattedDate;
    lunarCycleTitle.textContent = `${display.lunar.cycleName} ${display.lunar.formattedCycle}`;
    lunarPhaseSubtitle.textContent = display.lunar.phase.name;
    renderSeason(state);
  };
}

bootstrapPage('page-01', createCalendarioPageRenderer);
