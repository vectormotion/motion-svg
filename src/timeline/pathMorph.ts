// ─── Path Morphing Engine ────────────────────────────────────────────────────
//
// Interpolates SVG path `d` attributes between two shapes.
// Pipeline: parsePathD → normalizeToCubic → balanceCommands → lerp control points
//

// ── Types ────────────────────────────────────────────────────────────────────

export type CommandType = 'M' | 'L' | 'H' | 'V' | 'C' | 'S' | 'Q' | 'T' | 'A' | 'Z';

export interface PathCommand {
  type: CommandType;
  /** Whether the original command was relative (lowercase) */
  relative: boolean;
  /** Numeric parameters (absolute coordinates after normalization) */
  params: number[];
}

/** A normalized cubic command — always absolute C with 6 params [cx1, cy1, cx2, cy2, x, y] */
export interface CubicSegment {
  /** Control point 1 */
  cx1: number; cy1: number;
  /** Control point 2 */
  cx2: number; cy2: number;
  /** End point */
  x: number; y: number;
}

/** A normalized path: one M start point + N cubic segments + optional Z */
export interface NormalizedPath {
  startX: number;
  startY: number;
  segments: CubicSegment[];
  closed: boolean;
}

// ── Parsing ──────────────────────────────────────────────────────────────────

const CMD_RE = /([MmLlHhVvCcSsQqTtAaZz])/;

/**
 * Parse an SVG path `d` string into an array of absolute PathCommands.
 */
export function parsePathD(d: string): PathCommand[] {
  const tokens = d.split(CMD_RE).filter((s) => s.trim().length > 0);
  const commands: PathCommand[] = [];

  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;

  let i = 0;
  while (i < tokens.length) {
    const raw = tokens[i];
    const letter = raw.trim();

    if (!/^[MmLlHhVvCcSsQqTtAaZz]$/.test(letter)) {
      i++;
      continue;
    }

    const isRelative = letter === letter.toLowerCase();
    const type = letter.toUpperCase() as CommandType;
    const paramStr = tokens[i + 1] ?? '';
    const nums = parseNumbers(paramStr);
    i += 2;

    // Commands can have implicit repeats (e.g. M 0,0 10,10 → M 0,0 L 10,10)
    const paramCounts: Record<CommandType, number> = {
      M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0,
    };
    const count = paramCounts[type];

    if (type === 'Z') {
      commands.push({ type: 'Z', relative: false, params: [] });
      curX = startX;
      curY = startY;
      continue;
    }

    if (count === 0) continue;

    // Process parameter groups
    let j = 0;
    while (j < nums.length || j === 0) {
      const group = nums.slice(j, j + count);
      if (group.length < count) break;
      j += count;

      // Convert to absolute
      const abs = toAbsolute(type, group, curX, curY, isRelative);
      const implicitType = type === 'M' && j > count ? 'L' : type;

      commands.push({ type: implicitType as CommandType, relative: false, params: abs });

      // Update cursor
      switch (type) {
        case 'M':
          curX = abs[0]; curY = abs[1];
          startX = curX; startY = curY;
          break;
        case 'L': case 'T':
          curX = abs[0]; curY = abs[1];
          break;
        case 'H':
          curX = abs[0];
          break;
        case 'V':
          curY = abs[0];
          break;
        case 'C':
          curX = abs[4]; curY = abs[5];
          break;
        case 'S':
          curX = abs[2]; curY = abs[3];
          break;
        case 'Q':
          curX = abs[2]; curY = abs[3];
          break;
        case 'A':
          curX = abs[5]; curY = abs[6];
          break;
      }
    }
  }

  return commands;
}

function parseNumbers(s: string): number[] {
  // Handle comma/whitespace separated numbers, including negative signs
  const matches = s.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi);
  return matches ? matches.map(Number) : [];
}

function toAbsolute(
  type: CommandType,
  params: number[],
  curX: number,
  curY: number,
  isRelative: boolean,
): number[] {
  if (!isRelative) return params;

  switch (type) {
    case 'M': case 'L': case 'T':
      return [params[0] + curX, params[1] + curY];
    case 'H':
      return [params[0] + curX];
    case 'V':
      return [params[0] + curY];
    case 'C':
      return [
        params[0] + curX, params[1] + curY,
        params[2] + curX, params[3] + curY,
        params[4] + curX, params[5] + curY,
      ];
    case 'S':
      return [
        params[0] + curX, params[1] + curY,
        params[2] + curX, params[3] + curY,
      ];
    case 'Q':
      return [
        params[0] + curX, params[1] + curY,
        params[2] + curX, params[3] + curY,
      ];
    case 'A':
      // rx, ry, rotation, largeArc, sweep are NOT offset; only endpoint is
      return [params[0], params[1], params[2], params[3], params[4], params[5] + curX, params[6] + curY];
    default:
      return params;
  }
}

