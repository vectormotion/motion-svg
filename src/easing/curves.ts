import type { EasingCurve, EasingName, CubicBezierCurve } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EasingFunction = (t: number) => number;

// ─── Cubic Bezier ───────────────────────────────────────────────────────────

/**
 * Create a cubic-bezier easing function (like CSS cubic-bezier).
 * Implementation based on WebKit's UnitBezier.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  // Pre-compute polynomial coefficients
  const cx = 3.0 * x1;
  const bx = 3.0 * (x2 - x1) - cx;
  const ax = 1.0 - cx - bx;

  const cy = 3.0 * y1;
  const by = 3.0 * (y2 - y1) - cy;
  const ay = 1.0 - cy - by;

  function sampleCurveX(t: number): number {
    return ((ax * t + bx) * t + cx) * t;
  }

  function sampleCurveY(t: number): number {
    return ((ay * t + by) * t + cy) * t;
  }

  function sampleCurveDerivativeX(t: number): number {
    return (3.0 * ax * t + 2.0 * bx) * t + cx;
  }

  // Newton-Raphson iteration to solve for t given x
  function solveCurveX(x: number): number {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const currentX = sampleCurveX(t) - x;
      if (Math.abs(currentX) < 1e-7) return t;
      const d = sampleCurveDerivativeX(t);
      if (Math.abs(d) < 1e-7) break;
      t -= currentX / d;
    }

    // Bisection fallback
    let lo = 0.0;
    let hi = 1.0;
    t = x;
    while (lo < hi) {
      const mid = sampleCurveX(t);
      if (Math.abs(mid - x) < 1e-7) return t;
      if (x > mid) lo = t;
      else hi = t;
      t = (lo + hi) / 2.0;
    }
    return t;
  }

  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleCurveY(solveCurveX(t));
  };
}

// ─── Built-in easing functions ──────────────────────────────────────────────

const PI = Math.PI;
const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;
const c4 = (2 * PI) / 3;
const c5 = (2 * PI) / 4.5;

function bounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

export const easingFunctions: Record<EasingName, EasingFunction> = {
  // Linear
  linear: (t) => t,

  // Sine
  easeIn: (t) => 1 - Math.cos((t * PI) / 2),
  easeOut: (t) => Math.sin((t * PI) / 2),
  easeInOut: (t) => -(Math.cos(PI * t) - 1) / 2,

  // Quad
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),

  // Cubic
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),

  // Quart
  easeInQuart: (t) => t * t * t * t,
  easeOutQuart: (t) => 1 - (1 - t) ** 4,
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - (-2 * t + 2) ** 4 / 2),

  // Back
  easeInBack: (t) => c3 * t * t * t - c1 * t * t,
  easeOutBack: (t) => 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2,
  easeInOutBack: (t) =>
    t < 0.5
      ? ((2 * t) ** 2 * ((c2 + 1) * 2 * t - c2)) / 2
      : ((2 * t - 2) ** 2 * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2,

  // Elastic
  easeInElastic: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * c4),
  easeOutElastic: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1,
  easeInOutElastic: (t) =>
    t === 0
      ? 0
      : t === 1
        ? 1
        : t < 0.5
          ? -(2 ** (20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
          : (2 ** (-20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1,

  // Bounce
  easeInBounce: (t) => 1 - bounceOut(1 - t),
  easeOutBounce: bounceOut,
  easeInOutBounce: (t) =>
    t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2,
};

// ─── Resolver ───────────────────────────────────────────────────────────────

/** Resolve an EasingCurve descriptor to a callable function. */
export function getEasingFunction(curve: EasingCurve | undefined): EasingFunction {
  if (!curve) return easingFunctions.linear;
  if (typeof curve === 'string') {
    return easingFunctions[curve] ?? easingFunctions.linear;
  }
  // CubicBezierCurve object
  return cubicBezier(curve.x1, curve.y1, curve.x2, curve.y2);
}
