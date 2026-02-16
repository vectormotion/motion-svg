import type { Timeline, TriggerConfig, TriggerBinding } from '../types';

/**
 * Bind a trigger configuration to a timeline.
 *
 * This creates a TriggerBinding — a declarative description of *when* and
 * *how* an animation should be activated. The actual event wiring is handled
 * by the renderer (React bindings or manual DOM setup).
 */
export function trigger(tl: Timeline, config: TriggerConfig): TriggerBinding {
  validateTrigger(config);

  return {
    timelineId: tl.id,
    config: { ...config },
  };
}

function validateTrigger(config: TriggerConfig): void {
  const { type } = config;

  switch (type) {
    case 'hover':
      break;
    case 'click':
      break;
    case 'loop': {
      if (config.iterations !== undefined && config.iterations < 0) {
        throw new Error('motion-svg: loop trigger iterations must be >= 0 (or Infinity).');
      }
      if (config.delay !== undefined && config.delay < 0) {
        throw new Error('motion-svg: loop trigger delay must be >= 0.');
      }
      break;
    }
    case 'scroll': {
      if (config.start !== undefined && (config.start < 0 || config.start > 1)) {
        throw new Error('motion-svg: scroll trigger start must be between 0 and 1.');
      }
      if (config.end !== undefined && (config.end < 0 || config.end > 1)) {
        throw new Error('motion-svg: scroll trigger end must be between 0 and 1.');
      }
      break;
    }
    case 'appear': {
      if (config.threshold !== undefined && (config.threshold < 0 || config.threshold > 1)) {
        throw new Error('motion-svg: appear trigger threshold must be between 0 and 1.');
      }
      break;
    }
    case 'manual':
      break;
    default:
      throw new Error(`motion-svg: unknown trigger type "${type}".`);
  }
}
