import { describe, it, expect } from 'vitest';
import { interpolateKeyframes, getActorStateAtTime, lerpGradientDef } from '../../src/timeline/interpolate';
import type { Keyframe, Timeline, GradientDef } from '../../src/types';

describe('interpolateKeyframes', () => {
  const keyframes: Keyframe[] = [
    { at: 0, position: { x: 0, y: 0 }, scale: 1, opacity: 1, rotation: 0 },
    { at: 1000, position: { x: 100, y: 50 }, scale: 2, opacity: 0.5, rotation: 180, curve: 'linear' },
  ];

  it('returns initial state at t=0', () => {
    const state = interpolateKeyframes(keyframes, 0);
    expect(state.position).toEqual({ x: 0, y: 0 });
    expect(state.scale).toBe(1);
    expect(state.opacity).toBe(1);
    expect(state.rotation).toBe(0);
  });

  it('returns final state at t=duration', () => {
    const state = interpolateKeyframes(keyframes, 1000);
    expect(state.position).toEqual({ x: 100, y: 50 });
    expect(state.scale).toBe(2);
    expect(state.opacity).toBe(0.5);
    expect(state.rotation).toBe(180);
  });

  it('interpolates linearly at midpoint', () => {
    const state = interpolateKeyframes(keyframes, 500);
    expect(state.position.x).toBeCloseTo(50, 1);
    expect(state.position.y).toBeCloseTo(25, 1);
    expect(state.scale).toBeCloseTo(1.5, 2);
    expect(state.opacity).toBeCloseTo(0.75, 2);
    expect(state.rotation).toBeCloseTo(90, 1);
  });

  it('returns default state for empty keyframes', () => {
    const state = interpolateKeyframes([], 500);
    expect(state.position).toEqual({ x: 0, y: 0 });
    expect(state.scale).toBe(1);
    expect(state.rotation).toBe(0);
    expect(state.opacity).toBe(1);
  });

  it('holds first value before first keyframe time', () => {
    const kfs: Keyframe[] = [
      { at: 500, position: { x: 10, y: 10 }, scale: 2, rotation: 0, opacity: 1 },
      { at: 1000, position: { x: 100, y: 100 }, scale: 1, rotation: 0, opacity: 1, curve: 'linear' },
    ];
    const state = interpolateKeyframes(kfs, 0);
    // Before t=500, should hold at first keyframe value
    expect(state.position).toEqual({ x: 10, y: 10 });
    expect(state.scale).toBe(2);
  });

  it('holds last value after last keyframe time', () => {
    const state = interpolateKeyframes(keyframes, 2000);
    expect(state.position).toEqual({ x: 100, y: 50 });
    expect(state.scale).toBe(2);
  });
});

describe('per-property independence', () => {
  it('fill-only keyframe does not hold position', () => {
    const kfs: Keyframe[] = [
      { at: 0, position: { x: 0, y: 0 }, fill: '#FF0000' },
      { at: 500, fill: '#00FF00' },
      { at: 1000, position: { x: 100, y: 0 }, fill: '#0000FF', curve: 'linear' },
    ];
    const state = interpolateKeyframes(kfs, 500);
    // Position interpolates between t=0 and t=1000 (the only two kfs that define position)
    expect(state.position.x).toBeCloseTo(50, 1);
  });

  it('position-only keyframe does not hold opacity', () => {
    const kfs: Keyframe[] = [
      { at: 0, opacity: 0, position: { x: 0, y: 0 } },
      { at: 500, position: { x: 50, y: 0 } },
      { at: 1000, opacity: 1, position: { x: 100, y: 0 }, curve: 'linear' },
    ];
    const state = interpolateKeyframes(kfs, 500);
    // Opacity interpolates between t=0 and t=1000
    expect(state.opacity).toBeCloseTo(0.5, 1);
  });
});

