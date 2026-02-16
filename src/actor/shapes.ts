import type { ShapeType } from '../types';

// ─── Shape Path Generator ───────────────────────────────────────────────────

export interface ShapeOptions {
  /** Number of sides for polygon (default: 5) */
  sides?: number;
  /** Arrowhead size relative to stroke width (default: 10) */
  arrowSize?: number;
}

/**
 * Generate an SVG path `d` string for a geometric shape.
 *
 * All shapes are generated starting at (0,0) with the given width and height,
 * so the bounding box is always [0, 0, width, height].
 */
export function generateShapePath(
  type: ShapeType,
  width: number,
  height: number,
  opts?: ShapeOptions,
): string {
  const w = Math.max(0, width);
  const h = Math.max(0, height);

  switch (type) {
    case 'rect':
      return rectPath(w, h);
    case 'ellipse':
      return ellipsePath(w, h);
    case 'line':
      return linePath(w, h);
    case 'arrow':
      return arrowPath(w, h, opts?.arrowSize ?? 10);
    case 'polygon':
      return polygonPath(w, h, opts?.sides ?? 5);
    default:
      return rectPath(w, h);
  }
}

// ─── Rectangle ──────────────────────────────────────────────────────────────

function rectPath(w: number, h: number): string {
  return `M 0 0 H ${w} V ${h} H 0 Z`;
}

// ─── Ellipse (4 cubic Bézier arcs) ─────────────────────────────────────────

function ellipsePath(w: number, h: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;

  // Bézier approximation constant for a quarter arc
  const k = 0.5522847498;
  const kx = rx * k;
  const ky = ry * k;

  return [
    `M ${cx} ${cy - ry}`,
    `C ${cx + kx} ${cy - ry}, ${cx + rx} ${cy - ky}, ${cx + rx} ${cy}`,
    `C ${cx + rx} ${cy + ky}, ${cx + kx} ${cy + ry}, ${cx} ${cy + ry}`,
    `C ${cx - kx} ${cy + ry}, ${cx - rx} ${cy + ky}, ${cx - rx} ${cy}`,
    `C ${cx - rx} ${cy - ky}, ${cx - kx} ${cy - ry}, ${cx} ${cy - ry}`,
    'Z',
  ].join(' ');
}

// ─── Line ───────────────────────────────────────────────────────────────────

function linePath(w: number, h: number): string {
  return `M 0 ${h / 2} L ${w} ${h / 2}`;
}

// ─── Arrow (line + arrowhead) ───────────────────────────────────────────────

function arrowPath(w: number, h: number, arrowSize: number): string {
  const midY = h / 2;
  const as = Math.min(arrowSize, w * 0.3, h * 0.4);

  return [
    // shaft
    `M 0 ${midY} L ${w - as} ${midY}`,
    // arrowhead
    `M ${w - as} ${midY - as} L ${w} ${midY} L ${w - as} ${midY + as}`,
  ].join(' ');
}

// ─── Regular Polygon ────────────────────────────────────────────────────────

function polygonPath(w: number, h: number, sides: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const n = Math.max(3, Math.round(sides));

  const points: string[] = [];
  for (let i = 0; i < n; i++) {
    // Start from the top (−π/2)
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(4)} ${y.toFixed(4)}`);
  }
  points.push('Z');
  return points.join(' ');
}
