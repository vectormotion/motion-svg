import type { Scene, SvgPath, SvgGroup, ViewBox, ColorMap, SvgMetadata, GradientDef, GradientStop, LinearGradientDef, RadialGradientDef } from '../types';
import { plugins } from '../core/PluginSystem';

// ─── Lightweight DOM-free SVG parser ────────────────────────────────────────
// Works in both Node.js and browsers by using regex-based extraction.
// For browser environments a DOMParser fast-path is used when available.

/** Parse an SVG string and return a structured Scene object. */
export function parseSvg(svgString: string): Scene {
  const trimmed = svgString.trim();
  if (!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) {
    throw new Error('motion-svg: Input does not look like an SVG string.');
  }

  const viewBox = extractViewBox(trimmed);
  const paths = extractPaths(trimmed);
  const groups = extractGroups(trimmed, paths);
  const colors = buildColorMap(paths);
  const gradients = extractGradients(trimmed);
  const metadata = extractMetadata(trimmed);

  let scene: Scene = { viewBox, paths, groups, colors, gradients, metadata };

  // Plugin hook: afterParse
  if (plugins.has('afterParse')) {
    scene = plugins.run('afterParse', scene);
  }

  return scene;
}

// ─── ViewBox ────────────────────────────────────────────────────────────────

function extractViewBox(svg: string): ViewBox {
  const match = svg.match(/viewBox=["']([^"']+)["']/);
  if (match) {
    const parts = match[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length >= 4) {
      return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    }
  }
  // Fallback to width/height attributes
  const w = extractNumericAttr(svg, 'width') ?? 300;
  const h = extractNumericAttr(svg, 'height') ?? 150;
  return { x: 0, y: 0, w, h };
}

function extractNumericAttr(tag: string, name: string): number | undefined {
  const re = new RegExp(`${name}=["']([\\d.]+)`, 'i');
  const m = tag.match(re);
  return m ? parseFloat(m[1]) : undefined;
}

// ─── Paths ──────────────────────────────────────────────────────────────────

let pathCounter = 0;

function extractPaths(svg: string): SvgPath[] {
  pathCounter = 0;
  const paths: SvgPath[] = [];

  // Match <path .../> and <path ...>...</path>
  const pathRegex = /<path\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;

  while ((m = pathRegex.exec(svg)) !== null) {
    const attrs = m[1];
    const d = extractAttr(attrs, 'd');
    if (!d) continue;

    const id = extractAttr(attrs, 'id') || `path-${++pathCounter}`;
    const fill = extractAttr(attrs, 'fill') || undefined;
    const stroke = extractAttr(attrs, 'stroke') || undefined;
    const strokeWidthStr = extractAttr(attrs, 'stroke-width');
    const strokeWidth = strokeWidthStr ? parseFloat(strokeWidthStr) : undefined;
    const opacityStr = extractAttr(attrs, 'opacity');
    const opacity = opacityStr ? parseFloat(opacityStr) : undefined;
    const transform = extractAttr(attrs, 'transform') || undefined;

    paths.push({ id, d, fill, stroke, strokeWidth, opacity, transform });
  }

  // Also extract basic shapes and convert to pseudo-paths
  extractCircles(svg, paths);
  extractRects(svg, paths);
  extractEllipses(svg, paths);
  extractLines(svg, paths);
  extractPolygons(svg, paths);

  return paths;
}

function extractCircles(svg: string, paths: SvgPath[]) {
  const re = /<circle\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const attrs = m[1];
    const cx = parseFloat(extractAttr(attrs, 'cx') || '0');
    const cy = parseFloat(extractAttr(attrs, 'cy') || '0');
    const r = parseFloat(extractAttr(attrs, 'r') || '0');
    if (r <= 0) continue;
    const d = `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 -${r * 2},0`;
    pushShapePath(attrs, d, 'circle', paths);
  }
}

function extractRects(svg: string, paths: SvgPath[]) {
  const re = /<rect\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const attrs = m[1];
    const x = parseFloat(extractAttr(attrs, 'x') || '0');
    const y = parseFloat(extractAttr(attrs, 'y') || '0');
    const w = parseFloat(extractAttr(attrs, 'width') || '0');
    const h = parseFloat(extractAttr(attrs, 'height') || '0');
    if (w <= 0 || h <= 0) continue;
    const d = `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`;
    pushShapePath(attrs, d, 'rect', paths);
  }
}

