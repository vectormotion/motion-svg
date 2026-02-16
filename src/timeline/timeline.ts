import type { Actor, Timeline, TimelineConfig, Keyframe } from '../types';

let timelineCounter = 0;

/**
 * Create a Timeline — a sequence of keyframes bound to an Actor.
 *
 * Keyframes are automatically sorted by `at` (time in ms).
 * The total duration is derived from the last keyframe.
 */
export function timeline(actor: Actor, config: TimelineConfig): Timeline {
  if (!config.keyframes || config.keyframes.length === 0) {
    throw new Error(`motion-svg: timeline for actor "${actor.id}" needs at least one keyframe.`);
  }

  timelineCounter++;

  // Sort by time
  const sorted = [...config.keyframes].sort((a, b) => a.at - b.at);

  // Ensure the first keyframe has a full state (defaults from actor)
  const first = sorted[0];
  const filledFirst: Keyframe = {
    at: first.at,
    position: first.position ?? { ...actor.origin },
    scale: first.scale ?? 1,
    rotation: first.rotation ?? 0,
    opacity: first.opacity ?? 1,
    fill: first.fill,
    stroke: first.stroke,
    strokeWidth: first.strokeWidth,
    strokeAlign: first.strokeAlign,
    blurRadius: first.blurRadius,
    backdropBlur: first.backdropBlur,
    curve: first.curve,
  };
  sorted[0] = filledFirst;

  const duration = sorted[sorted.length - 1].at;

  return {
    id: `tl-${actor.id}-${timelineCounter}`,
    actorId: actor.id,
    keyframes: sorted,
    duration,
  };
}
