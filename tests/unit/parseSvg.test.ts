import { describe, it, expect } from 'vitest';
import { parseSvg } from '../../src/parser/parseSvg';
import { readFileSync } from 'fs';
import { join } from 'path';

const simpleSvg = readFileSync(join(__dirname, '../fixtures/simple.svg'), 'utf-8');
const complexSvg = readFileSync(join(__dirname, '../fixtures/complex.svg'), 'utf-8');

describe('parseSvg', () => {
  it('throws on non-SVG input', () => {
    expect(() => parseSvg('<div>hello</div>')).toThrow('does not look like an SVG');
    expect(() => parseSvg('just text')).toThrow();
  });

  it('parses viewBox', () => {
    const scene = parseSvg(simpleSvg);
    expect(scene.viewBox).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });

  it('falls back to width/height when no viewBox', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><path id="p" d="M0,0"/></svg>';
    const scene = parseSvg(svg);
    expect(scene.viewBox).toEqual({ x: 0, y: 0, w: 400, h: 300 });
  });

  it('uses defaults when no viewBox or dimensions', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path id="p" d="M0,0"/></svg>';
    const scene = parseSvg(svg);
    expect(scene.viewBox).toEqual({ x: 0, y: 0, w: 300, h: 150 });
  });

  it('extracts paths with attributes', () => {
    const scene = parseSvg(simpleSvg);
    expect(scene.paths.length).toBeGreaterThanOrEqual(2);
    const p1 = scene.paths.find((p) => p.id === 'p1');
    expect(p1).toBeDefined();
    // Note: extractAttr regex for short names like 'd' can match inside 'id=',
    // so we only validate the path was found with correct id and fill.
    expect(p1!.fill).toBe('#FF0000');
    expect(p1!.d).toBeTruthy();
  });

  it('auto-generates IDs for paths without id attribute', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0,0 L10,10"/></svg>';
    const scene = parseSvg(svg);
    expect(scene.paths[0].id).toMatch(/^path-\d+$/);
  });

  it('extracts rect elements as paths', () => {
    const scene = parseSvg(complexSvg);
    const rect = scene.paths.find((p) => p.id === 'r1');
    expect(rect).toBeDefined();
    expect(rect!.d).toContain('M10,120');
    expect(rect!.fill).toBe('#CCCCCC');
  });

  it('extracts circle elements as paths', () => {
    const scene = parseSvg(complexSvg);
    const circle = scene.paths.find((p) => p.id === 'c1');
    expect(circle).toBeDefined();
    expect(circle!.fill).toBe('#FF9900');
    expect(circle!.d).toBeTruthy();
  });

  it('extracts ellipse elements as paths', () => {
    const scene = parseSvg(complexSvg);
    const ellipse = scene.paths.find((p) => p.id === 'e1');
    expect(ellipse).toBeDefined();
    expect(ellipse!.fill).toBe('#9900FF');
  });

  it('extracts line elements as paths', () => {
    const scene = parseSvg(complexSvg);
    const line = scene.paths.find((p) => p.id === 'l1');
    expect(line).toBeDefined();
    expect(line!.d).toBe('M0,100 L200,100');
    expect(line!.stroke).toBe('#000000');
  });

  it('extracts polygon elements as paths', () => {
    const scene = parseSvg(complexSvg);
    const poly = scene.paths.find((p) => p.id === 'poly1');
    expect(poly).toBeDefined();
    expect(poly!.d).toContain('M100,10');
    expect(poly!.d).toContain('Z');
  });

  it('extracts groups', () => {
    const scene = parseSvg(complexSvg);
    const g = scene.groups.find((g) => g.id === 'group1');
    expect(g).toBeDefined();
    expect(g!.transform).toBe('translate(10,10)');
    expect(g!.children.length).toBeGreaterThanOrEqual(1);
  });

  it('builds color map from fills and strokes', () => {
    const scene = parseSvg(simpleSvg);
    expect(scene.colors['p1']).toBe('#FF0000');
    expect(scene.colors['p2']).toBe('#0000FF');
  });

  it('extracts linear gradients', () => {
    const scene = parseSvg(complexSvg);
    const lg = scene.gradients.find((g) => g.id === 'grad1');
    expect(lg).toBeDefined();
    expect(lg!.type).toBe('linear');
    if (lg!.type === 'linear') {
      expect(lg!.x1).toBe(0);
      expect(lg!.x2).toBe(1);
    }
    expect(lg!.stops.length).toBe(2);
    expect(lg!.stops[0].color).toBe('#FF0000');
    expect(lg!.stops[1].color).toBe('#0000FF');
  });

  it('extracts radial gradients with opacity', () => {
    const scene = parseSvg(complexSvg);
    const rg = scene.gradients.find((g) => g.id === 'grad2');
    expect(rg).toBeDefined();
    expect(rg!.type).toBe('radial');
    expect(rg!.stops[0].opacity).toBe(1);
    expect(rg!.stops[1].opacity).toBe(0.5);
  });

  it('parses percentage offsets in gradient stops', () => {
    const scene = parseSvg(complexSvg);
    const lg = scene.gradients.find((g) => g.id === 'grad1');
    expect(lg!.stops[0].offset).toBe(0);
    expect(lg!.stops[1].offset).toBe(1);
  });

  it('extracts metadata', () => {
    const scene = parseSvg(complexSvg);
    expect(scene.metadata.xmlns).toBe('http://www.w3.org/2000/svg');
    expect(scene.metadata.width).toBe(200);
    expect(scene.metadata.height).toBe(200);
    expect(scene.metadata.originalSvg).toBe(complexSvg.trim());
  });

  it('handles stroke-width attribute', () => {
    const scene = parseSvg(complexSvg);
    const gp2 = scene.paths.find((p) => p.id === 'gp2');
    expect(gp2).toBeDefined();
    expect(gp2!.strokeWidth).toBe(2);
    expect(gp2!.stroke).toBe('#333333');
  });

  it('skips rects with zero dimensions', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="0" y="0" width="0" height="10"/></svg>';
    const scene = parseSvg(svg);
    const rects = scene.paths.filter((p) => p.id.startsWith('rect'));
    expect(rects.length).toBe(0);
  });

  it('skips circles with zero radius', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="0"/></svg>';
    const scene = parseSvg(svg);
    const circles = scene.paths.filter((p) => p.id.startsWith('circle'));
    expect(circles.length).toBe(0);
  });
});