// ── Normalize to Cubic ───────────────────────────────────────────────────────

/**
 * Convert a parsed path into a NormalizedPath where all drawing commands
 * are cubic bezier segments.
 */
export function normalizeToCubic(commands: PathCommand[]): NormalizedPath {
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let lastCx = 0;
  let lastCy = 0;
  let lastQx = 0;
  let lastQy = 0;
  let lastType: CommandType = 'M';
  const segments: CubicSegment[] = [];
  let pathStartX = 0;
  let pathStartY = 0;

  for (const cmd of commands) {
    const p = cmd.params;

    switch (cmd.type) {
      case 'M':
        curX = p[0]; curY = p[1];
        startX = curX; startY = curY;
        pathStartX = curX; pathStartY = curY;
        break;

      case 'L':
        segments.push(lineToCubic(curX, curY, p[0], p[1]));
        curX = p[0]; curY = p[1];
        break;

      case 'H':
        segments.push(lineToCubic(curX, curY, p[0], curY));
        curX = p[0];
        break;

      case 'V':
        segments.push(lineToCubic(curX, curY, curX, p[0]));
        curY = p[0];
        break;

      case 'C':
        segments.push({ cx1: p[0], cy1: p[1], cx2: p[2], cy2: p[3], x: p[4], y: p[5] });
        lastCx = p[2]; lastCy = p[3];
        curX = p[4]; curY = p[5];
        break;

      case 'S': {
        // Reflect previous C control point
        const rcx = lastType === 'C' || lastType === 'S' ? 2 * curX - lastCx : curX;
        const rcy = lastType === 'C' || lastType === 'S' ? 2 * curY - lastCy : curY;
        segments.push({ cx1: rcx, cy1: rcy, cx2: p[0], cy2: p[1], x: p[2], y: p[3] });
        lastCx = p[0]; lastCy = p[1];
        curX = p[2]; curY = p[3];
        break;
      }

      case 'Q': {
        // Convert quadratic to cubic
        const c = quadToCubic(curX, curY, p[0], p[1], p[2], p[3]);
        segments.push(c);
        lastQx = p[0]; lastQy = p[1];
        curX = p[2]; curY = p[3];
        break;
      }

      case 'T': {
        // Reflect previous Q control point
        const rqx = lastType === 'Q' || lastType === 'T' ? 2 * curX - lastQx : curX;
        const rqy = lastType === 'Q' || lastType === 'T' ? 2 * curY - lastQy : curY;
        const c = quadToCubic(curX, curY, rqx, rqy, p[0], p[1]);
        segments.push(c);
        lastQx = rqx; lastQy = rqy;
        curX = p[0]; curY = p[1];
        break;
      }

      case 'A': {
        // Approximate arc with cubic bezier(s)
        const arcs = arcToCubics(curX, curY, p[0], p[1], p[2], p[3], p[4], p[5], p[6]);
        segments.push(...arcs);
        curX = p[5]; curY = p[6];
        break;
      }

      case 'Z':
        if (curX !== startX || curY !== startY) {
          segments.push(lineToCubic(curX, curY, startX, startY));
        }
        curX = startX; curY = startY;
        break;
    }

    lastType = cmd.type;
  }

  return {
    startX: pathStartX,
    startY: pathStartY,
    segments,
    closed: commands.length > 0 && commands[commands.length - 1].type === 'Z',
  };
}

function lineToCubic(x1: number, y1: number, x2: number, y2: number): CubicSegment {
  return {
    cx1: x1 + (x2 - x1) / 3,
    cy1: y1 + (y2 - y1) / 3,
    cx2: x1 + 2 * (x2 - x1) / 3,
    cy2: y1 + 2 * (y2 - y1) / 3,
    x: x2,
    y: y2,
  };
}

