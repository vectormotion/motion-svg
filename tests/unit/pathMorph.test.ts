import { describe, it, expect } from 'vitest';
import {
  parsePathD,
  normalizeToCubic,
  balanceCommands,
  lerpPath,
} from '../../src/timeline/pathMorph';
import { interpolateKeyframes } from '../../src/timeline/interpolate';
import type { Keyframe } from '../../src/types';

// ── Helper: parse a d string back to coordinates for validation ──

function extractCoords(d: string): number[] {
  const nums = d.match(/-?\d+\.?\d*/g);
  return nums ? nums.map(Number) : [];
}

// ── parsePathD ──────────────────────────────────────────────────────────────

describe('parsePathD', () => {
  it('parses M and L commands', () => {
    const cmds = parsePathD('M 0,0 L 10,20');
    expect(cmds).toHaveLength(2);
    expect(cmds[0].type).toBe('M');
    expect(cmds[0].params).toEqual([0, 0]);
    expect(cmds[1].type).toBe('L');
    expect(cmds[1].params).toEqual([10, 20]);
  });

  it('parses C (cubic) commands', () => {
    const cmds = parsePathD('M0,0 C1,2 3,4 5,6');
    expect(cmds).toHaveLength(2);
    expect(cmds[1].type).toBe('C');
    expect(cmds[1].params).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('parses Q (quadratic) commands', () => {
    const cmds = parsePathD('M0,0 Q5,10 10,0');
    expect(cmds).toHaveLength(2);
    expect(cmds[1].type).toBe('Q');
    expect(cmds[1].params).toEqual([5, 10, 10, 0]);
  });

  it('parses H and V commands', () => {
    const cmds = parsePathD('M0,0 H10 V20');
    expect(cmds).toHaveLength(3);
    expect(cmds[1].type).toBe('H');
    expect(cmds[1].params).toEqual([10]);
    expect(cmds[2].type).toBe('V');
    expect(cmds[2].params).toEqual([20]);
  });

  it('parses Z (close) command', () => {
    const cmds = parsePathD('M0,0 L10,0 L10,10 Z');
    expect(cmds).toHaveLength(4);
    expect(cmds[3].type).toBe('Z');
  });

  it('converts relative commands to absolute', () => {
    const cmds = parsePathD('M10,10 l5,5');
    expect(cmds[1].type).toBe('L');
    expect(cmds[1].params).toEqual([15, 15]);
    expect(cmds[1].relative).toBe(false);
  });

  it('handles relative moveto', () => {
    const cmds = parsePathD('M10,20 m5,5 l3,3');
    expect(cmds[1].type).toBe('M');
    expect(cmds[1].params).toEqual([15, 25]);
    expect(cmds[2].type).toBe('L');
    expect(cmds[2].params).toEqual([18, 28]);
  });

  it('handles implicit L after M with multiple coords', () => {
    const cmds = parsePathD('M0,0 10,20 30,40');
    // First pair is M, rest are implicit L
    expect(cmds).toHaveLength(3);
    expect(cmds[0].type).toBe('M');
    expect(cmds[1].type).toBe('L');
    expect(cmds[1].params).toEqual([10, 20]);
    expect(cmds[2].type).toBe('L');
    expect(cmds[2].params).toEqual([30, 40]);
  });

  it('parses A (arc) commands', () => {
    const cmds = parsePathD('M10,80 A25,25 0 0,1 50,25');
    expect(cmds).toHaveLength(2);
    expect(cmds[1].type).toBe('A');
    expect(cmds[1].params).toEqual([25, 25, 0, 0, 1, 50, 25]);
  });

  it('parses S (smooth cubic) commands', () => {
    const cmds = parsePathD('M0,0 C1,2 3,4 5,6 S9,10 11,12');
    expect(cmds).toHaveLength(3);
    expect(cmds[2].type).toBe('S');
    expect(cmds[2].params).toEqual([9, 10, 11, 12]);
  });

  it('handles negative numbers', () => {
    const cmds = parsePathD('M-5,-10 L-20,-30');
    expect(cmds[0].params).toEqual([-5, -10]);
    expect(cmds[1].params).toEqual([-20, -30]);
  });

  it('handles compact notation (no spaces)', () => {
    const cmds = parsePathD('M0,0L10,10L20,0Z');
    expect(cmds).toHaveLength(4);
    expect(cmds[1].params).toEqual([10, 10]);
    expect(cmds[2].params).toEqual([20, 0]);
  });
});

// ── normalizeToCubic ────────────────────────────────────────────────────────

describe('normalizeToCubic', () => {
  it('converts L to cubic segment', () => {
    const cmds = parsePathD('M0,0 L10,0');
    const norm = normalizeToCubic(cmds);

    expect(norm.startX).toBe(0);
    expect(norm.startY).toBe(0);
    expect(norm.segments).toHaveLength(1);
    // End point should be (10, 0)
    expect(norm.segments[0].x).toBeCloseTo(10);
    expect(norm.segments[0].y).toBeCloseTo(0);
  });

  it('converts Q to cubic segment', () => {
    const cmds = parsePathD('M0,0 Q5,10 10,0');
    const norm = normalizeToCubic(cmds);

    expect(norm.segments).toHaveLength(1);
    expect(norm.segments[0].x).toBeCloseTo(10);
    expect(norm.segments[0].y).toBeCloseTo(0);
  });

  it('converts H and V to cubic segments', () => {
    const cmds = parsePathD('M0,0 H20 V10');
    const norm = normalizeToCubic(cmds);

    expect(norm.segments).toHaveLength(2);
    expect(norm.segments[0].x).toBeCloseTo(20);
    expect(norm.segments[0].y).toBeCloseTo(0);
    expect(norm.segments[1].x).toBeCloseTo(20);
    expect(norm.segments[1].y).toBeCloseTo(10);
  });

  it('preserves C commands', () => {
    const cmds = parsePathD('M0,0 C1,2 3,4 5,6');
    const norm = normalizeToCubic(cmds);

    expect(norm.segments).toHaveLength(1);
    expect(norm.segments[0]).toEqual({
      cx1: 1, cy1: 2, cx2: 3, cy2: 4, x: 5, y: 6,
    });
  });

  it('handles Z by closing with a line-to-cubic', () => {
    const cmds = parsePathD('M0,0 L10,0 L10,10 Z');
    const norm = normalizeToCubic(cmds);

    expect(norm.closed).toBe(true);
    // 2 L segments + 1 closing segment = 3
    expect(norm.segments).toHaveLength(3);
    // Last segment should end at start (0,0)
    expect(norm.segments[2].x).toBeCloseTo(0);
    expect(norm.segments[2].y).toBeCloseTo(0);
  });

  it('converts A (arc) to cubic segments', () => {
    const cmds = parsePathD('M10,80 A25,25 0 0,1 50,25');
    const norm = normalizeToCubic(cmds);

    expect(norm.segments.length).toBeGreaterThanOrEqual(1);
    // End point should be at (50, 25)
    const last = norm.segments[norm.segments.length - 1];
    expect(last.x).toBeCloseTo(50, 0);
    expect(last.y).toBeCloseTo(25, 0);
  });

  it('handles S (smooth cubic) commands', () => {
    const cmds = parsePathD('M0,0 C1,2 3,4 5,6 S9,10 11,12');
    const norm = normalizeToCubic(cmds);

    expect(norm.segments).toHaveLength(2);
    // S reflects the previous C's control point 2
    // Reflected: 2*5-3=7, 2*6-4=8
    expect(norm.segments[1].cx1).toBeCloseTo(7);
    expect(norm.segments[1].cy1).toBeCloseTo(8);
    expect(norm.segments[1].x).toBeCloseTo(11);
    expect(norm.segments[1].y).toBeCloseTo(12);
  });
});

// ── balanceCommands ─────────────────────────────────────────────────────────

describe('balanceCommands', () => {
  it('returns equal length when already equal', () => {
    const a = normalizeToCubic(parsePathD('M0,0 L10,0 L10,10'));
    const b = normalizeToCubic(parsePathD('M0,0 L5,5 L10,0'));

    const [ra, rb] = balanceCommands(a, b);
    expect(ra.segments.length).toBe(rb.segments.length);
    expect(ra.segments.length).toBe(2);
  });

  it('subdivides shorter path to match longer', () => {
    const a = normalizeToCubic(parsePathD('M0,0 L10,0'));      // 1 segment
    const b = normalizeToCubic(parsePathD('M0,0 L5,0 L10,0 L10,5')); // 3 segments

    const [ra, rb] = balanceCommands(a, b);
    expect(ra.segments.length).toBe(rb.segments.length);
    expect(ra.segments.length).toBe(3);
  });

  it('preserves start points', () => {
    const a = normalizeToCubic(parsePathD('M5,10 L15,10'));
    const b = normalizeToCubic(parsePathD('M0,0 L10,0 L20,0'));

    const [ra, rb] = balanceCommands(a, b);
    expect(ra.startX).toBe(5);
    expect(ra.startY).toBe(10);
    expect(rb.startX).toBe(0);
    expect(rb.startY).toBe(0);
  });

  it('preserves end points after subdivision', () => {
    const a = normalizeToCubic(parsePathD('M0,0 L100,0'));
    const b = normalizeToCubic(parsePathD('M0,0 L25,0 L50,0 L75,0 L100,0'));

    const [ra, _rb] = balanceCommands(a, b);
    const lastA = ra.segments[ra.segments.length - 1];
    expect(lastA.x).toBeCloseTo(100);
    expect(lastA.y).toBeCloseTo(0);
  });
});

// ── lerpPath ────────────────────────────────────────────────────────────────

describe('lerpPath', () => {
  const triangle = 'M0,0 L10,0 L5,10 Z';
  const square = 'M0,0 L10,0 L10,10 L0,10 Z';

  it('returns pathA at t=0', () => {
    expect(lerpPath(triangle, square, 0)).toBe(triangle);
  });

  it('returns pathB at t=1', () => {
    expect(lerpPath(triangle, square, 1)).toBe(square);
  });

  it('produces valid intermediate path at t=0.5', () => {
    const mid = lerpPath(triangle, square, 0.5);
    expect(mid).toMatch(/^M/);
    expect(mid).toContain('C');
    // Should have valid numbers
    const coords = extractCoords(mid);
    expect(coords.length).toBeGreaterThan(0);
    coords.forEach((n) => {
      expect(isFinite(n)).toBe(true);
    });
  });

  it('produces a closed path when both inputs are closed', () => {
    const mid = lerpPath(triangle, square, 0.5);
    expect(mid).toMatch(/Z$/);
  });

  it('does not add Z when inputs are open', () => {
    const a = 'M0,0 L10,0';
    const b = 'M0,0 L0,10';
    const mid = lerpPath(a, b, 0.5);
    expect(mid).not.toMatch(/Z$/);
  });

  it('handles paths with different segment counts', () => {
    const simple = 'M0,0 L10,10';           // 1 segment
    const complex = 'M0,0 L5,0 L10,5 L10,10'; // 3 segments

    const mid = lerpPath(simple, complex, 0.5);
    expect(mid).toMatch(/^M/);
    const coords = extractCoords(mid);
    expect(coords.length).toBeGreaterThan(0);
    coords.forEach((n) => expect(isFinite(n)).toBe(true));
  });

  it('interpolates start point', () => {
    const a = 'M0,0 L10,0';
    const b = 'M10,10 L20,10';
    const mid = lerpPath(a, b, 0.5);
    // Start point should be around (5, 5)
    expect(mid).toMatch(/^M5,5/);
  });

  it('handles cubic paths directly', () => {
    const a = 'M0,0 C1,2 3,4 5,6';
    const b = 'M0,0 C2,4 6,8 10,12';
    const mid = lerpPath(a, b, 0.5);
    const coords = extractCoords(mid);
    // Start: (0,0), then C with midpoint values
    expect(coords[0]).toBeCloseTo(0);
    expect(coords[1]).toBeCloseTo(0);
    // cx1 should be ~1.5, cy1 ~3
    expect(coords[2]).toBeCloseTo(1.5);
    expect(coords[3]).toBeCloseTo(3);
  });

  it('clamps t below 0', () => {
    const a = 'M0,0 L10,0';
    const b = 'M0,0 L0,10';
    expect(lerpPath(a, b, -0.5)).toBe(a);
  });

  it('clamps t above 1', () => {
    const a = 'M0,0 L10,0';
    const b = 'M0,0 L0,10';
    expect(lerpPath(a, b, 1.5)).toBe(b);
  });
});

// ── Integration with interpolation pipeline ─────────────────────────────────

describe('pathD in interpolation pipeline', () => {
  const kfs: Keyframe[] = [
    { at: 0, pathD: 'M0,0 L10,0 L10,10 Z', opacity: 1 },
    { at: 1000, pathD: 'M0,0 L20,0 L20,20 Z', opacity: 0.5, curve: 'linear' },
  ];

  it('returns pathD at start', () => {
    const state = interpolateKeyframes(kfs, 0);
    expect(state.pathD).toBe('M0,0 L10,0 L10,10 Z');
  });

  it('returns pathD at end', () => {
    const state = interpolateKeyframes(kfs, 1000);
    expect(state.pathD).toBe('M0,0 L20,0 L20,20 Z');
  });

  it('returns interpolated pathD at midpoint', () => {
    const state = interpolateKeyframes(kfs, 500);
    expect(state.pathD).toBeDefined();
    expect(state.pathD).toMatch(/^M/);
    // Should be intermediate values
    const coords = extractCoords(state.pathD!);
    expect(coords.length).toBeGreaterThan(0);
  });

  it('returns undefined pathD when no keyframes define it', () => {
    const noPath: Keyframe[] = [
      { at: 0, opacity: 1 },
      { at: 1000, opacity: 0 },
    ];
    const state = interpolateKeyframes(noPath, 500);
    expect(state.pathD).toBeUndefined();
  });

  it('composes pathD with other properties independently', () => {
    const state = interpolateKeyframes(kfs, 500);
    expect(state.pathD).toBeDefined();
    expect(state.opacity).toBeCloseTo(0.75); // linear interp
  });
});

// ── Performance ─────────────────────────────────────────────────────────────

describe('pathMorph performance', () => {
  it('handles path with ~50 segments efficiently', () => {
    // Generate paths with many segments
    const makeComplexPath = (offset: number) => {
      let d = `M${offset},${offset}`;
      for (let i = 1; i <= 50; i++) {
        d += ` L${offset + i * 2},${offset + Math.sin(i) * 10}`;
      }
      d += ' Z';
      return d;
    };

    const pathA = makeComplexPath(0);
    const pathB = makeComplexPath(10);

    const start = performance.now();
    const iterations = 100;
    for (let i = 0; i < iterations; i++) {
      lerpPath(pathA, pathB, i / iterations);
    }
    const elapsed = performance.now() - start;

    // 100 interpolations of 50-segment paths should take less than 500ms
    expect(elapsed).toBeLessThan(500);
  });
});
