import { startLiveState } from './live-state.js';
import {
  createCelestialOrbitsRenderer,
  createDropRenderer as createOutcomeRenderer,
  createHourProgressRenderer,
  createOrbitalPullsRenderer,
  createTideRenderer
} from './renderers.js';

const renderOutcome = createOutcomeRenderer(document);
const renderHourProgress = createHourProgressRenderer(document);
const renderTide = createTideRenderer(document);
const renderCelestialOrbits = createCelestialOrbitsRenderer(document);
const renderOrbitalPulls = createOrbitalPullsRenderer(document);

startLiveState((calendarValue) => {
  renderOutcome(calendarValue.drop);
  renderTide(calendarValue);
  renderOrbitalPulls(calendarValue);
  renderCelestialOrbits(calendarValue);
  renderHourProgress(calendarValue);
});
