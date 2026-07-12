import { bootstrapPage } from './app-bootstrap.js';
import { createSeasonRenderer, createTimeRenderer, createWeatherProgressRenderer } from './renderers.js';

bootstrapPage('weather', (root, context) => {
  const renderTime = createTimeRenderer(root, context);
  const renderSeason = createSeasonRenderer(root, context);
  const renderProgress = createWeatherProgressRenderer(root);
  return (state) => { renderTime(state); renderSeason(state); renderProgress(state); };
});
