import { bootstrapDocument } from './app-bootstrap.js';
import { startLiveState } from './live-state.js';

export function bootstrapLivePage({
  pageId,
  calculateState,
  createRenderer,
  boundaryMilliseconds
}, options = {}) {
  if (typeof createRenderer !== 'function') {
    throw new TypeError('createRenderer must be a function');
  }
  return bootstrapDocument(pageId, options, (context, documentRoot) => startLiveState({
    calculateState,
    renderSnapshot: createRenderer(documentRoot, context),
    boundaryMilliseconds
  }));
}
