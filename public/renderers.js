import { formatClock, formatPercentage } from './core/formatting.js';

function requireElement(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

export function createTimeRenderer(root) {
  const fictional = requireElement(root, '#fictional-time');
  const lunar = requireElement(root, '#lunar-time');
  return (state) => {
    fictional.textContent = formatClock(state.calendar.time);
    lunar.textContent = formatClock(state.lunar.time);
  };
}

export function createWeatherProgressRenderer(root) {
  const rows = [
    ['lunarPhase', '#lunar-day-progress', '#lunar-day-progress-value'],
    ['day', '#day-progress', '#day-progress-value'],
    ['hour', '#hour-progress', '#hour-progress-value']
  ].map(([key, progressSelector, valueSelector]) => ({
    key,
    progress: requireElement(root, progressSelector),
    value: requireElement(root, valueSelector)
  }));
  return (state) => {
    for (const row of rows) {
      row.progress.value = state.progress[row.key].percentage;
      row.value.textContent = formatPercentage(state.progress[row.key].fraction);
    }
  };
}

export function formatAttemptsUntilRare(outcome, context) {
  return context.format('outcome.attempts', {
    attemptsLabel: context.message('label.attemptsUntilRare'),
    rareName: context.getOutcomeType('outcome-tier-03').name,
    count: outcome.attemptsUntilRare
  });
}

export function createOutcomeRenderer(root, context, pageId) {
  const elements = Object.fromEntries(['body', 'type', 'attempts', 'progress', 'source', 'rule', 'tiebreak']
    .map((key) => [key, requireElement(root, `#outcome-${key}`)]));
  const pageName = context.getPage(pageId).name;
  const attemptsLabel = context.message('label.attemptsUntilRare');
  const rareName = context.getOutcomeType('outcome-tier-03').name;
  const progressLabel = context.message('label.orbitalProgress');
  const tieBreakMessage = context.message('status.tieBreakApplied');
  return (outcome) => {
    const body = context.getCelestialBody(outcome.bodyId);
    const tide = context.getTide(outcome.tideId);
    const pull = context.getPull(outcome.sourcePullId);
    const type = context.getOutcomeType(outcome.outcomeTypeId);
    elements.body.textContent = `${body.symbol} ${body.name}`;
    elements.type.textContent = `${pageName} ${type.name}`;
    elements.attempts.textContent = context.format('outcome.attempts', {
      attemptsLabel,
      rareName,
      count: outcome.attemptsUntilRare
    });
    elements.progress.textContent = context.format('outcome.progress', { progressLabel, percentage: formatPercentage(outcome.bodyState.progressFraction) });
    elements.source.textContent = context.format('outcome.source', { tideName: tide.name, pullName: pull.name });
    elements.rule.textContent = context.message(`selection.${outcome.selectionRuleId}`);
    elements.tiebreak.hidden = !outcome.tieBreak.applied;
    elements.tiebreak.textContent = tieBreakMessage;
  };
}

export function createTideProgressRenderer(root) {
  const progress = requireElement(root, '#tide-progress');
  const value = requireElement(root, '#tide-progress-value');
  return (state) => {
    progress.value = state.progress.tide.percentage;
    value.textContent = formatPercentage(state.progress.tide.fraction);
  };
}

export function createSeasonRenderer(root, context) {
  const name = requireElement(root, '[data-season-name]');
  const metadata = requireElement(root, '[data-season-metadata]');
  const cycle = requireElement(root, '[data-season-cycle-metadata]');
  const next = requireElement(root, '[data-season-next]');
  const progress = requireElement(root, '[data-season-progress]');
  const progressBar = requireElement(root, '[data-season-progress-bar]');
  const dayLabel = context.message('label.day');
  const cycleLabel = context.message('label.cycle');
  const seasonalDayLabel = context.message('label.seasonalDay');
  const nextLabel = context.message('label.next');
  const progressLabel = context.message('label.progress');
  return (state) => {
    name.textContent = context.getSeason(state.season.id).name;
    metadata.textContent = context.format('season.metadata', { dayLabel, day: state.season.day, length: state.season.lengthDays, cycleLabel, cycle: state.season.cycle });
    cycle.textContent = context.format('season.cycle', { seasonalDayLabel, day: state.season.dayOfCycle, length: state.season.cycleLengthDays });
    next.textContent = context.format('season.next', { nextLabel, name: context.getSeason(state.season.nextId).name });
    progress.textContent = context.format('season.progress', { progressLabel, percentage: formatPercentage(state.progress.season.fraction) });
    progressBar.value = state.progress.season.fraction;
  };
}

export function createTideRenderer(root, context) {
  const name = requireElement(root, '[data-tide-name]');
  const metadata = requireElement(root, '[data-tide-metadata]');
  const time = requireElement(root, '[data-tide-time]');
  const hourLabel = context.message('label.hour');
  return (state) => {
    const tideName = context.getTide(state.lunar.tide.id).name;
    name.textContent = tideName;
    metadata.textContent = context.format('tide.metadata', { hourLabel, hour: state.lunar.tide.hour, length: state.lunar.tide.durationHours });
    time.textContent = context.format('tide.time', { time: formatClock(state.lunar.tide.timeInPeriod), name: tideName });
  };
}

export function createCelestialOrbitsRenderer(root, context) {
  const entries = new Map();
  for (const body of root.querySelectorAll('[data-body-id]')) {
    const entity = context.getCelestialBody(body.dataset.bodyId);
    entries.set(body.dataset.bodyId, {
      name: requireElement(body, '[data-orbital-name]'), period: requireElement(body, '[data-orbital-period]'),
      metadata: requireElement(body, '[data-orbital-metadata]'), percentage: requireElement(body, '[data-orbital-percentage]'), progress: requireElement(body, 'progress')
    });
    entries.get(body.dataset.bodyId).name.textContent = `${entity.symbol} ${entity.name}`;
    entries.get(body.dataset.bodyId).progress.setAttribute('aria-label', context.format('accessibility.orbitProgress', { bodyName: entity.name }));
  }
  return (state) => {
    for (const bodyState of state.orbits.bodies) {
      const elements = entries.get(bodyState.id);
      if (!elements) throw new Error(`Missing orbital body element: ${bodyState.id}`);
      const periodKey = bodyState.orbitalPeriod.unit === 'lunar_day' ? 'orbit.lunarPeriod' : 'orbit.calendarPeriod';
      elements.period.textContent = context.format(periodKey, { value: bodyState.orbitalPeriod.value });
      elements.metadata.textContent = context.format('orbit.metadata', { orbitLabel: context.message('label.orbit'), orbit: bodyState.orbit, dayLabel: context.message('label.day'), day: bodyState.dayOfOrbit, length: bodyState.orbitalPeriod.value });
      elements.percentage.textContent = formatPercentage(bodyState.progressFraction);
      elements.progress.value = bodyState.progressFraction;
    }
  };
}

export function createOrbitalPullsRenderer(root, context) {
  const entries = new Map();
  for (const card of root.querySelectorAll('[data-pull-id]')) {
    entries.set(card.dataset.pullId, {
      label: requireElement(card, '[data-pull-name]'), members: requireElement(card, '[data-pull-members]'),
      span: requireElement(card, '[data-pull-span]'), alignment: requireElement(card, '[data-pull-alignment]'), selection: requireElement(card, '[data-pull-selection]')
    });
    entries.get(card.dataset.pullId).label.textContent = context.getPull(card.dataset.pullId).name;
  }
  return (state) => {
    for (const [id, pull] of Object.entries(state.orbits.pulls)) {
      const elements = entries.get(id);
      if (!elements) throw new Error(`Missing pull element: ${id}`);
      elements.members.textContent = pull.memberIds.map((bodyId) => context.getCelestialBody(bodyId).name).join(' · ');
      elements.span.textContent = context.format('pull.span', { label: context.message('label.circularSpan'), percentage: formatPercentage(pull.spanFraction) });
      elements.alignment.textContent = context.format('pull.alignment', { label: context.message('label.alignment'), percentage: formatPercentage(1 - pull.spanFraction) });
      elements.selection.textContent = pull.tieBreak.applied
        ? context.format('pull.tie', { status: context.message('status.tieBreakApplied'), count: pull.tieBreak.tiedCombinationCount })
        : context.format('pull.noTie', { count: pull.evaluatedCombinationCount });
    }
  };
}
