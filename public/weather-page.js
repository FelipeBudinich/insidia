import { startLiveState } from './live-state.js';
import {
  createSeasonRenderer,
  createTimeRenderer,
  createWeatherProgressRenderer
} from './renderers.js';

const renderTime = createTimeRenderer(document);
const renderSeason = createSeasonRenderer(document);
const renderProgress = createWeatherProgressRenderer(document);

startLiveState((calendarValue) => {
  renderTime(calendarValue);
  renderSeason(calendarValue);
  renderProgress(calendarValue);
});
