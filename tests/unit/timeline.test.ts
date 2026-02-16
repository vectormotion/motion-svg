import { describe, it, expect } from 'vitest';
import { timeline } from '../../src/timeline/timeline';
import type { Actor, Keyframe } from '../../src/types';

const mockActor: Actor = {
  id: 'actor-t',
  pathIds: ['p1'],
  paths: [{ id: 'p1', d: 'M0,0' }],
  origin: { x: 50, y: 50 },
  position: { x: 50, y: 50 },
  scale: 1,
  rotation: 0,
  opacity: 1,
  blurRadius: 0,
  backdropBlur: 0,
  z: 0,
};

describe('timeline', () => {
  it('creates a timeline with sorted keyframes', () => {
    const kfs: Keyframe[] = [
      { at: 1000, scale: 2 },
      { at: 0, scale: 1 },
      { at: 500, scale: 1.5 },
    ];
    const tl = timeline(mockActor, { keyframes: kfs });
    expect(tl.keyframes[0].at).toBe(0);
    expect(tl.keyframes[1].at).toBe(500);
    expect(tl.keyframes[2].at).toBe(1000);
  });

  it('derives duration from last keyframe', () => {
    const tl = timeline(mockActor, {
      keyframes: [
        { at: 0, opacity: 1 },
        { at: 2000, opacity: 0 },
      ],
    });
    expect(tl.duration).toBe(2000);
  });

  it('fills first keyframe with actor defaults', () => {
    const tl = timeline(mockActor, {
      keyframes: [
        { at: 0, fill: '#FF0000' },
        { at: 1000, fill: '#0000FF' },
      ],
    });
    const first = tl.keyframes[0];
    expect(first.position).toEqual({ x: 50, y: 50 });
    expect(first.scale).toBe(1);
    expect(first.rotation).toBe(0);
    expect(first.opacity).toBe(1);
  });

  it('preserves explicit first keyframe values over defaults', () => {
    const tl = timeline(mockActor, {
      keyframes: [
        { at: 0, position: { x: 10, y: 10 }, scale: 2, rotation: 45, opacity: 0.5 },
        { at: 1000, position: { x: 100, y: 100 } },
      ],
    });
    const first = tl.keyframes[0];
    expect(first.position).toEqual({ x: 10, y: 10 });
    expect(first.scale).toBe(2);
    expect(first.rotation).toBe(45);
    expect(first.opacity).toBe(0.5);
  });

  it('assigns actorId and unique id', () => {
    const tl = timeline(mockActor, { keyframes: [{ at: 0 }, { at: 500 }] });
    expect(tl.actorId).toBe('actor-t');
    expect(tl.id).toContain('tl-actor-t');
  });

  it('throws with no keyframes', () => {
    expect(() => timeline(mockActor, { keyframes: [] })).toThrow('at least one keyframe');
  });
});
