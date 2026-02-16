import { describe, it, expect } from 'vitest';
import { exportBundle } from '../../src/bundle/exportBundle';
import type { Scene, Actor, Timeline, TriggerBinding, BundleVariant, Bundle } from '../../src/types';

const mockScene: Scene = {
  viewBox: { x: 0, y: 0, w: 100, h: 100 },
  paths: [
    { id: 'p1', d: 'M0,0 L10,10', fill: '#FF0000' },
    { id: 'p2', d: 'M5,5 L15,15', fill: '#0000FF' },
  ],
  groups: [],
  colors: { p1: '#FF0000', p2: '#0000FF' },
  gradients: [],
  metadata: { xmlns: 'http://www.w3.org/2000/svg', originalSvg: '<svg></svg>' },
};

const mockActor: Actor = {
  id: 'a1', pathIds: ['p1'], paths: [mockScene.paths[0]],
  origin: { x: 50, y: 50 }, position: { x: 50, y: 50 },
  scale: 1, rotation: 0, opacity: 1, blurRadius: 0, backdropBlur: 0, z: 0,
};

const mockTimeline: Timeline = {
  id: 'tl-1', actorId: 'a1',
  keyframes: [
    { at: 0, scale: 1 },
    { at: 1000, scale: 2, curve: 'easeOutCubic' },
  ],
  duration: 1000,
};

const mockTrigger: TriggerBinding = {
  timelineId: 'tl-1',
  config: { type: 'hover', reverse: true },
};

describe('exportBundle', () => {
  it('produces valid JSON string', () => {
    const json = exportBundle({ scene: mockScene, actors: [mockActor], timelines: [mockTimeline] });
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('exports version 1.0 without variants', () => {
    const json = exportBundle({ scene: mockScene, actors: [mockActor], timelines: [mockTimeline] });
    const bundle: Bundle = JSON.parse(json);
    expect(bundle.version).toBe('1.0');
    expect(bundle.variants).toBeUndefined();
  });

  it('exports version 1.1 with variants', () => {
    const variants: BundleVariant[] = [
      { name: 'idle', timelineIndices: [0], triggerIndices: [] },
    ];
    const json = exportBundle({
      scene: mockScene, actors: [mockActor], timelines: [mockTimeline], variants,
    });
    const bundle: Bundle = JSON.parse(json);
    expect(bundle.version).toBe('1.1');
    expect(bundle.variants).toHaveLength(1);
    expect(bundle.variants![0].name).toBe('idle');
  });

  it('exports scene with viewBox and paths', () => {
    const json = exportBundle({ scene: mockScene, actors: [mockActor], timelines: [mockTimeline] });
    const bundle: Bundle = JSON.parse(json);
    expect(bundle.scene.viewBox).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(bundle.scene.paths).toHaveLength(2);
  });

  it('exports actors with id, pathIds, origin', () => {
    const json = exportBundle({ scene: mockScene, actors: [mockActor], timelines: [mockTimeline] });
    const bundle: Bundle = JSON.parse(json);
    expect(bundle.actors).toHaveLength(1);
    expect(bundle.actors[0].id).toBe('a1');
    expect(bundle.actors[0].pathIds).toEqual(['p1']);
    expect(bundle.actors[0].origin).toEqual({ x: 50, y: 50 });
  });

  it('exports timelines with actorId and keyframes', () => {
    const json = exportBundle({ scene: mockScene, actors: [mockActor], timelines: [mockTimeline] });
    const bundle: Bundle = JSON.parse(json);
    expect(bundle.timelines).toHaveLength(1);
    expect(bundle.timelines[0].actorId).toBe('a1');
    expect(bundle.timelines[0].keyframes).toHaveLength(2);
    expect(bundle.timelines[0].keyframes[1].curve).toBe('easeOutCubic');
  });

  it('exports triggers with type and timeline index', () => {
    const json = exportBundle({
      scene: mockScene, actors: [mockActor], timelines: [mockTimeline], triggers: [mockTrigger],
    });
    const bundle: Bundle = JSON.parse(json);
    expect(bundle.triggers).toHaveLength(1);
    expect(bundle.triggers[0].timelineIdx).toBe(0);
    expect(bundle.triggers[0].type).toBe('hover');
    expect(bundle.triggers[0].reverse).toBe(true);
  });

  it('exports loop trigger with all fields', () => {
    const tr: TriggerBinding = {
      timelineId: 'tl-1',
      config: { type: 'loop', iterations: 3, direction: 'alternate', delay: 500 },
    };
    const json = exportBundle({
      scene: mockScene, actors: [mockActor], timelines: [mockTimeline], triggers: [tr],
    });
    const bundle: Bundle = JSON.parse(json);
    expect(bundle.triggers[0].iterations).toBe(3);
    expect(bundle.triggers[0].direction).toBe('alternate');
    expect(bundle.triggers[0].delay).toBe(500);
  });

  it('omits undefined optional keyframe fields', () => {
    const json = exportBundle({ scene: mockScene, actors: [mockActor], timelines: [mockTimeline] });
    const bundle: Bundle = JSON.parse(json);
    const kf0 = bundle.timelines[0].keyframes[0];
    expect(kf0).not.toHaveProperty('fill');
    expect(kf0).not.toHaveProperty('stroke');
    expect(kf0).not.toHaveProperty('blurRadius');
  });

  it('exports shape actor fields', () => {
    const shapeActor: Actor = {
      ...mockActor, id: 'shape-1', shapeType: 'rect', width: 100, height: 50,
    };
    const json = exportBundle({ scene: mockScene, actors: [shapeActor], timelines: [mockTimeline] });
    const bundle: Bundle = JSON.parse(json);
    expect(bundle.actors[0].shapeType).toBe('rect');
    expect(bundle.actors[0].width).toBe(100);
    expect(bundle.actors[0].height).toBe(50);
  });
});
