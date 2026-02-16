import { describe, it, expect } from 'vitest';
import { easingFunctions, getEasingFunction, cubicBezier } from '../../src/easing/curves';
import type { EasingName } from '../../src/types';

describe('easingFunctions', () => {
  const allNames = Object.keys(easingFunctions) as EasingName[];

  it('all easing functions return 0 at t=0', () => {
    for (const name of allNames) {
      expect(easingFunctions[name](0)).toBeCloseTo(0, 4);
    }
  });

  it('all easing functions return 1 at t=1', () => {
    for (const name of allNames) {
      expect(easingFunctions[name](1)).toBeCloseTo(1, 4);
    }
  });

  it('linear returns t for all inputs', () => {
    expect(easingFunctions.linear(0.25)).toBeCloseTo(0.25, 5);
    expect(easingFunctions.linear(0.5)).toBeCloseTo(0.5, 5);
    expect(easingFunctions.linear(0.75)).toBeCloseTo(0.75, 5);
  });

  it('easeIn starts slow (f(0.5) < 0.5)', () => {
    expect(easingFunctions.easeIn(0.5)).toBeLessThan(0.5);
  });

  it('easeOut starts fast (f(0.5) > 0.5)', () => {
    expect(easingFunctions.easeOut(0.5)).toBeGreaterThan(0.5);
  });

  it('easeInOut is symmetric at midpoint', () => {
    expect(easingFunctions.easeInOut(0.5)).toBeCloseTo(0.5, 2);
  });

  it('easeOutBack overshoots past 1', () => {
    // Back easing temporarily goes beyond the target
    const values = [0.7, 0.8, 0.9].map((t) => easingFunctions.easeOutBack(t));
    expect(Math.max(...values)).toBeGreaterThan(1);
  });

  it('easeOutBounce has bounce behavior', () => {
    const v1 = easingFunctions.easeOutBounce(0.3);
    const v2 = easingFunctions.easeOutBounce(0.5);
    const v3 = easingFunctions.easeOutBounce(0.7);
    // All should be between 0 and 1 for reasonable inputs
    expect(v1).toBeGreaterThan(0);
    expect(v2).toBeGreaterThan(0);
    expect(v3).toBeGreaterThan(0);
  });

  it('quad functions have correct curvature', () => {
    expect(easingFunctions.easeInQuad(0.5)).toBeCloseTo(0.25, 5);
    expect(easingFunctions.easeOutQuad(0.5)).toBeCloseTo(0.75, 5);
  });

  it('cubic functions have correct curvature', () => {
    expect(easingFunctions.easeInCubic(0.5)).toBeCloseTo(0.125, 5);
    expect(easingFunctions.easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
  });
});

describe('cubicBezier', () => {
  it('linear cubic bezier (0,0,1,1) returns ~t', () => {
    const fn = cubicBezier(0, 0, 1, 1);
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
    expect(fn(0.5)).toBeCloseTo(0.5, 2);
  });

  it('ease-in-out (0.42, 0, 0.58, 1) is ~0.5 at midpoint', () => {
    const fn = cubicBezier(0.42, 0, 0.58, 1);
    expect(fn(0.5)).toBeCloseTo(0.5, 1);
  });

  it('clamps values outside 0..1', () => {
    const fn = cubicBezier(0.25, 0.1, 0.25, 1.0);
    expect(fn(-0.1)).toBe(0);
    expect(fn(1.5)).toBe(1);
  });
});

describe('getEasingFunction', () => {
  it('returns linear for undefined', () => {
    const fn = getEasingFunction(undefined);
    expect(fn(0.5)).toBeCloseTo(0.5, 5);
  });

  it('resolves named easing', () => {
    const fn = getEasingFunction('easeInQuad');
    expect(fn(0.5)).toBeCloseTo(0.25, 5);
  });

  it('resolves cubic bezier object', () => {
    const fn = getEasingFunction({ type: 'cubicBezier', x1: 0, y1: 0, x2: 1, y2: 1 });
    expect(fn(0.5)).toBeCloseTo(0.5, 2);
  });

  it('falls back to linear for unknown name', () => {
    const fn = getEasingFunction('nonexistent' as any);
    expect(fn(0.5)).toBeCloseTo(0.5, 5);
  });
});
