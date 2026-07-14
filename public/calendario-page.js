import { calculateCalendarioState } from './core/mechanics.js';
import { CALENDARIO_BOUNDARY_MILLISECONDS } from './core/rules.js';
import { bootstrapLivePage } from './live-page-bootstrap.js';
import { createCalendarioDisplayData } from './presentation.js';

function createCalendarioPageRenderer(root, context) {
  const year = root.querySelector('#fictional-year');
  const period = root.querySelector('#fictional-period');
  const accessibleDate = root.querySelector('#fictional-date-accessible');
  const lunarSummary = root.querySelector('#lunar-summary');

  return function renderCalendario(state) {
    const display = createCalendarioDisplayData(state, context);
    year.textContent = `${display.formattedYear} · ${display.seasonName}`;
    period.textContent = display.periodLabel;
    accessibleDate.textContent = display.formattedDate;
    lunarSummary.textContent = `${display.lunarCycleName} ${display.formattedLunarCycle} · ${display.lunarPhaseName}`;
  };
}

bootstrapLivePage({
  pageId: 'page-01',
  calculateState: calculateCalendarioState,
  createRenderer: createCalendarioPageRenderer,
  boundaryMilliseconds: CALENDARIO_BOUNDARY_MILLISECONDS
});
