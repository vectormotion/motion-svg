import type { Keyframe, Point, Timeline, GradientDef, GradientStop, LinearGradientDef, RadialGradientDef, StrokeAlign } from '../types';
import { getEasingFunction } from '../easing/curves';
import { plugins } from '../core/PluginSystem';
import { lerpPath } from './pathMorph';

// ─── Actor State ─────────────────────────────────────────────────────────────

export interface ActorState {
  position: Point;
  scale: number | Point;
  rotation: number;
  opacity: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeAlign?: StrokeAlign;
  /** Gaussian blur radius (px) — 0 = no blur */
  blurRadius?: number;
  /** Backdrop/background blur radius (px) — 0 = no blur */
  backdropBlur?: number;
  /** Shape width in SVG units (shape actors only) */
  width?: number;
  /** Shape height in SVG units (shape actors only) */
  height?: number;
  /** Resolved gradient for fill (when interpolating between gradients) */
  fillGradient?: GradientDef;
  /** Resolved gradient for stroke (when interpolating between gradients) */
  strokeGradient?: GradientDef;
  /** Interpolated SVG path `d` attribute (for path morphing) */
  pathD?: string;
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface InterpolateOptions {
  /** Gradient definitions available in the scene — needed for gradient↔gradient and color↔gradient interpolation */
  gradients?: GradientDef[];
  /** Actor ID — passed to plugin hooks for per-actor customization */
  actorId?: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getActorStateAtTime(tl: Timeline, timeMs: number, opts?: InterpolateOptions): ActorState {
  return interpolateKeyframes(tl.keyframes, timeMs, { ...opts, actorId: tl.actorId });
}

export function interpolateKeyframes(keyframes: Keyframe[], timeMs: number, opts?: InterpolateOptions): ActorState {
  if (keyframes.length === 0) {
    return { position: { x: 0, y: 0 }, scale: 1, rotation: 0, opacity: 1 };
  }

  // Plugin hook: beforeInterpolate
  let kfs = keyframes;
  if (plugins.has('beforeInterpolate')) {
    kfs = plugins.run('beforeInterpolate', keyframes, timeMs);
  }

  const gradients = opts?.gradients ?? [];

  // ── Per-property interpolation ──────────────────────────────────────────
  // Each property independently finds its own prev/next keyframes.
  // This ensures that a fill-only keyframe does NOT create a "hold" segment
  // for position, stroke, scale, etc. — each animation channel runs
  // concurrently without interfering with other channels.

  const fillResult  = _interpColor(kfs, timeMs, (kf) => kf.fill, gradients);
  const strokeResult = _interpColor(kfs, timeMs, (kf) => kf.stroke, gradients);

  let state: ActorState = {
    position:       _interpPoint(kfs, timeMs, (kf) => kf.position, { x: 0, y: 0 }),
    scale:          _interpScale(kfs, timeMs),
    rotation:       _interpNum(kfs, timeMs, (kf) => kf.rotation, 0),
    opacity:        _interpNum(kfs, timeMs, (kf) => kf.opacity, 1),
    fill:           fillResult.color,
    stroke:         strokeResult.color,
    strokeWidth:    _interpOptNum(kfs, timeMs, (kf) => kf.strokeWidth),
    strokeAlign:    _interpSnap(kfs, timeMs, (kf) => kf.strokeAlign) as StrokeAlign | undefined,
    blurRadius:     _interpOptNum(kfs, timeMs, (kf) => kf.blurRadius),
    backdropBlur:   _interpOptNum(kfs, timeMs, (kf) => kf.backdropBlur),
    width:          _interpOptNum(kfs, timeMs, (kf) => kf.width),
    height:         _interpOptNum(kfs, timeMs, (kf) => kf.height),
    fillGradient:   fillResult.gradient,
    strokeGradient: strokeResult.gradient,
    pathD:          _interpPath(kfs, timeMs),
  };

  // Plugin hook: afterInterpolate
  if (plugins.has('afterInterpolate')) {
    state = plugins.run('afterInterpolate', state, opts?.actorId ?? '', timeMs);
  }

  return state;
}

// ─── Per-property bracket finder ─────────────────────────────────────────────

/**
 * For a given property, find:
 *  - prev: last keyframe at or before `timeMs` that defines the property
 *  - next: first keyframe AFTER `timeMs` that defines the property
 * Keyframes MUST be sorted by `at` ascending.
 */
function _findBracket(
  keyframes: Keyframe[],
  timeMs: number,
  has: (kf: Keyframe) => boolean,
): [Keyframe | null, Keyframe | null] {
  let prev: Keyframe | null = null;
  let next: Keyframe | null = null;
  for (const kf of keyframes) {
    if (!has(kf)) continue;
    if (kf.at <= timeMs) {
      prev = kf;
    } else {
      next = kf;
      break;
    }
  }
  return [prev, next];
}

/** Eased t between two bracketing keyframes (easing comes from the target keyframe). */
function _easedT(prev: Keyframe, next: Keyframe, timeMs: number): number {
  const dur = next.at - prev.at;
  const raw = dur > 0 ? (timeMs - prev.at) / dur : 0;
  return getEasingFunction(next.curve)(raw);
}

// ─── Per-property interpolation helpers ──────────────────────────────────────

/** Interpolate a required numeric property (rotation, opacity). */
function _interpNum(
  kfs: Keyframe[], t: number, get: (kf: Keyframe) => number | undefined, def: number,
): number {
  const [p, n] = _findBracket(kfs, t, (kf) => get(kf) !== undefined);
  if (!p && !n) return def;
  if (!p) return get(n!) ?? def;
  const pv = get(p)!;
  if (!n) return pv;
  return lerp(pv, get(n!)!, _easedT(p, n, t));
}

/** Interpolate an optional numeric property (strokeWidth, blurRadius, etc.). */
function _interpOptNum(
  kfs: Keyframe[], t: number, get: (kf: Keyframe) => number | undefined,
): number | undefined {
  const [p, n] = _findBracket(kfs, t, (kf) => get(kf) !== undefined);
  if (!p && !n) return undefined;
  if (!p) return get(n!);
  const pv = get(p)!;
  if (!n) return pv;
  return lerp(pv, get(n!)!, _easedT(p, n, t));
}

/** Interpolate a Point property (position). */
function _interpPoint(
  kfs: Keyframe[], t: number, get: (kf: Keyframe) => Point | undefined, def: Point,
): Point {
  const [p, n] = _findBracket(kfs, t, (kf) => get(kf) !== undefined);
  if (!p && !n) return def;
  if (!p) return get(n!) ?? def;
  const pv = get(p)!;
  if (!n) return pv;
  return lerpPoint(pv, get(n!)!, _easedT(p, n, t));
}

/** Interpolate scale (number | Point). */
function _interpScale(kfs: Keyframe[], t: number): number | Point {
  const [p, n] = _findBracket(kfs, t, (kf) => kf.scale !== undefined);
  if (!p && !n) return 1;
  if (!p) return n!.scale!;
  const pv = p.scale!;
  if (!n) return pv;
  return lerpScale(pv, n.scale!, _easedT(p, n, t));
}

/** Interpolate a color/gradient property (fill, stroke). */
function _interpColor(
  kfs: Keyframe[], t: number, get: (kf: Keyframe) => string | undefined, gradients: GradientDef[],
): ColorResult {
  const [p, n] = _findBracket(kfs, t, (kf) => get(kf) !== undefined);
  if (!p && !n) return {};
  if (!p) return resolveResult(get(n!)!, gradients);
  const pv = get(p)!;
  if (!n) return resolveResult(pv, gradients);
  return lerpColorOrGradient(pv, get(n!)!, _easedT(p, n, t), gradients);
}

/** Snap property — no interpolation, takes prev value (strokeAlign). */
function _interpSnap<T>(
  kfs: Keyframe[], t: number, get: (kf: Keyframe) => T | undefined,
): T | undefined {
  const [p, n] = _findBracket(kfs, t, (kf) => get(kf) !== undefined);
  if (!p && !n) return undefined;
  if (!p) return get(n!);
  return get(p)!;
}

/** Interpolate SVG path `d` attribute (path morphing). */
function _interpPath(kfs: Keyframe[], t: number): string | undefined {
  const [p, n] = _findBracket(kfs, t, (kf) => kf.pathD !== undefined);
  if (!p && !n) return undefined;
  if (!p) return n!.pathD;
  if (!n) return p.pathD;
  return lerpPath(p.pathD!, n.pathD!, _easedT(p, n, t));
}

// ─── Gradient ID counter (prevents collisions when fill + stroke interpolate in same frame) ──
let _gradIdCounter = 0;

// ─── Gradient interpolation (exported utility) ───────────────────────────────

/**
 * Interpolate between two gradient definitions.
 * Handles linear↔linear, radial↔radial, and cross-type interpolation.
 * Returns a new GradientDef with interpolated stops and geometry.
 */
export function lerpGradientDef(a: GradientDef, b: GradientDef, t: number): GradientDef {
  // Interpolate stops — match by count, adding intermediate stops if needed
  const stopsA = normalizeStops(a.stops, Math.max(a.stops.length, b.stops.length));
  const stopsB = normalizeStops(b.stops, Math.max(a.stops.length, b.stops.length));

  const stops: GradientStop[] = stopsA.map((sa, i) => {
    const sb = stopsB[i] ?? sa;
    const rgbA = parseHexToRgb(sa.color);
    const rgbB = parseHexToRgb(sb.color);
    let color: string;
    if (rgbA && rgbB) {
      color = rgbToHex(
        rgbA[0] + (rgbB[0] - rgbA[0]) * t,
        rgbA[1] + (rgbB[1] - rgbA[1]) * t,
        rgbA[2] + (rgbB[2] - rgbA[2]) * t,
      );
    } else {
      color = t < 0.5 ? sa.color : sb.color;
    }
    return {
      offset: lerp(sa.offset, sb.offset, t),
      color,
      opacity: sa.opacity !== undefined || sb.opacity !== undefined
        ? lerp(sa.opacity ?? 1, sb.opacity ?? 1, t)
        : undefined,
    };
  });

  // Resolve geometry based on types
  const id = `__interp_${++_gradIdCounter}_${Date.now().toString(36)}`;

  if (a.type === 'linear' && b.type === 'linear') {
    // Use polar interpolation (angle + length + center) so gradient rotations
    // stay smooth.  Direct x1/y1/x2/y2 lerp creates a degenerate zero-length
    // vector at the midpoint when the gradient rotates (e.g. 0° → 180°).
    const cxA = (a.x1 + a.x2) / 2, cyA = (a.y1 + a.y2) / 2;
    const cxB = (b.x1 + b.x2) / 2, cyB = (b.y1 + b.y2) / 2;
    const dxA = a.x2 - a.x1, dyA = a.y2 - a.y1;
    const dxB = b.x2 - b.x1, dyB = b.y2 - b.y1;
    const lenA = Math.sqrt(dxA * dxA + dyA * dyA) / 2;
    const lenB = Math.sqrt(dxB * dxB + dyB * dyB) / 2;
    const angA = Math.atan2(dyA, dxA);
    const angB = Math.atan2(dyB, dxB);

    // Shortest-path angular interpolation
    let delta = angB - angA;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    const ang = angA + delta * t;

    const cx = lerp(cxA, cxB, t);
    const cy = lerp(cyA, cyB, t);
    const len = lerp(lenA, lenB, t);
    const cos = Math.cos(ang), sin = Math.sin(ang);

    return {
      type: 'linear',
      id,
      x1: cx - len * cos,
      y1: cy - len * sin,
      x2: cx + len * cos,
      y2: cy + len * sin,
      stops,
      gradientUnits: b.gradientUnits ?? a.gradientUnits,
    };
  }

  if (a.type === 'radial' && b.type === 'radial') {
    return {
      type: 'radial',
      id,
      cx: lerp(a.cx, b.cx, t),
      cy: lerp(a.cy, b.cy, t),
      r: lerp(a.r, b.r, t),
      fx: a.fx !== undefined || b.fx !== undefined
        ? lerp(a.fx ?? a.cx, b.fx ?? b.cx, t) : undefined,
      fy: a.fy !== undefined || b.fy !== undefined
        ? lerp(a.fy ?? a.cy, b.fy ?? b.cy, t) : undefined,
      stops,
      gradientUnits: b.gradientUnits ?? a.gradientUnits,
    };
  }

  // Cross-type: linear↔radial — convert to the target type
  if (t < 0.5) {
    // Stay as source type with interpolated stops
    if (a.type === 'linear') {
      return { ...a, id, stops };
    }
    return { ...a, id, stops };
  }
  if (b.type === 'linear') {
    return { ...b, id, stops };
  }
  return { ...b, id, stops };
}

// ─── Internal: Color/Gradient interpolation ──────────────────────────────────

interface ColorResult {
  color?: string;
  gradient?: GradientDef;
}

/**
 * Interpolate between two color values that may be hex colors or gradient references (url(#id)).
 * When both are gradients, returns an interpolated GradientDef.
 * When one is a color and one is a gradient, creates a uniform gradient from the color and lerps.
 */
function lerpColorOrGradient(
  a: string | undefined,
  b: string | undefined,
  t: number,
  gradients: GradientDef[],
): ColorResult {
  if (!a && !b) return {};
  if (!a) return resolveResult(b!, gradients);
  if (!b) return resolveResult(a, gradients);
  if (a === b) return resolveResult(a, gradients);

  const aIsGrad = a.startsWith('url(');
  const bIsGrad = b.startsWith('url(');

  // Both are plain colors — simple hex lerp
  if (!aIsGrad && !bIsGrad) {
    return { color: lerpColor(a, b, t) };
  }

  // Both are gradient references
  if (aIsGrad && bIsGrad) {
    const gradA = resolveGradient(a, gradients);
    const gradB = resolveGradient(b, gradients);
    if (gradA && gradB) {
      const blended = lerpGradientDef(gradA, gradB, t);
      return { color: `url(#${blended.id})`, gradient: blended };
    }
    // Fallback: snap
    return { color: t < 0.5 ? a : b };
  }

  // One color, one gradient — create uniform gradient from the color and blend
  const colorVal = aIsGrad ? b : a;
  const gradRef = aIsGrad ? a : b;
  const gradDef = resolveGradient(gradRef, gradients);

  if (gradDef) {
    const uniformGrad = colorToUniformGradient(colorVal, gradDef);
    const effectiveT = aIsGrad ? t : (1 - t);
    // If 'a' is the gradient, we blend from gradient(a) → uniform(b), so t stays
    // If 'b' is the gradient, we blend from uniform(a) → gradient(b), so t stays
    const blended = aIsGrad
      ? lerpGradientDef(gradDef, uniformGrad, t)
      : lerpGradientDef(uniformGrad, gradDef, t);
    return { color: `url(#${blended.id})`, gradient: blended };
  }

  // Fallback
  return { color: t < 0.5 ? a : b };
}

function resolveResult(value: string, gradients: GradientDef[]): ColorResult {
  if (value.startsWith('url(')) {
    const grad = resolveGradient(value, gradients);
    return grad ? { color: value, gradient: undefined } : { color: value };
  }
  return { color: value };
}

function resolveGradient(ref: string, gradients: GradientDef[]): GradientDef | undefined {
  const id = ref.match(/url\(#(.+)\)/)?.[1];
  if (!id) return undefined;
  return gradients.find((g) => g.id === id);
}

/**
 * Create a uniform (single-color) gradient matching the shape of a target gradient.
 */
function colorToUniformGradient(color: string, target: GradientDef): GradientDef {
  const stops: GradientStop[] = target.stops.map((s) => ({
    offset: s.offset,
    color,
    opacity: s.opacity,
  }));

  const id = `__uniform_${++_gradIdCounter}_${Date.now().toString(36)}`;

  if (target.type === 'linear') {
    return {
      type: 'linear',
      id,
      x1: target.x1,
      y1: target.y1,
      x2: target.x2,
      y2: target.y2,
      stops,
      gradientUnits: target.gradientUnits,
    };
  }

  return {
    type: 'radial',
    id,
    cx: target.cx,
    cy: target.cy,
    r: target.r,
    fx: target.fx,
    fy: target.fy,
    stops,
    gradientUnits: target.gradientUnits,
  };
}

// ─── Normalize gradient stops ────────────────────────────────────────────────

/**
 * Ensure a gradient has exactly `count` stops by interpolating intermediate ones.
 */
function normalizeStops(stops: GradientStop[], count: number): GradientStop[] {
  if (stops.length === count) return stops;
  if (stops.length === 0) return Array.from({ length: count }, (_, i) => ({
    offset: count > 1 ? i / (count - 1) : 0,
    color: '#000000',
  }));

  // Generate evenly-spaced offsets and sample from the original stops
  const result: GradientStop[] = [];
  for (let i = 0; i < count; i++) {
    const targetOffset = count > 1 ? i / (count - 1) : 0;

    // Find surrounding stops
    let lo = stops[0];
    let hi = stops[stops.length - 1];
    for (let j = 0; j < stops.length - 1; j++) {
      if (stops[j].offset <= targetOffset && stops[j + 1].offset >= targetOffset) {
        lo = stops[j];
        hi = stops[j + 1];
        break;
      }
    }

    const range = hi.offset - lo.offset;
    const localT = range > 0 ? (targetOffset - lo.offset) / range : 0;

    const rgbLo = parseHexToRgb(lo.color);
    const rgbHi = parseHexToRgb(hi.color);
    let color: string;
    if (rgbLo && rgbHi) {
      color = rgbToHex(
        rgbLo[0] + (rgbHi[0] - rgbLo[0]) * localT,
        rgbLo[1] + (rgbHi[1] - rgbLo[1]) * localT,
        rgbLo[2] + (rgbHi[2] - rgbLo[2]) * localT,
      );
    } else {
      color = localT < 0.5 ? lo.color : hi.color;
    }

    result.push({
      offset: targetOffset,
      color,
      opacity: lo.opacity !== undefined || hi.opacity !== undefined
        ? lerp(lo.opacity ?? 1, hi.opacity ?? 1, localT)
        : undefined,
    });
  }
  return result;
}

// ─── Numeric lerp ────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function lerpScale(
  a: number | Point,
  b: number | Point,
  t: number,
): number | Point {
  const ax = typeof a === 'number' ? a : a.x;
  const ay = typeof a === 'number' ? a : a.y;
  const bx = typeof b === 'number' ? b : b.x;
  const by = typeof b === 'number' ? b : b.y;

  const rx = lerp(ax, bx, t);
  const ry = lerp(ay, by, t);

  if (Math.abs(rx - ry) < 0.0001) return rx;
  return { x: rx, y: ry };
}

// ─── Color lerp (hex only) ──────────────────────────────────────────────────

function parseHexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace(/^#/, '');
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  if (h.length === 6) {
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16),
    ];
  }
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const hex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function lerpColor(a: string | undefined, b: string | undefined, t: number): string | undefined {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;
  if (a === b) return a;

  const rgbA = parseHexToRgb(a);
  const rgbB = parseHexToRgb(b);

  if (!rgbA || !rgbB) {
    return t < 0.5 ? a : b;
  }

  return rgbToHex(
    rgbA[0] + (rgbB[0] - rgbA[0]) * t,
    rgbA[1] + (rgbB[1] - rgbA[1]) * t,
    rgbA[2] + (rgbB[2] - rgbA[2]) * t,
  );
}
