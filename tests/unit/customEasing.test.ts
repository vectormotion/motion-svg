import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  customEasingPlugin,
  steppedEasing,
  slowMotionEasing,
  elasticEasing,
  springEasing,
} from '../../src/plugins/customEasing';
import { plugins } from '../../src/core/PluginSystem';
import { easingFunctions, getEasingFunction } from '../../src/easing/curves';
import { interpolateKeyframes } from '../../src/timeline/interpolate';
import type { Keyframe } from '../../src/types';

beforeEach(() => {
  plugins.clear();
});

afterEach(() => {
  plugins.clear();
});

describe('customEasingPlugin', () => {
  it('creates a valid plugin', () => {
    const plugin = customEasingPlugin({
      easings: { myEase: (t) => t * t },
    });
    expect(plugin.name).toBe('custom-easing');
    expect(plugin.version).toBe('1.0.0');
  });

  it('injects custom easing into easingFunctions', () => {
    const myFn = (t: number) => t * t * t;
    plugins.register(customEasingPlugin({ easings: { cubicCustom: myFn } }));

    const resolved = getEasingFunction('cubicCustom' as any);
    expect(resolved(0.5)).toBeCloseTo(0.125);
  });

  it('works in the interpolation pipeline', () => {
    // Register a custom easing that always returns 1 (instant jump)
    plugins.register(customEasingPlugin({
      easings: { instantJump: () => 1 },
    }));

    const kfs: Keyframe[] = [
      { at: 0, opacity: 0 },
      { at: 1000, opacity: 1, curve: 'instantJump' as any },
    ];

    // At any time > 0, opacity should jump to 1
    const state = interpolateKeyframes(kfs, 100);
    expect(state.opacity).toBeCloseTo(1);
  });

  it('works with stepped easing in pipeline', () => {
    plugins.register(customEasingPlugin({
      easings: { stepped4: steppedEasing(4) },
    }));

    const kfs: Keyframe[] = [
      { at: 0, opacity: 0 },
      { at: 1000, opacity: 1, curve: 'stepped4' as any },
    ];

    // At 30% progress → step 1/4 = 0.25
    const state = interpolateKeyframes(kfs, 300);
    expect(state.opacity).toBeCloseTo(0.25);
  });

  it('removes custom easings on destroy', () => {
    const plugin = customEasingPlugin({
      easings: { tempEasing: (t) => t },
    });
    plugins.register(plugin);

    // Should be available
    expect(getEasingFunction('tempEasing' as any)(0.5)).toBeCloseTo(0.5);

    // Destroy
    plugin.destroy!();

    // Should fall back to linear (default for unknown)
    const resolved = getEasingFunction('tempEasing' as any);
    // getEasingFunction returns linear for unknown strings
    expect(resolved(0.5)).toBeCloseTo(0.5); // linear is also (t) => t
    // But verify the key is actually removed
    expect((easingFunctions as any)['tempEasing']).toBeUndefined();
  });

  it('registers multiple easings at once', () => {
    plugins.register(customEasingPlugin({
      easings: {
        ease1: (t) => t * t,
        ease2: (t) => 1 - (1 - t) * (1 - t),
        ease3: steppedEasing(3),
      },
    }));

    expect(getEasingFunction('ease1' as any)(0.5)).toBeCloseTo(0.25);
    expect(getEasingFunction('ease2' as any)(0.5)).toBeCloseTo(0.75);
    expect(getEasingFunction('ease3' as any)(0.5)).toBeCloseTo(0.333, 2);
  });
});

describe('preset easing functions', () => {
  describe('steppedEasing', () => {
    it('creates discrete steps', () => {
      const fn = steppedEasing(4);
      expect(fn(0)).toBe(0);
      expect(fn(0.24)).toBe(0);
      expect(fn(0.25)).toBe(0.25);
      expect(fn(0.49)).toBe(0.25);
      expect(fn(0.5)).toBe(0.5);
      expect(fn(0.74)).toBe(0.5);
      expect(fn(0.75)).toBe(0.75);
      expect(fn(0.99)).toBe(0.75);
    });

    it('works with different step counts', () => {
      const fn2 = steppedEasing(2);
      expect(fn2(0.3)).toBe(0);
      expect(fn2(0.5)).toBe(0.5);

      const fn10 = steppedEasing(10);
      expect(fn10(0.15)).toBeCloseTo(0.1);
      expect(fn10(0.85)).toBeCloseTo(0.8);
    });
  });

  describe('elasticEasing', () => {
    it('returns 0 at t=0 and 1 at t=1', () => {
      const fn = elasticEasing();
      expect(fn(0)).toBe(0);
      expect(fn(1)).toBe(1);
    });

    it('overshoots 1 during animation', () => {
      const fn = elasticEasing(1.5, 0.3);
      let max = 0;
      for (let t = 0; t <= 1; t += 0.01) {
        const v = fn(t);
        if (v > max) max = v;
      }
      expect(max).toBeGreaterThan(1);
    });
  });

  describe('springEasing', () => {
    it('returns 0 at t=0 and 1 at t=1', () => {
      const fn = springEasing();
      expect(fn(0)).toBeCloseTo(0);
      expect(fn(1)).toBeCloseTo(1);
    });

    it('overshoots with high overshoot value', () => {
      const fn = springEasing(3);
      let max = 0;
      for (let t = 0; t <= 1; t += 0.01) {
        const v = fn(t);
        if (v > max) max = v;
      }
      expect(max).toBeGreaterThan(1);
    });
  });

  describe('slowMotionEasing', () => {
    it('returns 0 at t=0', () => {
      const fn = slowMotionEasing();
      expect(fn(0)).toBeCloseTo(0);
    });

    it('returns value near 1 at t=1', () => {
      const fn = slowMotionEasing();
      // With default factor, should reach close to 1
      expect(fn(1)).toBeGreaterThan(0.8);
    });

    it('is slower in the middle section', () => {
      const fn = slowMotionEasing(0.2);
      const earlySpeed = fn(0.2) - fn(0);     // 0-0.2 range
      const midSpeed = fn(0.6) - fn(0.4);     // 0.4-0.6 range (middle)
      // Middle should progress slower than the beginning
      expect(midSpeed).toBeLessThan(earlySpeed);
    });
  });
});
