// DOM stubs MUST be imported before the component
import './dom-stubs';

import { describe, it, expect, vi } from 'vitest';
import { MotionSvgElement, registerMotionSvg } from '../../src/vanilla/MotionSvgElement';

describe('MotionSvgElement', () => {
  it('class exists and extends HTMLElement', () => {
    expect(MotionSvgElement).toBeDefined();
    expect(MotionSvgElement.prototype).toBeInstanceOf(HTMLElement);
  });

  it('has correct observed attributes', () => {
    expect(MotionSvgElement.observedAttributes).toEqual([
      'src', 'data', 'variant', 'autoplay', 'width', 'height',
    ]);
  });

  it('exposes play/pause/stop/seek methods', () => {
    const el = new MotionSvgElement();
    expect(typeof el.play).toBe('function');
    expect(typeof el.pause).toBe('function');
    expect(typeof el.stop).toBe('function');
    expect(typeof el.seek).toBe('function');
  });

  it('controllers starts empty', () => {
    const el = new MotionSvgElement();
    expect(el.controllers).toEqual([]);
  });

  it('variant getter/setter works', () => {
    const el = new MotionSvgElement();
    expect(el.variant).toBeUndefined();
    el.variant = 'dark';
    expect(el.variant).toBe('dark');
    el.variant = undefined;
    expect(el.variant).toBeUndefined();
  });

  it('play/pause/stop/seek do not throw when no controllers', () => {
    const el = new MotionSvgElement();
    expect(() => el.play()).not.toThrow();
    expect(() => el.pause()).not.toThrow();
    expect(() => el.stop()).not.toThrow();
    expect(() => el.seek(100)).not.toThrow();
  });

  it('bundle setter accepts JSON string', () => {
    const el = new MotionSvgElement();
    // Simulate connectedCallback to attach shadow
    el.connectedCallback();

    const bundle = JSON.stringify({
      version: 1,
      scene: {
        viewBox: { x: 0, y: 0, w: 100, h: 100 },
        paths: [],
        gradients: [],
      },
      actors: [],
      timelines: [],
      triggers: [],
    });

    expect(() => {
      el.bundle = bundle;
    }).not.toThrow();
  });

  it('bundle setter accepts object', () => {
    const el = new MotionSvgElement();
    el.connectedCallback();

    const bundle = {
      version: 1,
      scene: {
        viewBox: { x: 0, y: 0, w: 100, h: 100 },
        paths: [],
        gradients: [],
      },
      actors: [],
      timelines: [],
      triggers: [],
    };

    expect(() => {
      el.bundle = bundle;
    }).not.toThrow();
  });

  it('disconnectedCallback stops controllers', () => {
    const el = new MotionSvgElement();
    const mockStop = vi.fn();
    (el as any)._controllers = [{ stop: mockStop }, { stop: mockStop }];

    el.disconnectedCallback();

    expect(mockStop).toHaveBeenCalledTimes(2);
    expect(el.controllers).toEqual([]);
  });

  it('play dispatches motionsvg:play event', () => {
    const el = new MotionSvgElement();
    const spy = vi.spyOn(el, 'dispatchEvent');
    el.play();
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0][0] as any).type).toBe('motionsvg:play');
  });

  it('bundle setter dispatches motionsvg:ready event', () => {
    const el = new MotionSvgElement();
    el.connectedCallback();
    const spy = vi.spyOn(el, 'dispatchEvent');

    el.bundle = JSON.stringify({
      version: 1,
      scene: {
        viewBox: { x: 0, y: 0, w: 100, h: 100 },
        paths: [],
        gradients: [],
      },
      actors: [],
      timelines: [],
      triggers: [],
    });

    const events = spy.mock.calls.map((c) => (c[0] as any).type);
    expect(events).toContain('motionsvg:ready');
  });

  it('play/pause/stop/seek forward to controllers', () => {
    const el = new MotionSvgElement();
    const mockPlay = vi.fn();
    const mockPause = vi.fn();
    const mockStop = vi.fn();
    const mockSeek = vi.fn();

    (el as any)._controllers = [
      { play: mockPlay, pause: mockPause, stop: mockStop, seek: mockSeek },
    ];

    el.play();
    el.pause();
    el.stop();
    el.seek(500);

    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockSeek).toHaveBeenCalledWith(500);
  });
});

describe('registerMotionSvg', () => {
  it('registers with default tag name', () => {
    registerMotionSvg();
    expect(customElements.get('motion-svg')).toBe(MotionSvgElement);
  });

  it('registers with custom tag name', () => {
    registerMotionSvg('my-svg-player');
    expect(customElements.get('my-svg-player')).toBe(MotionSvgElement);
  });

  it('does not re-register if already defined', () => {
    expect(() => registerMotionSvg('motion-svg')).not.toThrow();
  });
});
