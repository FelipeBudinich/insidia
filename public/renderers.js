import {
  formatFictionalTime,
  formatLunarTime,
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

export function createTimeRenderer(root = document) {
  const fictionalTimeElement = requireElement(root, '#fictional-time');
  const lunarTimeElement = requireElement(root, '#lunar-time');

  return function renderTime(calendarValue) {
    fictionalTimeElement.textContent = formatFictionalTime(calendarValue);
    lunarTimeElement.textContent = formatLunarTime(calendarValue.lunar);
  };
}

export function createWeatherProgressRenderer(root = document) {
  const progressRows = [
    ['lunarPhase', '#lunar-day-progress', '#lunar-day-progress-value'],
    ['day', '#day-progress', '#day-progress-value'],
    ['hour', '#hour-progress', '#hour-progress-value']
  ].map(([key, progressSelector, valueSelector]) => ({
    key,
    progress: requireElement(root, progressSelector),
    value: requireElement(root, valueSelector)
  }));

  return function renderWeatherProgress(calendarValue) {
    for (const row of progressRows) {
      const progressValue = calendarValue.progress[row.key];
      row.progress.value = progressValue.percentage;
      row.value.textContent = progressValue.formatted;
    }
  };
}

const OUTCOME_RULE_LABELS = Object.freeze({
  closest_to_completion: 'Closest to orbit completion',
  furthest_from_completion: 'Furthest from orbit completion',
  median_progress: 'Middle orbital progress'
});

export function createOutcomeRenderer(root = document) {
  const bodyElement = requireElement(root, '#outcome-body');
  const outcomeTypeElement = requireElement(root, '#outcome-type');
  const attemptsElement = requireElement(root, '#outcome-attempts');
  const progressElement = requireElement(root, '#outcome-progress');
  const sourceElement = requireElement(root, '#outcome-source');
  const ruleElement = requireElement(root, '#outcome-rule');
  const tieBreakElement = requireElement(root, '#outcome-tiebreak');

  return function renderOutcome(outcome) {
    bodyElement.textContent = `${outcome.body.symbol} ${outcome.body.name}`;
    outcomeTypeElement.textContent = `Outcome: ${outcome.outcomeType.name}`;
    attemptsElement.textContent = `Attempts until Rare: ${outcome.outcomeType.attemptsUntilRare}`;
    progressElement.textContent = `Orbital progress: ${outcome.body.formattedProgress}`;
    sourceElement.textContent = `${outcome.tide.name} · ${outcome.sourcePull.name}`;
    ruleElement.textContent = OUTCOME_RULE_LABELS[outcome.selectionRule];
    tieBreakElement.hidden = !outcome.tieBreak.applied;
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
  const nextElement = requireElement(root, '[data-season-next]');
  const progressElement = requireElement(root, '[data-season-progress]');
  const progressBar = requireElement(root, '[data-season-progress-bar]');

  return function renderSeason(calendarValue) {
    const { season } = calendarValue;
    nameElement.textContent = season.name;
    metadataElement.textContent = `Day ${season.day} of ${season.lengthDays} · Seasonal Cycle ${season.cycle}`;
    cycleElement.textContent = `Seasonal Day ${season.dayOfCycle} of ${season.cycleLengthDays}`;
    nextElement.textContent = `Next: ${season.next.name}`;
    progressElement.textContent = `Progress: ${calendarValue.progress.season.formatted}`;
    progressBar.value = calendarValue.progress.season.fraction;
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
    ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'moon'].map((bodyId) => {
      const bodyElement = requireElement(root, `[data-orbital-body="${bodyId}"]`);
      return [
        bodyId,
        {
          metadata: requireElement(bodyElement, '[data-orbital-metadata]'),
          percentage: requireElement(bodyElement, '[data-orbital-percentage]'),
          progress: requireElement(bodyElement, 'progress')
        }
      ];
    })
  );

  return function renderCelestialOrbits(calendarValue) {
    for (const body of calendarValue.orbits.bodies) {
      const elements = bodyElements.get(body.id);
      if (!elements) {
        throw new Error(`Missing required orbital body renderer: ${body.id}`);
      }
      const periodLength = body.orbitalPeriodLunarDays ?? body.orbitalPeriodDays;
      elements.metadata.textContent = `Orbit ${body.orbit} · Day ${body.dayOfOrbit} of ${periodLength}`;
      elements.percentage.textContent = formatOrbitalPercentage(body.progressFraction);
      elements.progress.value = body.progressFraction;
    }
  };
}

export function createOrbitalPullsRenderer(root = document) {
  const pullElements = new Map(
    ['dominantPull', 'minorPull', 'negativePull'].map((pullKey) => {
      const pullElement = requireElement(root, `[data-pull-key="${pullKey}"]`);
      return [
        pullKey,
        {
          members: requireElement(pullElement, '[data-pull-members]'),
          span: requireElement(pullElement, '[data-pull-span]'),
          alignment: requireElement(pullElement, '[data-pull-alignment]'),
          selection: requireElement(pullElement, '[data-pull-selection]')
        }
      ];
    })
  );

  return function renderOrbitalPulls(calendarValue) {
    for (const pullKey of ['dominantPull', 'minorPull', 'negativePull']) {
      const pull = calendarValue.orbits[pullKey];
      const elements = pullElements.get(pullKey);
      if (!elements) {
        throw new Error(`Missing required orbital pull renderer: ${pullKey}`);
      }
      elements.members.textContent = pull.members.map((member) => member.name).join(' · ');
      elements.span.textContent = `Circular span ${pull.formattedSpan}`;
      elements.alignment.textContent = `Alignment ${pull.formattedAlignment}`;
      elements.selection.textContent = pull.tieBreak.applied
        ? `Fixed-priority tie-break applied among ${pull.tieBreak.tiedCombinationCount} tied trios`
        : `No fixed-priority tie-break · selected from ${pull.evaluatedCombinationCount} trios`;
    }
  };
}
