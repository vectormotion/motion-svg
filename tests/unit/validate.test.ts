import { describe, it, expect } from 'vitest';
import { validateBundle } from '../../src/bundle/validate';
import type { Bundle } from '../../src/types';

function validBundle(): Bundle {
  return {
    version: '1.0',
    scene: {
      viewBox: { x: 0, y: 0, w: 100, h: 100 },
      svg: '<svg></svg>',
      paths: [{ id: 'p1', d: 'M0,0' }],
      colors: {},
    },
    actors: [{ id: 'a1', pathIds: ['p1'], origin: { x: 0, y: 0 } }],
    timelines: [{ actorId: 'a1', keyframes: [{ at: 0 }, { at: 1000 }] }],
    triggers: [{ timelineIdx: 0, type: 'hover' }],
  };
}

describe('validateBundle', () => {
  it('valid bundle returns { valid: true, errors: [] }', () => {
    const result = validateBundle(validBundle());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts JSON string input', () => {
    const result = validateBundle(JSON.stringify(validBundle()));
    expect(result.valid).toBe(true);
  });

  it('reports invalid JSON string', () => {
    const result = validateBundle('not json!!!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid JSON string.');
  });

  it('reports missing version', () => {
    const b = validBundle();
    (b as any).version = undefined;
    const result = validateBundle(b);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing "version" field.');
  });

  it('reports missing scene', () => {
    const b = validBundle();
    (b as any).scene = undefined;
    const result = validateBundle(b);
    expect(result.errors).toContain('Missing "scene" field.');
  });

  it('reports missing scene.viewBox', () => {
    const b = validBundle();
    (b.scene as any).viewBox = undefined;
    const result = validateBundle(b);
    expect(result.errors).toContain('Missing "scene.viewBox".');
  });

  it('reports scene with no svg and no paths', () => {
    const b = validBundle();
    (b.scene as any).svg = undefined;
    b.scene.paths = [];
    const result = validateBundle(b);
    expect(result.errors).toContain('Scene must have either "svg" or "paths".');
  });

  it('reports missing actors', () => {
    const b = validBundle();
    (b as any).actors = undefined;
    const result = validateBundle(b);
    expect(result.errors.some((e) => e.includes('actors'))).toBe(true);
  });

  it('reports actor missing id', () => {
    const b = validBundle();
    (b.actors[0] as any).id = undefined;
    const result = validateBundle(b);
    expect(result.errors.some((e) => e.includes('Actor[0]') && e.includes('id'))).toBe(true);
  });

  it('reports actor missing pathIds', () => {
    const b = validBundle();
    b.actors[0].pathIds = [];
    const result = validateBundle(b);
    expect(result.errors.some((e) => e.includes('Actor[0]') && e.includes('pathIds'))).toBe(true);
  });

  it('reports actor missing origin', () => {
    const b = validBundle();
    (b.actors[0] as any).origin = undefined;
    const result = validateBundle(b);
    expect(result.errors.some((e) => e.includes('Actor[0]') && e.includes('origin'))).toBe(true);
  });

  it('reports missing timelines', () => {
    const b = validBundle();
    (b as any).timelines = undefined;
    const result = validateBundle(b);
    expect(result.errors.some((e) => e.includes('timelines'))).toBe(true);
  });

  it('reports timeline missing actorId', () => {
    const b = validBundle();
    (b.timelines[0] as any).actorId = undefined;
    const result = validateBundle(b);
    expect(result.errors.some((e) => e.includes('Timeline[0]') && e.includes('actorId'))).toBe(true);
  });

  it('reports timeline with no keyframes', () => {
    const b = validBundle();
    b.timelines[0].keyframes = [];
    const result = validateBundle(b);
    expect(result.errors.some((e) => e.includes('Timeline[0]') && e.includes('keyframes'))).toBe(true);
  });

  it('reports keyframe missing at', () => {
    const b = validBundle();
    (b.timelines[0].keyframes[0] as any).at = undefined;
    const result = validateBundle(b);
    expect(result.errors.some((e) => e.includes('keyframes[0]') && e.includes('"at"'))).toBe(true);
  });

  it('reports triggers not being an array', () => {
    const b = validBundle();
    (b as any).triggers = 'not an array';
    const result = validateBundle(b);
    expect(result.errors).toContain('"triggers" must be an array.');
  });

  it('reports variants not being an array', () => {
    const b = validBundle();
    (b as any).variants = 'not array';
    const result = validateBundle(b);
    expect(result.errors).toContain('"variants" must be an array.');
  });

  it('reports duplicate variant names', () => {
    const b = validBundle();
    b.variants = [
      { name: 'idle', timelineIndices: [0], triggerIndices: [0] },
      { name: 'idle', timelineIndices: [0], triggerIndices: [0] },
    ];
    const result = validateBundle(b);
    expect(result.errors.some((e) => e.includes('duplicate name'))).toBe(true);
  });

  it('reports variant referencing unknown actor', () => {
    const b = validBundle();
    b.variants = [
      { name: 'v1', actorIds: ['nonexistent'], timelineIndices: [0], triggerIndices: [0] },
    ];
    const result = validateBundle(b);
    expect(result.errors.some((e) => e.includes('unknown actor'))).toBe(true);
  });

  it('reports variant timeline index out of range', () => {
    const b = validBundle();
    b.variants = [
      { name: 'v1', timelineIndices: [99], triggerIndices: [0] },
    ];
    const result = validateBundle(b);
    expect(result.errors.some((e) => e.includes('timelineIndex') && e.includes('out of range'))).toBe(true);
  });

  it('reports variant trigger index out of range', () => {
    const b = validBundle();
    b.variants = [
      { name: 'v1', timelineIndices: [0], triggerIndices: [99] },
    ];
    const result = validateBundle(b);
    expect(result.errors.some((e) => e.includes('triggerIndex') && e.includes('out of range'))).toBe(true);
  });

  it('reports variant missing name', () => {
    const b = validBundle();
    b.variants = [{ name: '', timelineIndices: [0], triggerIndices: [0] }];
    const result = validateBundle(b);
    expect(result.errors.some((e) => e.includes('Variant[0]') && e.includes('name'))).toBe(true);
  });
});
