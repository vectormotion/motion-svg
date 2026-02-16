import { describe, it, expect } from 'vitest';
import { importBundle, getVariant } from '../../src/bundle/importBundle';

const minimalBundle = JSON.stringify({
  version: '1.0',
  scene: {
    viewBox: { x: 0, y: 0, w: 100, h: 100 },
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path id="p1" d="M0,0 L10,10" fill="#FF0000"/></svg>',
    paths: [{ id: 'p1', d: 'M0,0 L10,10', fill: '#FF0000' }],
    colors: { p1: '#FF0000' },
  },
  actors: [{ id: 'a1', pathIds: ['p1'], origin: { x: 50, y: 50 } }],
  timelines: [
    { actorId: 'a1', keyframes: [{ at: 0, scale: 1 }, { at: 1000, scale: 2, curve: 'linear' }] },
  ],
  triggers: [{ timelineIdx: 0, type: 'hover', reverse: true }],
});

const variantBundle = JSON.stringify({
  version: '1.1',
  scene: {
    viewBox: { x: 0, y: 0, w: 100, h: 100 },
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path id="p1" d="M0,0 L10,10" fill="#FF0000"/><path id="p2" d="M5,5 L15,15" fill="#0000FF"/></svg>',
    paths: [
      { id: 'p1', d: 'M0,0 L10,10', fill: '#FF0000' },
      { id: 'p2', d: 'M5,5 L15,15', fill: '#0000FF' },
    ],
    colors: { p1: '#FF0000', p2: '#0000FF' },
  },
  actors: [
    { id: 'a1', pathIds: ['p1'], origin: { x: 50, y: 50 } },
    { id: 'a2', pathIds: ['p2'], origin: { x: 25, y: 25 } },
  ],
  timelines: [
    { actorId: 'a1', keyframes: [{ at: 0, scale: 1 }, { at: 500, scale: 2 }] },
    { actorId: 'a2', keyframes: [{ at: 0, opacity: 1 }, { at: 500, opacity: 0 }] },
  ],
  triggers: [
    { timelineIdx: 0, type: 'hover' },
    { timelineIdx: 1, type: 'loop', iterations: 3 },
  ],
  variants: [
    { name: 'idle', actorIds: ['a1'], timelineIndices: [0], triggerIndices: [0] },
    { name: 'active', timelineIndices: [0, 1], triggerIndices: [0, 1] },
  ],
});

describe('importBundle', () => {
  it('parses a minimal bundle', () => {
    const result = importBundle(minimalBundle);
    expect(result.actors).toHaveLength(1);
    expect(result.actors[0].id).toBe('a1');
    expect(result.timelines).toHaveLength(1);
    expect(result.triggers).toHaveLength(1);
  });

  it('reconstructs scene with viewBox and paths', () => {
    const result = importBundle(minimalBundle);
    expect(result.scene.viewBox).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(result.scene.paths).toHaveLength(1);
    expect(result.scene.paths[0].id).toBe('p1');
  });

  it('reconstructs actors with origin and paths', () => {
    const result = importBundle(minimalBundle);
    const a = result.actors[0];
    expect(a.origin).toEqual({ x: 50, y: 50 });
    expect(a.pathIds).toContain('p1');
    expect(a.paths).toHaveLength(1);
  });

  it('reconstructs timelines with sorted keyframes and duration', () => {
    const result = importBundle(minimalBundle);
    const tl = result.timelines[0];
    expect(tl.actorId).toBe('a1');
    expect(tl.keyframes).toHaveLength(2);
    expect(tl.duration).toBe(1000);
  });

  it('reconstructs triggers from bundle triggers', () => {
    const result = importBundle(minimalBundle);
    const tr = result.triggers[0];
    expect(tr.config.type).toBe('hover');
    if (tr.config.type === 'hover') expect(tr.config.reverse).toBe(true);
  });

  it('throws on missing version', () => {
    expect(() => importBundle(JSON.stringify({ scene: {}, actors: [], timelines: [] }))).toThrow('missing "version"');
  });

  it('throws on invalid JSON', () => {
    expect(() => importBundle('not json')).toThrow();
  });

  it('imports variants', () => {
    const result = importBundle(variantBundle);
    expect(result.variants).toHaveLength(2);
    expect(result.variants[0].name).toBe('idle');
    expect(result.variants[1].name).toBe('active');
  });

  it('preserves raw bundle', () => {
    const result = importBundle(minimalBundle);
    expect(result.bundle.version).toBe('1.0');
  });
});

describe('getVariant', () => {
  it('returns filtered actors/timelines/triggers for named variant', () => {
    const imported = importBundle(variantBundle);
    const idle = getVariant(imported, 'idle');
    expect(idle).not.toBeNull();
    expect(idle!.actors).toHaveLength(1);
    expect(idle!.actors[0].id).toBe('a1');
    expect(idle!.timelines).toHaveLength(1);
    expect(idle!.triggers).toHaveLength(1);
  });

  it('returns all actors when variant has no actorIds filter', () => {
    const imported = importBundle(variantBundle);
    const active = getVariant(imported, 'active');
    expect(active).not.toBeNull();
    expect(active!.actors).toHaveLength(2); // all actors
    expect(active!.timelines).toHaveLength(2);
  });

  it('returns null for unknown variant', () => {
    const imported = importBundle(variantBundle);
    expect(getVariant(imported, 'nonexistent')).toBeNull();
  });
});