function extractEllipses(svg: string, paths: SvgPath[]) {
  const re = /<ellipse\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const attrs = m[1];
    const cx = parseFloat(extractAttr(attrs, 'cx') || '0');
    const cy = parseFloat(extractAttr(attrs, 'cy') || '0');
    const rx = parseFloat(extractAttr(attrs, 'rx') || '0');
    const ry = parseFloat(extractAttr(attrs, 'ry') || '0');
    if (rx <= 0 || ry <= 0) continue;
    const d = `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 -${rx * 2},0`;
    pushShapePath(attrs, d, 'ellipse', paths);
  }
}

function extractLines(svg: string, paths: SvgPath[]) {
  const re = /<line\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const attrs = m[1];
    const x1 = extractAttr(attrs, 'x1') || '0';
    const y1 = extractAttr(attrs, 'y1') || '0';
    const x2 = extractAttr(attrs, 'x2') || '0';
    const y2 = extractAttr(attrs, 'y2') || '0';
    const d = `M${x1},${y1} L${x2},${y2}`;
    pushShapePath(attrs, d, 'line', paths);
  }
}

function extractPolygons(svg: string, paths: SvgPath[]) {
  const re = /<(polygon|polyline)\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const tag = m[1];
    const attrs = m[2];
    const points = extractAttr(attrs, 'points');
    if (!points) continue;
    const parts = points.trim().split(/[\s,]+/);
    if (parts.length < 4) continue;
    let d = `M${parts[0]},${parts[1]}`;
    for (let i = 2; i < parts.length - 1; i += 2) {
      d += ` L${parts[i]},${parts[i + 1]}`;
    }
    if (tag === 'polygon') d += ' Z';
    pushShapePath(attrs, d, tag, paths);
  }
}

function pushShapePath(attrs: string, d: string, prefix: string, paths: SvgPath[]) {
  const id = extractAttr(attrs, 'id') || `${prefix}-${++pathCounter}`;
  const fill = extractAttr(attrs, 'fill') || undefined;
  const stroke = extractAttr(attrs, 'stroke') || undefined;
  const strokeWidthStr = extractAttr(attrs, 'stroke-width');
  const strokeWidth = strokeWidthStr ? parseFloat(strokeWidthStr) : undefined;
  const opacityStr = extractAttr(attrs, 'opacity');
  const opacity = opacityStr ? parseFloat(opacityStr) : undefined;
  const transform = extractAttr(attrs, 'transform') || undefined;
  paths.push({ id, d, fill, stroke, strokeWidth, opacity, transform });
}

// ─── Groups ─────────────────────────────────────────────────────────────────

let groupCounter = 0;

function extractGroups(svg: string, allPaths: SvgPath[]): SvgGroup[] {
  groupCounter = 0;
  const groups: SvgGroup[] = [];
  const groupRegex = /<g\b([^>]*)>([\s\S]*?)<\/g>/gi;
  let m: RegExpExecArray | null;

  while ((m = groupRegex.exec(svg)) !== null) {
    const attrs = m[1];
    const inner = m[2];
    const id = extractAttr(attrs, 'id') || `group-${++groupCounter}`;
    const transform = extractAttr(attrs, 'transform') || undefined;

    // Find which paths are inside this group
    const children: SvgPath[] = [];
    const innerPathRegex = /<path\b([^>]*)\/?>/gi;
    let pm: RegExpExecArray | null;
    while ((pm = innerPathRegex.exec(inner)) !== null) {
      const pid = extractAttr(pm[1], 'id') || extractAttr(pm[1], 'd');
      const found = allPaths.find(
        (p) => p.id === pid || p.d === extractAttr(pm![1], 'd'),
      );
      if (found) children.push(found);
    }

    groups.push({ id, children, transform });
  }

  return groups;
}

// ─── Colors ─────────────────────────────────────────────────────────────────

function buildColorMap(paths: SvgPath[]): ColorMap {
  const map: ColorMap = {};
  for (const p of paths) {
    if (p.fill && p.fill !== 'none') map[p.id] = p.fill;
    else if (p.stroke && p.stroke !== 'none') map[p.id] = p.stroke;
  }
  return map;
}