describe('scale interpolation', () => {
  it('interpolates uniform scale (number)', () => {
    const kfs: Keyframe[] = [
      { at: 0, scale: 1 },
      { at: 1000, scale: 3, curve: 'linear' },
    ];
    const state = interpolateKeyframes(kfs, 500);
    expect(state.scale).toBeCloseTo(2, 2);
  });

  it('interpolates non-uniform scale (Point)', () => {
    const kfs: Keyframe[] = [
      { at: 0, scale: { x: 1, y: 1 } },
      { at: 1000, scale: { x: 2, y: 4 }, curve: 'linear' },
    ];
    const state = interpolateKeyframes(kfs, 500);
    const s = state.scale as { x: number; y: number };
    expect(s.x).toBeCloseTo(1.5, 2);
    expect(s.y).toBeCloseTo(2.5, 2);
  });

  it('interpolates number → Point scale', () => {
    const kfs: Keyframe[] = [
      { at: 0, scale: 1 },
      { at: 1000, scale: { x: 2, y: 4 }, curve: 'linear' },
    ];
    const state = interpolateKeyframes(kfs, 500);
    // 1 → {x:2, y:4} at t=0.5 → {x:1.5, y:2.5}
    const s = state.scale as { x: number; y: number };
    expect(s.x).toBeCloseTo(1.5, 2);
    expect(s.y).toBeCloseTo(2.5, 2);
  });
});

