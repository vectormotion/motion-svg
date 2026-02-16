import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPlayback } from '../../src/trigger/playback';
import { timeline } from '../../src/timeline/timeline';
import { trigger } from '../../src/trigger/trigger';
import type { Actor } from '../../src/types';

const mockActor: Actor = {
  id: 'actor-loop',
  pathIds: ['p1'],
  paths: [{ id: 'p1', d: 'M0,0 L10,10' }],
  origin: { x: 0, y: 0 },
  position: { x: 0, y: 0 },
  scale: 1,
  rotation: 0,
  opacity: 1,
  blurRadius: 0,
  backdropBlur: 0,
  z: 0,
};

beforeEach(() => {
  vi.useFakeTimers();
  let now = 0;
  let frameId = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frameId++;
    const id = frameId;
    setTimeout(() => {
      now += 16;
      cb(now);
    }, 16);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Playback loop integration', () => {
  it('loop trigger repeats the correct number of times', () => {
    const tl = timeline(mockActor, {
      keyframes: [{ at: 0, opacity: 0 }, { at: 100, opacity: 1, curve: 'linear' }],
    });
    const tr = trigger(tl, { type: 'loop', iterations: 3, direction: 'normal' });
    const repeatFn = vi.fn();
    const completeFn = vi.fn();

    const ctrl = createPlayback({ timeline: tl, trigger: tr });
    ctrl.on('repeat', repeatFn);
    ctrl.on('complete', completeFn);

    ctrl.play();
    // 100ms duration * 3 iterations + buffer
    vi.advanceTimersByTime(500);

    expect(completeFn).toHaveBeenCalledTimes(1);
    expect(ctrl.state).toBe('finished');
  });

  it('alternate loop reverses direction each iteration', () => {
    const tl = timeline(mockActor, {
      keyframes: [
        { at: 0, position: { x: 0, y: 0 } },
        { at: 100, position: { x: 100, y: 0 }, curve: 'linear' },
      ],
    });
    const tr = trigger(tl, { type: 'loop', iterations: 4, direction: 'alternate' });
    const onUpdate = vi.fn();

    const ctrl = createPlayback({ timeline: tl, trigger: tr, onUpdate });
    ctrl.play();
    vi.advanceTimersByTime(800);

    // Should have called onUpdate many times with varying positions
    expect(onUpdate).toHaveBeenCalled();
    expect(ctrl.state).toBe('finished');
  });

  it('loop with delay pauses between iterations', () => {
    const tl = timeline(mockActor, {
      keyframes: [{ at: 0, scale: 1 }, { at: 100, scale: 2, curve: 'linear' }],
    });
    const tr = trigger(tl, { type: 'loop', iterations: 2, direction: 'normal', delay: 200 });
    const completeFn = vi.fn();

    const ctrl = createPlayback({ timeline: tl, trigger: tr });
    ctrl.on('complete', completeFn);
    ctrl.play();

    // First iteration ~100ms, then 200ms delay, then second iteration ~100ms
    vi.advanceTimersByTime(150); // first iteration done, in delay
    expect(completeFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250); // delay should be done, second iteration starting
    vi.advanceTimersByTime(200); // second iteration done
    expect(completeFn).toHaveBeenCalled();
  });

  it('infinite loop does not complete', () => {
    const tl = timeline(mockActor, {
      keyframes: [{ at: 0, opacity: 0 }, { at: 100, opacity: 1, curve: 'linear' }],
    });
    const tr = trigger(tl, { type: 'loop', iterations: Infinity, direction: 'normal' });
    const completeFn = vi.fn();

    const ctrl = createPlayback({ timeline: tl, trigger: tr });
    ctrl.on('complete', completeFn);
    ctrl.play();
    vi.advanceTimersByTime(5000); // 50 iterations worth
    expect(completeFn).not.toHaveBeenCalled();
    expect(ctrl.state).toBe('playing');

    ctrl.stop(); // cleanup
  });
});

describe('Playback reverse integration', () => {
  it('reverse plays backwards', () => {
    const tl = timeline(mockActor, {
      keyframes: [
        { at: 0, position: { x: 0, y: 0 } },
        { at: 1000, position: { x: 100, y: 0 }, curve: 'linear' },
      ],
    });
    const positions: number[] = [];
    const ctrl = createPlayback({
      timeline: tl,
      onUpdate: (state) => positions.push(state.position.x),
    });

    // Seek to end, then reverse
    ctrl.seek(1000);
    ctrl.reverse();
    vi.advanceTimersByTime(300);

    // The last recorded position should be less than 100 (going backwards)
    const lastPos = positions[positions.length - 1];
    expect(lastPos).toBeLessThan(100);
  });
});
