import { bootstrapPage } from './app-bootstrap.js';
import { createCelestialOrbitsRenderer, createHourProgressRenderer, createOrbitalPullsRenderer, createOutcomeRenderer, createTideRenderer } from './renderers.js';

bootstrapPage('outcome', (root, context) => {
  const renderOutcome = createOutcomeRenderer(root, context);
  const renderTide = createTideRenderer(root, context);
  const renderPulls = createOrbitalPullsRenderer(root, context);
  const renderOrbits = createCelestialOrbitsRenderer(root, context);
  const renderProgress = createHourProgressRenderer(root);
  return (state) => { renderOutcome(state.outcome); renderTide(state); renderPulls(state); renderOrbits(state); renderProgress(state); };
});
