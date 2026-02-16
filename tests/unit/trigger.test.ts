import { describe, it, expect } from 'vitest';
import { trigger } from '../../src/trigger/trigger';
import type { Timeline } from '../../src/types';

const mockTimeline: Timeline = {
  id: 'tl-1',
  actorId: 'a-1',
  keyframes: [{ at: 0 }, { at: 1000 }],
  duration: 1000,
};

describe('trigger', () => {
  it('creates a hover trigger binding', () => {
    const tb = trigger(mockTimeline, { type: 'hover', reverse: true });
    expect(tb.timelineId).toBe('tl-1');
    expect(tb.config.type).toBe('hover');
    if (tb.config.type === 'hover') expect(tb.config.reverse).toBe(true);
  });

  it('creates a click trigger binding', () => {
    const tb = trigger(mockTimeline, { type: 'click', toggle: true });
    expect(tb.config.type).toBe('click');
  });

  it('creates a loop trigger binding', () => {
    const tb = trigger(mockTimeline, { type: 'loop', iterations: 5, direction: 'alternate', delay: 200 });
    expect(tb.config.type).toBe('loop');
  });

  it('creates a scroll trigger binding', () => {
    const tb = trigger(mockTimeline, { type: 'scroll', start: 0.2, end: 0.8 });
    expect(tb.config.type).toBe('scroll');
  });

  it('creates an appear trigger binding', () => {
    const tb = trigger(mockTimeline, { type: 'appear', threshold: 0.5, once: true });
    expect(tb.config.type).toBe('appear');
  });

  it('creates a manual trigger binding', () => {
    const tb = trigger(mockTimeline, { type: 'manual' });
    expect(tb.config.type).toBe('manual');
  });

  it('copies config (no reference sharing)', () => {
    const cfg = { type: 'hover' as const, reverse: false };
    const tb = trigger(mockTimeline, cfg);
    cfg.reverse = true;
    if (tb.config.type === 'hover') expect(tb.config.reverse).toBe(false);
  });

  // Validation errors
  it('throws for negative loop iterations', () => {
    expect(() => trigger(mockTimeline, { type: 'loop', iterations: -1 })).toThrow('iterations must be >= 0');
  });

  it('throws for negative loop delay', () => {
    expect(() => trigger(mockTimeline, { type: 'loop', delay: -100 })).toThrow('delay must be >= 0');
  });

  it('throws for scroll start out of range', () => {
    expect(() => trigger(mockTimeline, { type: 'scroll', start: -0.1 })).toThrow('start must be between 0 and 1');
    expect(() => trigger(mockTimeline, { type: 'scroll', start: 1.5 })).toThrow('start must be between 0 and 1');
  });

  it('throws for scroll end out of range', () => {
    expect(() => trigger(mockTimeline, { type: 'scroll', end: -0.1 })).toThrow('end must be between 0 and 1');
    expect(() => trigger(mockTimeline, { type: 'scroll', end: 1.5 })).toThrow('end must be between 0 and 1');
  });

  it('throws for appear threshold out of range', () => {
    expect(() => trigger(mockTimeline, { type: 'appear', threshold: -0.1 })).toThrow('threshold must be between 0 and 1');
    expect(() => trigger(mockTimeline, { type: 'appear', threshold: 1.5 })).toThrow('threshold must be between 0 and 1');
  });

  it('throws for unknown trigger type', () => {
    expect(() => trigger(mockTimeline, { type: 'unknown' as any })).toThrow('unknown trigger type');
  });
});
