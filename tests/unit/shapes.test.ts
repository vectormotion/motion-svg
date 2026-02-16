import { describe, it, expect } from 'vitest';
import { generateShapePath } from '../../src/actor/shapes';

describe('generateShapePath', () => {
  describe('rect', () => {
    it('generates a rectangle path', () => {
      const d = generateShapePath('rect', 100, 50);
      expect(d).toBe('M 0 0 H 100 V 50 H 0 Z');
    });

    it('clamps negative dimensions to zero', () => {
      const d = generateShapePath('rect', -10, -5);
      expect(d).toBe('M 0 0 H 0 V 0 H 0 Z');
    });
  });

  describe('ellipse', () => {
    it('generates an ellipse path with cubic bezier arcs', () => {
      const d = generateShapePath('ellipse', 100, 80);
      expect(d).toContain('M 50');
      expect(d).toContain('C ');
      expect(d).toContain('Z');
    });
  });

  describe('line', () => {
    it('generates a horizontal line at midpoint', () => {
      const d = generateShapePath('line', 100, 50);
      expect(d).toBe('M 0 25 L 100 25');
    });
  });

  describe('arrow', () => {
    it('generates a line with arrowhead', () => {
      const d = generateShapePath('arrow', 100, 50);
      expect(d).toContain('M 0 25');
      expect(d).toContain('L 100 25');
    });

    it('respects custom arrowSize', () => {
      const d = generateShapePath('arrow', 100, 50, { arrowSize: 20 });
      expect(d).toContain('M 80');
    });
  });

  describe('polygon', () => {
    it('generates a pentagon by default', () => {
      const d = generateShapePath('polygon', 100, 100);
      // 5 sides = M + 4 L + Z = 6 parts
      const parts = d.split(/[ML]\s/).filter(Boolean);
      expect(parts.length).toBe(5);
      expect(d).toContain('Z');
    });

    it('generates a triangle with sides=3', () => {
      const d = generateShapePath('polygon', 100, 100, { sides: 3 });
      const mCount = (d.match(/M /g) || []).length;
      const lCount = (d.match(/L /g) || []).length;
      expect(mCount).toBe(1);
      expect(lCount).toBe(2);
    });

    it('enforces minimum 3 sides', () => {
      const d = generateShapePath('polygon', 100, 100, { sides: 1 });
      const mCount = (d.match(/M /g) || []).length;
      const lCount = (d.match(/L /g) || []).length;
      expect(mCount).toBe(1);
      expect(lCount).toBe(2); // 3 sides
    });

    it('generates a hexagon with sides=6', () => {
      const d = generateShapePath('polygon', 100, 100, { sides: 6 });
      const lCount = (d.match(/L /g) || []).length;
      expect(lCount).toBe(5);
    });
  });

  describe('unknown type', () => {
    it('falls back to rect', () => {
      const d = generateShapePath('rect', 50, 30);
      const unknown = generateShapePath('unknown' as any, 50, 30);
      expect(unknown).toBe(d);
    });
  });
});
