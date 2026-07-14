import { calculateDestinoState } from './core/mechanics.js';
import { DESTINO_BOUNDARY_MILLISECONDS } from './core/rules.js';
import { bootstrapLivePage } from './live-page-bootstrap.js';
import { createCelestialOrbitsRenderer, createOrbitalPullsRenderer, createOutcomeRenderer, createTideProgressRenderer, createTideRenderer } from './renderers.js';

function createDestinoPageRenderer(root, context) {
  const renderOutcome = createOutcomeRenderer(root, context, 'page-02');
  const renderTide = createTideRenderer(root, context);
  const renderPulls = createOrbitalPullsRenderer(root, context);
  const renderOrbits = createCelestialOrbitsRenderer(root, context);
  const renderProgress = createTideProgressRenderer(root);
  return (state) => { renderOutcome(state.outcome); renderTide(state); renderPulls(state); renderOrbits(state); renderProgress(state); };
}

bootstrapLivePage({
  pageId: 'page-02',
  calculateState: calculateDestinoState,
  createRenderer: createDestinoPageRenderer,
  boundaryMilliseconds: DESTINO_BOUNDARY_MILLISECONDS
});
