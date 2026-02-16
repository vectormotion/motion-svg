import { describe, it, expect } from 'vitest';
import { createActor } from '../../src/actor/createActor';
import type { SvgPath } from '../../src/types';

const mockPath: SvgPath = { id: 'path-a', d: 'M0,0 L10,10' };
const mockPath2: SvgPath = { id: 'path-b', d: 'M5,5 L15,15', fill: '#FF0000' };

describe('createActor', () => {
  it('creates an actor with required fields', () => {
    const actor = createActor({ id: 'hero', paths: [mockPath], origin: { x: 50, y: 50 } });
    expect(actor.id).toBe('hero');
    expect(actor.pathIds).toEqual(['path-a']);
    expect(actor.paths).toHaveLength(1);
    expect(actor.origin).toEqual({ x: 50, y: 50 });
    expect(actor.position).toEqual({ x: 50, y: 50 });
  });

  it('sets default values', () => {
    const actor = createActor({ id: 'a', paths: [mockPath], origin: { x: 0, y: 0 } });
    expect(actor.scale).toBe(1);
    expect(actor.rotation).toBe(0);
    expect(actor.opacity).toBe(1);
    expect(actor.blurRadius).toBe(0);
    expect(actor.backdropBlur).toBe(0);
    expect(actor.z).toBe(0);
  });

  it('preserves z-order', () => {
    const actor = createActor({ id: 'a', paths: [mockPath], origin: { x: 0, y: 0 }, z: 5 });
    expect(actor.z).toBe(5);
  });

  it('handles multiple paths', () => {
    const actor = createActor({ id: 'multi', paths: [mockPath, mockPath2], origin: { x: 0, y: 0 } });
    expect(actor.pathIds).toEqual(['path-a', 'path-b']);
    expect(actor.paths).toHaveLength(2);
  });

  it('throws when no paths provided', () => {
    expect(() => createActor({ id: 'empty', paths: [], origin: { x: 0, y: 0 } })).toThrow(
      'requires at least one path',
    );
  });

  it('copies origin (no reference sharing)', () => {
    const origin = { x: 10, y: 20 };
    const actor = createActor({ id: 'a', paths: [mockPath], origin });
    origin.x = 999;
    expect(actor.origin.x).toBe(10);
    expect(actor.position.x).toBe(10);
  });
});
