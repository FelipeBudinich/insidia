import { calculateTemporeState } from './core/mechanics.js';
import { TEMPORE_BOUNDARY_MILLISECONDS } from './core/rules.js';
import { bootstrapLivePage } from './live-page-bootstrap.js';
import { createSeasonRenderer, createTimeRenderer, createWeatherProgressRenderer } from './renderers.js';

function createTemporePageRenderer(root, context) {
  const renderTime = createTimeRenderer(root);
  const renderSeason = createSeasonRenderer(root, context);
  const renderProgress = createWeatherProgressRenderer(root);
  return (state) => { renderTime(state); renderSeason(state); renderProgress(state); };
}

bootstrapLivePage({
  pageId: 'page-03',
  calculateState: calculateTemporeState,
  createRenderer: createTemporePageRenderer,
  boundaryMilliseconds: TEMPORE_BOUNDARY_MILLISECONDS
});
