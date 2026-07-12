import { startLiveState } from './live-state.js';
import {
  createCelestialOrbitsRenderer,
  createDropRenderer,
  createHourProgressRenderer,
  createOrbitalPullsRenderer,
  createTideRenderer
} from './renderers.js';

const renderDrop = createDropRenderer(document);
const renderHourProgress = createHourProgressRenderer(document);
const renderTide = createTideRenderer(document);
const renderCelestialOrbits = createCelestialOrbitsRenderer(document);
const renderOrbitalPulls = createOrbitalPullsRenderer(document);

startLiveState((calendarValue) => {
  renderDrop(calendarValue.drop);
  renderTide(calendarValue);
  renderOrbitalPulls(calendarValue);
  renderCelestialOrbits(calendarValue);
  renderHourProgress(calendarValue);
});
