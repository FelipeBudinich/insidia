import {
  formatOrbitalPercentage,
  formatTideTime
} from './calendar.js';

function requireElement(root, selector) {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const DROP_RULE_LABELS = Object.freeze({
  closest_to_completion: 'Closest to orbit completion',
  furthest_from_completion: 'Furthest from orbit completion',
  median_progress: 'Middle orbital progress'
});

export function createDropRenderer(root = document) {
  const bodyElement = requireElement(root, '#drop-body');
  const rewardElement = requireElement(root, '#drop-reward');
  const attemptsElement = requireElement(root, '#drop-attempts');
  const progressElement = requireElement(root, '#drop-progress');
  const sourceElement = requireElement(root, '#drop-source');
  const ruleElement = requireElement(root, '#drop-rule');
  const tieBreakElement = requireElement(root, '#drop-tiebreak');

  return function renderDrop(drop) {
    bodyElement.textContent = `${drop.body.symbol} ${drop.body.name}`;
    rewardElement.textContent = `Reward: ${drop.reward.name}`;
    attemptsElement.textContent = `Attempts until Rare: ${drop.reward.attemptsUntilRare}`;
    progressElement.textContent = `Orbital progress: ${drop.body.formattedProgress}`;
    sourceElement.textContent = `${drop.tide.name} · ${drop.sourcePull.name}`;
    ruleElement.textContent = DROP_RULE_LABELS[drop.selectionRule];
    tieBreakElement.hidden = !drop.tieBreak.applied;
    tieBreakElement.textContent = 'Fixed-priority tie-break applied';
  };
}

export function createHourProgressRenderer(root = document) {
  const progressElement = requireElement(root, '#hour-progress');
  const valueElement = requireElement(root, '#hour-progress-value');

  return function renderHourProgress(calendarValue) {
    const hourProgress = calendarValue.progress.hour;
    progressElement.value = hourProgress.percentage;
    valueElement.textContent = hourProgress.formatted;
  };
}

export function createSeasonRenderer(root = document) {
  const nameElement = requireElement(root, '[data-season-name]');
  const metadataElement = requireElement(root, '[data-season-metadata]');
  const cycleElement = requireElement(root, '[data-season-cycle-metadata]');
  const nextElement = root.querySelector('[data-season-next]');
  const progressElement = root.querySelector('[data-season-progress]');
  const progressBar = root.querySelector('[data-season-progress-bar]');

  return function renderSeason(calendarValue) {
    const { season } = calendarValue;
    nameElement.textContent = season.name;
    metadataElement.textContent = `Day ${season.day} of ${season.lengthDays} · Seasonal Cycle ${season.cycle}`;
    cycleElement.textContent = `Seasonal Day ${season.dayOfCycle} of ${season.cycleLengthDays}`;
    if (nextElement) {
      nextElement.textContent = `Next: ${season.next.name}`;
    } else {
      cycleElement.textContent += ` · Next: ${season.next.name}`;
    }
    if (progressElement) {
      progressElement.textContent = `Progress: ${calendarValue.progress.season.formatted}`;
    }
    if (progressBar) {
      progressBar.value = calendarValue.progress.season.fraction;
    }
  };
}

export function createTideRenderer(root = document) {
  const nameElement = requireElement(root, '[data-tide-name]');
  const metadataElement = requireElement(root, '[data-tide-metadata]');
  const timeElement = requireElement(root, '[data-tide-time]');

  return function renderTide(calendarValue) {
    const { tide } = calendarValue.lunar;
    nameElement.textContent = tide.name;
    metadataElement.textContent = `Hour ${tide.hour} of ${tide.durationHours}`;
    timeElement.textContent = `${formatTideTime(calendarValue.lunar)} into ${tide.name}`;
  };
}

export function createCelestialOrbitsRenderer(root = document) {
  const bodyElements = new Map(
    [...root.querySelectorAll('[data-orbital-body]')].map((bodyElement) => [
      bodyElement.dataset.orbitalBody,
      {
        metadata: requireElement(bodyElement, '[data-orbital-metadata]'),
        percentage: requireElement(bodyElement, '[data-orbital-percentage]'),
        progress: requireElement(bodyElement, 'progress')
      }
    ])
  );

  return function renderCelestialOrbits(calendarValue) {
    for (const body of calendarValue.orbits.bodies) {
      const elements = bodyElements.get(body.id);
      if (!elements) continue;
      const periodLength = body.orbitalPeriodLunarDays ?? body.orbitalPeriodDays;
      elements.metadata.textContent = `Orbit ${body.orbit} · Day ${body.dayOfOrbit} of ${periodLength}`;
      elements.percentage.textContent = formatOrbitalPercentage(body.progressFraction);
      elements.progress.value = body.progressFraction;
    }
  };
}

export function createOrbitalPullsRenderer(root = document) {
  const pullElements = new Map(
    [...root.querySelectorAll('[data-pull-key]')].map((pullElement) => [
      pullElement.dataset.pullKey,
      {
        members: requireElement(pullElement, '[data-pull-members]'),
        span: requireElement(pullElement, '[data-pull-span]'),
        alignment: requireElement(pullElement, '[data-pull-alignment]'),
        selection: requireElement(pullElement, '[data-pull-selection]')
      }
    ])
  );

  return function renderOrbitalPulls(calendarValue) {
    for (const pullKey of ['dominantPull', 'minorPull', 'negativePull']) {
      const pull = calendarValue.orbits[pullKey];
      const elements = pullElements.get(pullKey);
      if (!elements) continue;
      elements.members.textContent = pull.members.map((member) => member.name).join(' · ');
      elements.span.textContent = `Circular span ${pull.formattedSpan}`;
      elements.alignment.textContent = `Alignment ${pull.formattedAlignment}`;
      elements.selection.textContent = pull.tieBreak.applied
        ? `Fixed-priority tie-break applied among ${pull.tieBreak.tiedCombinationCount} tied trios`
        : `No fixed-priority tie-break · selected from ${pull.evaluatedCombinationCount} trios`;
    }
  };
}