describe('color interpolation', () => {
  it('interpolates hex colors (red → blue at midpoint → purple)', () => {
    const kfs: Keyframe[] = [
      { at: 0, fill: '#FF0000' },
      { at: 1000, fill: '#0000FF', curve: 'linear' },
    ];
    const state = interpolateKeyframes(kfs, 500);
    expect(state.fill).toMatch(/^#[0-9a-f]{6}$/i);
    // R=127, G=0, B=127 → #80007f or close
    const r = parseInt(state.fill!.substring(1, 3), 16);
    const b = parseInt(state.fill!.substring(5, 7), 16);
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(160);
    expect(b).toBeGreaterThan(100);
    expect(b).toBeLessThan(160);
  });

  it('supports shorthand hex (#F00)', () => {
    const kfs: Keyframe[] = [
      { at: 0, fill: '#F00' },
      { at: 1000, fill: '#00F', curve: 'linear' },
    ];
    const state = interpolateKeyframes(kfs, 500);
    expect(state.fill).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('snaps non-parseable colors', () => {
    const kfs: Keyframe[] = [
      { at: 0, fill: 'red' },
      { at: 1000, fill: 'blue', curve: 'linear' },
    ];
    const state = interpolateKeyframes(kfs, 250);
    expect(state.fill).toBe('red'); // t < 0.5 → snap to first
  });
});

describe('optional numeric properties', () => {
  it('interpolates strokeWidth', () => {
    const kfs: Keyframe[] = [
      { at: 0, strokeWidth: 1 },
      { at: 1000, strokeWidth: 5, curve: 'linear' },
    ];
    const state = interpolateKeyframes(kfs, 500);
    expect(state.strokeWidth).toBeCloseTo(3, 2);
  });

  it('interpolates blurRadius', () => {
    const kfs: Keyframe[] = [
      { at: 0, blurRadius: 0 },
      { at: 1000, blurRadius: 10, curve: 'linear' },
    ];
    const state = interpolateKeyframes(kfs, 500);
    expect(state.blurRadius).toBeCloseTo(5, 2);
  });

  it('returns undefined for never-defined optional properties', () => {
    const kfs: Keyframe[] = [
      { at: 0, position: { x: 0, y: 0 } },
      { at: 1000, position: { x: 100, y: 0 } },
    ];
    const state = interpolateKeyframes(kfs, 500);
    expect(state.strokeWidth).toBeUndefined();
    expect(state.blurRadius).toBeUndefined();
    expect(state.fill).toBeUndefined();
  });
});

describe('snap properties', () => {
  it('strokeAlign snaps to previous value (no interpolation)', () => {
    const kfs: Keyframe[] = [
      { at: 0, strokeAlign: 'center' },
      { at: 1000, strokeAlign: 'inside', curve: 'linear' },
    ];
    const stateAt250 = interpolateKeyframes(kfs, 250);
    expect(stateAt250.strokeAlign).toBe('center');
    const stateAt1000 = interpolateKeyframes(kfs, 1000);
    expect(stateAt1000.strokeAlign).toBe('inside');
  });
});

describe('easing application', () => {
  it('applies easing curve from target keyframe', () => {
    const kfs: Keyframe[] = [
      { at: 0, opacity: 0 },
      { at: 1000, opacity: 1, curve: 'easeInQuad' },
    ];
    const state = interpolateKeyframes(kfs, 500);
    // easeInQuad(0.5) = 0.25
    expect(state.opacity).toBeCloseTo(0.25, 2);
  });
});

describe('getActorStateAtTime', () => {
  it('delegates to interpolateKeyframes', () => {
    const tl: Timeline = {
      id: 'tl-1',
      actorId: 'a-1',
      keyframes: [
        { at: 0, scale: 1 },
        { at: 1000, scale: 2, curve: 'linear' },
      ],
      duration: 1000,
    };
    const state = getActorStateAtTime(tl, 500);
    expect(state.scale).toBeCloseTo(1.5, 2);
  });
});

describe('lerpGradientDef', () => {
  const gradA: GradientDef = {
    type: 'linear',
    id: 'gA',
    x1: 0, y1: 0, x2: 1, y2: 0,
    stops: [
      { offset: 0, color: '#FF0000' },
      { offset: 1, color: '#FF0000' },
    ],
  };

  const gradB: GradientDef = {
    type: 'linear',
    id: 'gB',
    x1: 0, y1: 0, x2: 0, y2: 1,
    stops: [
      { offset: 0, color: '#0000FF' },
      { offset: 1, color: '#0000FF' },
    ],
  };

  it('returns source at t=0', () => {
    const result = lerpGradientDef(gradA, gradB, 0);
    expect(result.type).toBe('linear');
    const r = parseInt(result.stops[0].color.substring(1, 3), 16);
    expect(r).toBeGreaterThan(200); // close to 255
  });

  it('returns target at t=1', () => {
    const result = lerpGradientDef(gradA, gradB, 1);
    const b = parseInt(result.stops[0].color.substring(5, 7), 16);
    expect(b).toBeGreaterThan(200); // close to 255
  });

  it('interpolates stop colors at t=0.5', () => {
    const result = lerpGradientDef(gradA, gradB, 0.5);
    const r = parseInt(result.stops[0].color.substring(1, 3), 16);
    const b = parseInt(result.stops[0].color.substring(5, 7), 16);
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(160);
    expect(b).toBeGreaterThan(100);
    expect(b).toBeLessThan(160);
  });

  it('interpolates linear geometry with angular interpolation', () => {
    // gradA = horizontal (0°), gradB = vertical (90°)
    // At t=0.5 the angle should be 45° — a proper diagonal gradient
    const result = lerpGradientDef(gradA, gradB, 0.5);
    if (result.type === 'linear') {
      const dx = result.x2 - result.x1;
      const dy = result.y2 - result.y1;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      expect(angle).toBeCloseTo(45, 0); // 45° midpoint between 0° and 90°
      // Vector should have non-zero length (no degenerate collapse)
      expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThan(0.5);
    }
  });

  it('generates unique IDs', () => {
    const r1 = lerpGradientDef(gradA, gradB, 0.3);
    const r2 = lerpGradientDef(gradA, gradB, 0.7);
    expect(r1.id).not.toBe(r2.id);
  });

  it('handles radial ↔ radial', () => {
    const rA: GradientDef = {
      type: 'radial', id: 'rA', cx: 0.2, cy: 0.2, r: 0.3,
      stops: [{ offset: 0, color: '#FF0000' }, { offset: 1, color: '#00FF00' }],
    };
    const rB: GradientDef = {
      type: 'radial', id: 'rB', cx: 0.8, cy: 0.8, r: 0.7,
      stops: [{ offset: 0, color: '#0000FF' }, { offset: 1, color: '#FFFF00' }],
    };
    const result = lerpGradientDef(rA, rB, 0.5);
    expect(result.type).toBe('radial');
    if (result.type === 'radial') {
      expect(result.cx).toBeCloseTo(0.5, 2);
      expect(result.cy).toBeCloseTo(0.5, 2);
      expect(result.r).toBeCloseTo(0.5, 2);
    }
  });

  it('handles cross-type linear ↔ radial', () => {
    const radial: GradientDef = {
      type: 'radial', id: 'rC', cx: 0.5, cy: 0.5, r: 0.5,
      stops: [{ offset: 0, color: '#FFFFFF' }, { offset: 1, color: '#000000' }],
    };
    const at25 = lerpGradientDef(gradA, radial, 0.25);
    expect(at25.type).toBe('linear'); // stays as source type at t < 0.5
    const at75 = lerpGradientDef(gradA, radial, 0.75);
    expect(at75.type).toBe('radial'); // switches to target type at t >= 0.5
  });

  it('normalizes stop counts when mismatched', () => {
    const g3stops: GradientDef = {
      type: 'linear', id: 'g3', x1: 0, y1: 0, x2: 1, y2: 0,
      stops: [
        { offset: 0, color: '#FF0000' },
        { offset: 0.5, color: '#00FF00' },
        { offset: 1, color: '#0000FF' },
      ],
    };
    const result = lerpGradientDef(gradA, g3stops, 0.5);
    expect(result.stops.length).toBe(3);
  });
});