// ─── Metadata ───────────────────────────────────────────────────────────────

function extractMetadata(svg: string): SvgMetadata {
  const xmlns = extractAttr(svg, 'xmlns') || 'http://www.w3.org/2000/svg';
  const width = extractNumericAttr(svg, 'width');
  const height = extractNumericAttr(svg, 'height');
  return { xmlns, width, height, originalSvg: svg };
}

// ─── Gradients ───────────────────────────────────────────────────────────────

function extractGradients(svg: string): GradientDef[] {
  const defs: GradientDef[] = [];

  const linearRe = /<linearGradient\b([^>]*)>([\s\S]*?)<\/linearGradient>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linearRe.exec(svg)) !== null) {
    const attrs = lm[1];
    const inner = lm[2];
    const id = extractAttr(attrs, 'id');
    if (!id) continue;

    const grad: LinearGradientDef = {
      type: 'linear',
      id,
      x1: parseFloat(extractAttr(attrs, 'x1') || '0'),
      y1: parseFloat(extractAttr(attrs, 'y1') || '0'),
      x2: parseFloat(extractAttr(attrs, 'x2') || '1'),
      y2: parseFloat(extractAttr(attrs, 'y2') || '0'),
      stops: parseStops(inner),
      gradientUnits: (extractAttr(attrs, 'gradientUnits') as 'userSpaceOnUse' | 'objectBoundingBox') || undefined,
      gradientTransform: extractAttr(attrs, 'gradientTransform') || undefined,
    };
    defs.push(grad);
  }

  const radialRe = /<radialGradient\b([^>]*)>([\s\S]*?)<\/radialGradient>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = radialRe.exec(svg)) !== null) {
    const attrs = rm[1];
    const inner = rm[2];
    const id = extractAttr(attrs, 'id');
    if (!id) continue;

    const grad: RadialGradientDef = {
      type: 'radial',
      id,
      cx: parseFloat(extractAttr(attrs, 'cx') || '0.5'),
      cy: parseFloat(extractAttr(attrs, 'cy') || '0.5'),
      r: parseFloat(extractAttr(attrs, 'r') || '0.5'),
      fx: extractAttr(attrs, 'fx') ? parseFloat(extractAttr(attrs, 'fx')!) : undefined,
      fy: extractAttr(attrs, 'fy') ? parseFloat(extractAttr(attrs, 'fy')!) : undefined,
      stops: parseStops(inner),
      gradientUnits: (extractAttr(attrs, 'gradientUnits') as 'userSpaceOnUse' | 'objectBoundingBox') || undefined,
      gradientTransform: extractAttr(attrs, 'gradientTransform') || undefined,
    };
    defs.push(grad);
  }

  return defs;
}

function parseStops(inner: string): GradientStop[] {
  const stops: GradientStop[] = [];
  const stopRe = /<stop\b([^>]*)\/?>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = stopRe.exec(inner)) !== null) {
    const attrs = sm[1];
    let offset = 0;
    const offsetStr = extractAttr(attrs, 'offset');
    if (offsetStr) {
      offset = offsetStr.includes('%') ? parseFloat(offsetStr) / 100 : parseFloat(offsetStr);
    }

    let color = extractAttr(attrs, 'stop-color') || '#000000';
    const opacityStr = extractAttr(attrs, 'stop-opacity');
    const opacity = opacityStr ? parseFloat(opacityStr) : undefined;

    const style = extractAttr(attrs, 'style');
    if (style) {
      const colorMatch = style.match(/stop-color:\s*([^;]+)/);
      if (colorMatch) color = colorMatch[1].trim();
      const opMatch = style.match(/stop-opacity:\s*([^;]+)/);
      if (opMatch && opacity === undefined) {
        stops.push({ offset, color, opacity: parseFloat(opMatch[1]) });
        continue;
      }
    }

    stops.push({ offset, color, opacity });
  }
  return stops;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractAttr(tag: string, name: string): string | null {
  // Handle both single and double quotes
  const re = new RegExp(`${name}=["']([^"']*)["']`, 'i');
  const m = tag.match(re);
  return m ? m[1] : null;
}
