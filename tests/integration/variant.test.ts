import { describe, it, expect } from 'vitest';
import { parseSvg } from '../../src/parser/parseSvg';
import { createActor } from '../../src/actor/createActor';
import { timeline } from '../../src/timeline/timeline';
import { trigger } from '../../src/trigger/trigger';
import { exportBundle } from '../../src/bundle/exportBundle';
import { importBundle, getVariant } from '../../src/bundle/importBundle';
import type { BundleVariant } from '../../src/types';

const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path id="p1" d="M0,0 L50,0 L50,50 Z" fill="#FF0000" />
  <path id="p2" d="M60,0 L110,0 L110,50 Z" fill="#00FF00" />
  <path id="p3" d="M120,0 L170,0 L170,50 Z" fill="#0000FF" />
</svg>`;

describe('Variant filtering end-to-end', () => {
  function buildBundle() {
    const scene = parseSvg(svgString);
    const a1 = createActor({ id: 'card1', paths: [scene.paths[0]], origin: { x: 25, y: 25 } });
    const a2 = createActor({ id: 'card2', paths: [scene.paths[1]], origin: { x: 85, y: 25 } });
    const a3 = createActor({ id: 'card3', paths: [scene.paths[2]], origin: { x: 145, y: 25 } });

    const tl1 = timeline(a1, { keyframes: [{ at: 0, opacity: 0 }, { at: 300, opacity: 1 }] });
    const tl2 = timeline(a2, { keyframes: [{ at: 0, scale: 0.5 }, { at: 500, scale: 1 }] });
    const tl3 = timeline(a3, { keyframes: [{ at: 0, rotation: 0 }, { at: 700, rotation: 360 }] });

    const tr1 = trigger(tl1, { type: 'appear', threshold: 0.5 });
    const tr2 = trigger(tl2, { type: 'hover' });
    const tr3 = trigger(tl3, { type: 'loop', iterations: Infinity, direction: 'normal' });

    const variants: BundleVariant[] = [
      { name: 'minimal', actorIds: ['card1'], timelineIndices: [0], triggerIndices: [0] },
      { name: 'pair', actorIds: ['card1', 'card2'], timelineIndices: [0, 1], triggerIndices: [0, 1] },
      { name: 'all', timelineIndices: [0, 1, 2], triggerIndices: [0, 1, 2] },
    ];

    return exportBundle({
      scene, actors: [a1, a2, a3], timelines: [tl1, tl2, tl3], triggers: [tr1, tr2, tr3], variants,
    });
  }

  it('minimal variant returns only card1', () => {
    const imported = importBundle(buildBundle());
    const v = getVariant(imported, 'minimal');
    expect(v).not.toBeNull();
    expect(v!.actors).toHaveLength(1);
    expect(v!.actors[0].id).toBe('card1');
    expect(v!.timelines).toHaveLength(1);
    expect(v!.triggers).toHaveLength(1);
    expect(v!.triggers[0].config.type).toBe('appear');
  });

  it('pair variant returns card1 and card2', () => {
    const imported = importBundle(buildBundle());
    const v = getVariant(imported, 'pair');
    expect(v).not.toBeNull();
    expect(v!.actors).toHaveLength(2);
    expect(v!.actors.map((a) => a.id)).toEqual(['card1', 'card2']);
    expect(v!.timelines).toHaveLength(2);
    expect(v!.triggers).toHaveLength(2);
  });

  it('all variant returns all actors (no actorIds filter)', () => {
    const imported = importBundle(buildBundle());
    const v = getVariant(imported, 'all');
    expect(v).not.toBeNull();
    expect(v!.actors).toHaveLength(3);
    expect(v!.timelines).toHaveLength(3);
    expect(v!.triggers).toHaveLength(3);
  });

  it('nonexistent variant returns null', () => {
    const imported = importBundle(buildBundle());
    expect(getVariant(imported, 'missing')).toBeNull();
  });
});
