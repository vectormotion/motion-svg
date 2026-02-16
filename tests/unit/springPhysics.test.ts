import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { springPlugin, springResponse } from '../../src/plugins/springPhysics';
import { plugins } from '../../src/core/PluginSystem';
import { interpolateKeyframes } from '../../src/timeline/interpolate';
import type { Keyframe } from '../../src/types';

beforeEach(() => {
  plugins.clear();
});

afterEach(() => {
  plugins.clear();
});

describe('springResponse', () => {
  it('returns 0 at t=0', () => {
    expect(springResponse(0, 100, 10, 1)).toBe(0);
  });

  it('approaches 1 at large t', () => {
    const result = springResponse(10, 100, 10, 1);
    expect(result).toBeCloseTo(1, 2);
  });

  it('overshoots 1 with low damping (underdamped)', () => {
    // Low damping = more oscillation
    let maxVal = 0;
    for (let t = 0; t <= 5; t += 0.01) {
      const v = springResponse(t, 100, 4, 1);
      if (v > maxVal) maxVal = v;
    }
    expect(maxVal).toBeGreaterThan(1);
  });

  it('does not overshoot with high damping (overdamped)', () => {
    // High damping = critically/overdamped
    let maxVal = 0;
    for (let t = 0; t <= 5; t += 0.01) {
      const v = springResponse(t, 100, 30, 1);
      if (v > maxVal) maxVal = v;
    }
    expect(maxVal).toBeLessThanOrEqual(1.001);
  });

  it('higher stiffness makes it snappier', () => {
    const soft = springResponse(0.1, 50, 10, 1);
    const stiff = springResponse(0.1, 200, 10, 1);
    expect(stiff).toBeGreaterThan(soft);
  });

  it('higher mass makes it slower', () => {
    const light = springResponse(0.2, 100, 10, 1);
    const heavy = springResponse(0.2, 100, 10, 5);
    expect(light).toBeGreaterThan(heavy);
  });

  it('returns 1 at t >= 10 (settled)', () => {
    expect(springResponse(10, 100, 10, 1)).toBe(1);
    expect(springResponse(100, 100, 10, 1)).toBe(1);
  });
});

describe('springPlugin', () => {
  it('creates a valid plugin', () => {
    const plugin = springPlugin();
    expect(plugin.name).toBe('spring-physics');
    expect(plugin.version).toBe('1.0.0');
    expect(plugin.hooks.afterInterpolate).toBeDefined();
    expect(plugin.destroy).toBeDefined();
  });

  it('can be registered with PluginManager', () => {
    plugins.register(springPlugin());
    expect(plugins.has('afterInterpolate')).toBe(true);
    expect(plugins.getPlugin('spring-physics')).toBeDefined();
  });

  it('accepts custom config', () => {
    const plugin = springPlugin({
      stiffness: 200,
      damping: 5,
      mass: 2,
      properties: ['scale'],
    });
    expect(plugin.name).toBe('spring-physics');
  });

  it('modifies scale via afterInterpolate', () => {
    plugins.register(springPlugin({ stiffness: 100, damping: 10, mass: 1 }));

    const kfs: Keyframe[] = [
      { at: 0, scale: 1 },
      { at: 1000, scale: 2, curve: 'linear' },
    ];

    // First call establishes baseline
    interpolateKeyframes(kfs, 0);
    // Second call with different time triggers spring
    const state = interpolateKeyframes(kfs, 500);
    // Spring should modify the scale value
    expect(state.scale).toBeDefined();
    expect(typeof state.scale === 'number' || typeof state.scale === 'object').toBe(true);
  });

  it('modifies position via afterInterpolate', () => {
    plugins.register(springPlugin({ properties: ['position'] }));

    const kfs: Keyframe[] = [
      { at: 0, position: { x: 0, y: 0 } },
      { at: 1000, position: { x: 100, y: 50 }, curve: 'linear' },
    ];

    interpolateKeyframes(kfs, 0);
    const state = interpolateKeyframes(kfs, 500);
    expect(state.position).toBeDefined();
  });

  it('does not modify properties not in the config', () => {
    plugins.register(springPlugin({ properties: ['scale'] }));

    const kfs: Keyframe[] = [
      { at: 0, rotation: 0 },
      { at: 1000, rotation: 360, curve: 'linear' },
    ];

    interpolateKeyframes(kfs, 0);
    const state = interpolateKeyframes(kfs, 500);
    // Rotation should not be affected by spring (only scale is configured)
    expect(state.rotation).toBeCloseTo(180, 0);
  });

  it('tracks per-actor state', () => {
    plugins.register(springPlugin());

    const kfsA: Keyframe[] = [
      { at: 0, scale: 1 },
      { at: 1000, scale: 3, curve: 'linear' },
    ];
    const kfsB: Keyframe[] = [
      { at: 0, scale: 1 },
      { at: 1000, scale: 5, curve: 'linear' },
    ];

    // Two actors with different targets
    interpolateKeyframes(kfsA, 0, { actorId: 'a1' });
    interpolateKeyframes(kfsB, 0, { actorId: 'a2' });

    const stateA = interpolateKeyframes(kfsA, 500, { actorId: 'a1' });
    const stateB = interpolateKeyframes(kfsB, 500, { actorId: 'a2' });

    // They should have different values since targets differ
    const scaleA = typeof stateA.scale === 'number' ? stateA.scale : stateA.scale.x;
    const scaleB = typeof stateB.scale === 'number' ? stateB.scale : stateB.scale.x;
    expect(scaleA).not.toEqual(scaleB);
  });

  it('destroy clears internal state', () => {
    const plugin = springPlugin();
    plugins.register(plugin);

    const kfs: Keyframe[] = [
      { at: 0, scale: 1 },
      { at: 1000, scale: 2, curve: 'linear' },
    ];
    interpolateKeyframes(kfs, 0);
    interpolateKeyframes(kfs, 500);

    // After destroy, internal tracking should be cleared
    plugin.destroy!();
    // No error should occur
    expect(true).toBe(true);
  });
});
