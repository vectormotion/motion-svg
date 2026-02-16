import type { Timeline, Actor, Keyframe } from '../types';
import { timeline as createTimeline } from './timeline';

// ── Sequence Configuration ──

export interface SequenceItem {
  timeline: Timeline;
  /** Absolute offset from the start of the sequence. If omitted, follows the previous item. */
  offset?: number;
  /** Delay before this item (added to the resolved start time) */
  delay?: number;
}

export interface SequenceConfig {
  items: SequenceItem[];
}

export type StaggerFrom = 'start' | 'end' | 'center' | 'edges';

export interface StaggerConfig {
  /** The actors to animate */
  actors: Actor[];
  /** Keyframes template (applied to every actor) */
  keyframes: Keyframe[];
  /** Delay between consecutive actors (ms) */
  stagger: number;
  /** Stagger direction */
  from?: StaggerFrom;
}

// ── Sequence ──

/**
 * Combine multiple timelines into a single sequential Timeline.
 *
 * Each item is offset in time to create a chain:
 * tl1 (0–500ms) → tl2 (500–1200ms) → tl3 (1200–1800ms)
 *
 * Offsets and delays are cumulative by default.
 */
export function sequence(actor: Actor, config: SequenceConfig): Timeline {
  let cursor = 0;
  const allKeyframes: Keyframe[] = [];

  for (const item of config.items) {
    const delay = item.delay ?? 0;
    const start = (item.offset ?? cursor) + delay;

    for (const kf of item.timeline.keyframes) {
      allKeyframes.push({
        ...kf,
        at: kf.at + start,
      });
    }

    cursor = start + item.timeline.duration;
  }

  return createTimeline(actor, { keyframes: allKeyframes });
}

// ── Stagger ──

/**
 * Create staggered timelines for an array of actors.
 *
 * Same animation, but each actor starts with an incremental delay.
 *
 * ```ts
 * const timelines = stagger({
 *   actors: [card1, card2, card3, card4],
 *   keyframes: [
 *     { at: 0, opacity: 0, position: { x: 0, y: 20 } },
 *     { at: 400, opacity: 1, position: { x: 0, y: 0 }, curve: 'easeOutCubic' },
 *   ],
 *   stagger: 100,
 *   from: 'start',
 * });
 * // card1: 0–400ms, card2: 100–500ms, card3: 200–600ms, card4: 300–700ms
 * ```
 */
export function stagger(config: StaggerConfig): Timeline[] {
  const { actors, keyframes, stagger: staggerDelay, from = 'start' } = config;
  const n = actors.length;

  const order = computeStaggerOrder(n, from);

  return actors.map((actor, i) => {
    const delay = order[i] * staggerDelay;
    const offsetKeyframes = keyframes.map((kf) => ({
      ...kf,
      at: kf.at + delay,
    }));
    return createTimeline(actor, { keyframes: offsetKeyframes });
  });
}

/**
 * Compute the stagger order indices based on direction.
 * Returns an array where order[i] is the delay multiplier for actor i.
 */
function computeStaggerOrder(n: number, from: StaggerFrom): number[] {
  switch (from) {
    case 'end':
      return Array.from({ length: n }, (_, i) => n - 1 - i);
    case 'center': {
      const mid = (n - 1) / 2;
      return Array.from({ length: n }, (_, i) => Math.abs(i - mid));
    }
    case 'edges': {
      const mid = (n - 1) / 2;
      return Array.from({ length: n }, (_, i) => mid - Math.abs(i - mid));
    }
    default: // 'start'
      return Array.from({ length: n }, (_, i) => i);
  }
}

// ── Parallel (utility) ──

/**
 * Return the total duration of an array of timelines executed in parallel.
 * Useful for knowing when all animations are finished.
 */
export function parallelDuration(timelines: Timeline[]): number {
  return Math.max(0, ...timelines.map((tl) => tl.duration));
}
