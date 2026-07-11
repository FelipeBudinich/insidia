import { startLiveState } from './live-state.js';
import {
  createCelestialOrbitsRenderer,
  createOrbitalPullsRenderer,
  createTideRenderer
} from './renderers.js';

const renderTide = createTideRenderer(document);
const renderCelestialOrbits = createCelestialOrbitsRenderer(document);
const renderOrbitalPulls = createOrbitalPullsRenderer(document);

startLiveState((calendarValue) => {
  renderTide(calendarValue);
  renderCelestialOrbits(calendarValue);
  renderOrbitalPulls(calendarValue);
});
