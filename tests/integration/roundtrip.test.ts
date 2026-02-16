import { describe, it, expect } from 'vitest';
import { parseSvg } from '../../src/parser/parseSvg';
import { createActor } from '../../src/actor/createActor';
import { timeline } from '../../src/timeline/timeline';
import { trigger } from '../../src/trigger/trigger';
import { exportBundle } from '../../src/bundle/exportBundle';
import { importBundle } from '../../src/bundle/importBundle';
import { validateBundle } from '../../src/bundle/validate';
import type { BundleVariant } from '../../src/types';

const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path id="p1" d="M10,10 L90,10 L90,90 Z" fill="#FF0000" />
  <path id="p2" d="M50,10 A40,40 0 1,1 49.99,10" fill="#0000FF" />
</svg>`;

describe('Bundle round-trip', () => {
  it('parse → actor → timeline → trigger → export → validate → import preserves structure', () => {
    const scene = parseSvg(svgString);
    expect(scene.paths.length).toBeGreaterThanOrEqual(2);

    const actor = createActor({
      id: 'hero',
      paths: [scene.paths[0]],
      origin: { x: 50, y: 50 },
    });

    const tl = timeline(actor, {
      keyframes: [
        { at: 0, scale: 1 },
        { at: 500, scale: 2, curve: 'easeOutBack' },
        { at: 1000, scale: 1, curve: 'easeInOutCubic' },
      ],
    });

    const tr = trigger(tl, { type: 'hover', reverse: true });

    const json = exportBundle({
      scene,
      actors: [actor],
      timelines: [tl],
      triggers: [tr],
    });

    // Validate
    const validation = validateBundle(json);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Import
    const imported = importBundle(json);
    expect(imported.actors).toHaveLength(1);
    expect(imported.actors[0].id).toBe('hero');
    expect(imported.timelines).toHaveLength(1);
    expect(imported.timelines[0].keyframes).toHaveLength(3);
    expect(imported.timelines[0].duration).toBe(1000);
    expect(imported.triggers).toHaveLength(1);
    expect(imported.triggers[0].config.type).toBe('hover');
  });

  it('round-trip preserves keyframe curves', () => {
    const scene = parseSvg(svgString);
    const actor = createActor({ id: 'a', paths: [scene.paths[0]], origin: { x: 0, y: 0 } });
    const tl = timeline(actor, {
      keyframes: [
        { at: 0, opacity: 1 },
        { at: 500, opacity: 0.5, curve: 'easeInElastic' },
        { at: 1000, opacity: 0, curve: { type: 'cubicBezier', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } },
      ],
    });

    const json = exportBundle({ scene, actors: [actor], timelines: [tl] });
    const imported = importBundle(json);

    expect(imported.timelines[0].keyframes[1].curve).toBe('easeInElastic');
    const lastCurve = imported.timelines[0].keyframes[2].curve;
    expect(lastCurve).toBeDefined();
    expect(typeof lastCurve).toBe('object');
    if (typeof lastCurve === 'object') {
      expect(lastCurve.x1).toBe(0.25);
    }
  });

  it('round-trip preserves all trigger types', () => {
    const scene = parseSvg(svgString);
    const actor = createActor({ id: 'a', paths: [scene.paths[0]], origin: { x: 0, y: 0 } });
    const tl = timeline(actor, { keyframes: [{ at: 0 }, { at: 1000 }] });

    const triggers = [
      trigger(tl, { type: 'hover', reverse: true }),
      trigger(tl, { type: 'click', toggle: true }),
      trigger(tl, { type: 'loop', iterations: 5, direction: 'alternate', delay: 200 }),
      trigger(tl, { type: 'scroll', start: 0.1, end: 0.9 }),
      trigger(tl, { type: 'appear', threshold: 0.5, once: true }),
      trigger(tl, { type: 'manual' }),
    ];

    const json = exportBundle({ scene, actors: [actor], timelines: [tl], triggers });
    const imported = importBundle(json);

    expect(imported.triggers).toHaveLength(6);
    expect(imported.triggers[0].config.type).toBe('hover');
    expect(imported.triggers[1].config.type).toBe('click');
    expect(imported.triggers[2].config.type).toBe('loop');
    expect(imported.triggers[3].config.type).toBe('scroll');
    expect(imported.triggers[4].config.type).toBe('appear');
    expect(imported.triggers[5].config.type).toBe('manual');

    // Loop-specific fields
    const loopCfg = imported.triggers[2].config;
    if (loopCfg.type === 'loop') {
      expect(loopCfg.iterations).toBe(5);
      expect(loopCfg.direction).toBe('alternate');
      expect(loopCfg.delay).toBe(200);
    }
  });
});

describe('Bundle round-trip with variants', () => {
  it('preserves variant definitions', () => {
    const scene = parseSvg(svgString);
    const a1 = createActor({ id: 'a1', paths: [scene.paths[0]], origin: { x: 0, y: 0 } });
    const a2 = createActor({ id: 'a2', paths: [scene.paths[1]], origin: { x: 50, y: 50 } });
    const tl1 = timeline(a1, { keyframes: [{ at: 0 }, { at: 500 }] });
    const tl2 = timeline(a2, { keyframes: [{ at: 0 }, { at: 800 }] });
    const tr1 = trigger(tl1, { type: 'hover' });
    const tr2 = trigger(tl2, { type: 'loop', iterations: Infinity });

    const variants: BundleVariant[] = [
      { name: 'idle', actorIds: ['a1'], timelineIndices: [0], triggerIndices: [0] },
      { name: 'active', timelineIndices: [0, 1], triggerIndices: [0, 1] },
    ];

    const json = exportBundle({
      scene, actors: [a1, a2], timelines: [tl1, tl2], triggers: [tr1, tr2], variants,
    });

    const validation = validateBundle(json);
    expect(validation.valid).toBe(true);

    const imported = importBundle(json);
    expect(imported.variants).toHaveLength(2);
    expect(imported.variants[0].name).toBe('idle');
    expect(imported.variants[0].actorIds).toEqual(['a1']);
    expect(imported.variants[1].name).toBe('active');
    expect(imported.variants[1].timelineIndices).toEqual([0, 1]);
  });
});
