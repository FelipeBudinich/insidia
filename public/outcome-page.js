import { startLiveState } from './live-state.js';
import {
  createCelestialOrbitsRenderer,
  createOutcomeRenderer,
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
  renderOutcome(calendarValue.outcome);
  renderTide(calendarValue);
  renderOrbitalPulls(calendarValue);
  renderCelestialOrbits(calendarValue);
  renderHourProgress(calendarValue);
});