function quadToCubic(
  x0: number, y0: number,
  qx: number, qy: number,
  x: number, y: number,
): CubicSegment {
  return {
    cx1: x0 + 2 / 3 * (qx - x0),
    cy1: y0 + 2 / 3 * (qy - y0),
    cx2: x + 2 / 3 * (qx - x),
    cy2: y + 2 / 3 * (qy - y),
    x,
    y,
  };
}

// ── Arc to Cubic approximation ───────────────────────────────────────────────

function arcToCubics(
  x1: number, y1: number,
  rx: number, ry: number,
  xAxisRotation: number,
  largeArc: number, sweep: number,
  x2: number, y2: number,
): CubicSegment[] {
  if (rx === 0 || ry === 0) {
    return [lineToCubic(x1, y1, x2, y2)];
  }

  const phi = (xAxisRotation * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: Compute center
  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  // Ensure radii are large enough
  let rxSq = rx * rx;
  let rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;

  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
    rxSq = rx * rx;
    rySq = ry * ry;
  }

  let num = rxSq * rySq - rxSq * y1pSq - rySq * x1pSq;
  let den = rxSq * y1pSq + rySq * x1pSq;
  if (num < 0) num = 0;
  const sq = Math.sqrt(num / den);
  const sign = largeArc === sweep ? -1 : 1;

  const cxp = sign * sq * (rx * y1p / ry);
  const cyp = sign * sq * -(ry * x1p / rx);

  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // Step 2: Compute angles
  const theta1 = angleBetween(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dtheta = angleBetween(
    (x1p - cxp) / rx, (y1p - cyp) / ry,
    (-x1p - cxp) / rx, (-y1p - cyp) / ry,
  );

  if (sweep === 0 && dtheta > 0) dtheta -= 2 * Math.PI;
  if (sweep === 1 && dtheta < 0) dtheta += 2 * Math.PI;

  // Step 3: Split into segments of max π/2
  const segCount = Math.ceil(Math.abs(dtheta) / (Math.PI / 2));
  const segAngle = dtheta / segCount;
  const results: CubicSegment[] = [];

  for (let i = 0; i < segCount; i++) {
    const a1 = theta1 + i * segAngle;
    const a2 = theta1 + (i + 1) * segAngle;
    results.push(arcSegmentToCubic(cx, cy, rx, ry, phi, a1, a2));
  }

  return results;
}

function angleBetween(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
  let angle = Math.acos(Math.max(-1, Math.min(1, dot / len)));
  if (ux * vy - uy * vx < 0) angle = -angle;
  return angle;
}

function arcSegmentToCubic(
  cx: number, cy: number,
  rx: number, ry: number,
  phi: number,
  theta1: number, theta2: number,
): CubicSegment {
  const alpha = Math.sin(theta2 - theta1) * (Math.sqrt(4 + 3 * Math.tan((theta2 - theta1) / 2) ** 2) - 1) / 3;

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const p1x = rx * Math.cos(theta1);
  const p1y = ry * Math.sin(theta1);
  const p2x = rx * Math.cos(theta2);
  const p2y = ry * Math.sin(theta2);

  const d1x = -rx * Math.sin(theta1);
  const d1y = ry * Math.cos(theta1);
  const d2x = -rx * Math.sin(theta2);
  const d2y = ry * Math.cos(theta2);

  return {
    cx1: cx + cosPhi * (p1x + alpha * d1x) - sinPhi * (p1y + alpha * d1y),
    cy1: cy + sinPhi * (p1x + alpha * d1x) + cosPhi * (p1y + alpha * d1y),
    cx2: cx + cosPhi * (p2x - alpha * d2x) - sinPhi * (p2y - alpha * d2y),
    cy2: cy + sinPhi * (p2x - alpha * d2x) + cosPhi * (p2y - alpha * d2y),
    x: cx + cosPhi * p2x - sinPhi * p2y,
    y: cy + sinPhi * p2x + cosPhi * p2y,
  };
}

// ── Balance Commands ─────────────────────────────────────────────────────────

/**
 * Make two normalized paths have the same number of segments
 * by subdividing the longest segment on the shorter path.
 */
export function balanceCommands(
  a: NormalizedPath,
  b: NormalizedPath,
): [NormalizedPath, NormalizedPath] {
  let segsA = [...a.segments];
  let segsB = [...b.segments];

  while (segsA.length < segsB.length) {
    segsA = subdivideAtLongest(segsA, a.startX, a.startY);
  }
  while (segsB.length < segsA.length) {
    segsB = subdivideAtLongest(segsB, b.startX, b.startY);
  }

  return [
    { ...a, segments: segsA },
    { ...b, segments: segsB },
  ];
}

function subdivideAtLongest(segments: CubicSegment[], startX: number, startY: number): CubicSegment[] {
  if (segments.length === 0) return segments;

  // Find longest segment
  let longestIdx = 0;
  let longestLen = 0;

  let prevX = startX;
  let prevY = startY;

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const len = segmentLength(prevX, prevY, s);
    if (len > longestLen) {
      longestLen = len;
      longestIdx = i;
    }
    prevX = s.x;
    prevY = s.y;
  }

  // Get the start point for this segment
  let sx = startX;
  let sy = startY;
  for (let i = 0; i < longestIdx; i++) {
    sx = segments[i].x;
    sy = segments[i].y;
  }

  const seg = segments[longestIdx];
  const [first, second] = splitCubicAt(sx, sy, seg, 0.5);

  const result = [...segments];
  result.splice(longestIdx, 1, first, second);
  return result;
}

