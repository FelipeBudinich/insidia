import { startLiveState } from './live-state.js';
import { createSeasonRenderer } from './renderers.js';

const renderSeason = createSeasonRenderer(document);

startLiveState((calendarValue) => {
  renderSeason(calendarValue);
});