/** Approximate segment length using chord + control point distances */
function segmentLength(startX: number, startY: number, s: CubicSegment): number {
  const chord = Math.hypot(s.x - startX, s.y - startY);
  const controlNet = Math.hypot(s.cx1 - startX, s.cy1 - startY)
    + Math.hypot(s.cx2 - s.cx1, s.cy2 - s.cy1)
    + Math.hypot(s.x - s.cx2, s.y - s.cy2);
  return (chord + controlNet) / 2;
}

/** Split a cubic bezier segment at parameter t using De Casteljau */
function splitCubicAt(
  x0: number, y0: number,
  seg: CubicSegment,
  t: number,
): [CubicSegment, CubicSegment] {
  const { cx1, cy1, cx2, cy2, x, y } = seg;

  // Level 1
  const ax = lerp(x0, cx1, t);
  const ay = lerp(y0, cy1, t);
  const bx = lerp(cx1, cx2, t);
  const by = lerp(cy1, cy2, t);
  const cx = lerp(cx2, x, t);
  const cy = lerp(cy2, y, t);

  // Level 2
  const dx = lerp(ax, bx, t);
  const dy = lerp(ay, by, t);
  const ex = lerp(bx, cx, t);
  const ey = lerp(by, cy, t);

  // Level 3 — the split point
  const fx = lerp(dx, ex, t);
  const fy = lerp(dy, ey, t);

  return [
    { cx1: ax, cy1: ay, cx2: dx, cy2: dy, x: fx, y: fy },
    { cx1: ex, cy1: ey, cx2: cx, cy2: cy, x, y },
  ];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Lerp Path ────────────────────────────────────────────────────────────────

/**
 * Interpolate between two SVG path `d` strings at factor t (0..1).
 *
 * Pipeline: parse → normalize to cubic → balance segment counts → lerp control points.
 *
 * @param pathA Starting path `d` string
 * @param pathB Ending path `d` string
 * @param t Interpolation factor (0 = pathA, 1 = pathB)
 * @returns Interpolated SVG path `d` string
 */
export function lerpPath(pathA: string, pathB: string, t: number): string {
  if (t <= 0) return pathA;
  if (t >= 1) return pathB;

  let normA = normalizeToCubic(parsePathD(pathA));
  let normB = normalizeToCubic(parsePathD(pathB));

  // Balance segment counts
  [normA, normB] = balanceCommands(normA, normB);

  // Lerp start point
  const sx = lerp(normA.startX, normB.startX, t);
  const sy = lerp(normA.startY, normB.startY, t);

  let d = `M${round(sx)},${round(sy)}`;

  for (let i = 0; i < normA.segments.length; i++) {
    const a = normA.segments[i];
    const b = normB.segments[i];

    d += ` C${round(lerp(a.cx1, b.cx1, t))},${round(lerp(a.cy1, b.cy1, t))}`;
    d += ` ${round(lerp(a.cx2, b.cx2, t))},${round(lerp(a.cy2, b.cy2, t))}`;
    d += ` ${round(lerp(a.x, b.x, t))},${round(lerp(a.y, b.y, t))}`;
  }

  // Close if both paths are closed
  if (normA.closed && normB.closed) {
    d += ' Z';
  }

  return d;
}

function round(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}
