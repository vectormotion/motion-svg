import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPlayback } from '../../src/trigger/playback';
import type { Timeline } from '../../src/types';

// Mock rAF for deterministic tests
beforeEach(() => {
  vi.useFakeTimers();
  let frameId = 0;
  let now = 0;
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

const mockTimeline: Timeline = {
  id: 'tl-test-1',
  actorId: 'actor-1',
  keyframes: [
    { at: 0, position: { x: 0, y: 0 }, scale: 1, rotation: 0, opacity: 1 },
    { at: 1000, position: { x: 100, y: 0 }, scale: 1, rotation: 0, opacity: 1, curve: 'linear' },
  ],
  duration: 1000,
};

describe('PlaybackController', () => {
  it('starts in idle state', () => {
    const ctrl = createPlayback({ timeline: mockTimeline });
    expect(ctrl.state).toBe('idle');
    expect(ctrl.currentTime).toBe(0);
    expect(ctrl.progress).toBe(0);
  });

  it('state machine: idle → playing → paused → playing', () => {
    const ctrl = createPlayback({ timeline: mockTimeline });
    expect(ctrl.state).toBe('idle');
    ctrl.play();
    expect(ctrl.state).toBe('playing');
    ctrl.pause();
    expect(ctrl.state).toBe('paused');
    ctrl.play();
    expect(ctrl.state).toBe('playing');
  });

  it('stop resets to idle and time 0', () => {
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.play();
    vi.advanceTimersByTime(200);
    ctrl.stop();
    expect(ctrl.state).toBe('idle');
    expect(ctrl.currentTime).toBe(0);
  });

  it('seek updates currentTime and progress', () => {
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.seek(500);
    expect(ctrl.currentTime).toBe(500);
    expect(ctrl.progress).toBeCloseTo(0.5, 2);
  });

  it('seek clamps to bounds', () => {
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.seek(-100);
    expect(ctrl.currentTime).toBe(0);
    ctrl.seek(9999);
    expect(ctrl.currentTime).toBe(1000);
  });

  it('calls onUpdate during playback', () => {
    const onUpdate = vi.fn();
    const ctrl = createPlayback({ timeline: mockTimeline, onUpdate });
    ctrl.play();
    vi.advanceTimersByTime(100);
    expect(onUpdate).toHaveBeenCalled();
  });

  it('calls onComplete when animation finishes', () => {
    const onComplete = vi.fn();
    const ctrl = createPlayback({ timeline: mockTimeline, onComplete });
    ctrl.play();
    vi.advanceTimersByTime(1200);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(ctrl.state).toBe('finished');
  });

  it('duration returns totalDuration', () => {
    const ctrl = createPlayback({ timeline: mockTimeline });
    expect(ctrl.duration).toBe(1000);
  });
});

describe('playbackRate', () => {
  it('defaults to 1', () => {
    const ctrl = createPlayback({ timeline: mockTimeline });
    expect(ctrl.playbackRate).toBe(1);
  });

  it('can be set via initialRate option', () => {
    const ctrl = createPlayback({ timeline: mockTimeline, initialRate: 0.5 });
    expect(ctrl.playbackRate).toBe(0.5);
  });

  it('can be changed at runtime', () => {
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.playbackRate = 2;
    expect(ctrl.playbackRate).toBe(2);
  });

  it('rate 2 makes animation complete in ~half time', () => {
    const onComplete = vi.fn();
    const ctrl = createPlayback({ timeline: mockTimeline, onComplete });
    ctrl.playbackRate = 2;
    ctrl.play();
    vi.advanceTimersByTime(600);
    expect(onComplete).toHaveBeenCalled();
  });
});

describe('totalDuration (time stretching)', () => {
  it('defaults to timeline duration', () => {
    const ctrl = createPlayback({ timeline: mockTimeline });
    expect(ctrl.totalDuration).toBe(1000);
  });

  it('stretching: totalDuration = 2000 makes it play over 2 seconds', () => {
    const onComplete = vi.fn();
    const ctrl = createPlayback({ timeline: mockTimeline, onComplete });
    ctrl.totalDuration = 2000;
    ctrl.play();
    vi.advanceTimersByTime(1200);
    expect(onComplete).not.toHaveBeenCalled(); // still playing at 1.2s
    expect(ctrl.progress).toBeLessThan(1);
    vi.advanceTimersByTime(1000);
    expect(onComplete).toHaveBeenCalled();
  });

  it('preserves relative position when changing totalDuration', () => {
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.seek(500); // 50% of 1000
    ctrl.totalDuration = 2000;
    expect(ctrl.currentTime).toBeCloseTo(1000, 0); // 50% of 2000
    expect(ctrl.progress).toBeCloseTo(0.5, 2);
  });
});

describe('progress', () => {
  it('is 0 at start', () => {
    const ctrl = createPlayback({ timeline: mockTimeline });
    expect(ctrl.progress).toBe(0);
  });

  it('is 1 at end', () => {
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.seek(1000);
    expect(ctrl.progress).toBeCloseTo(1, 2);
  });

  it('is 0.5 at midpoint', () => {
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.seek(500);
    expect(ctrl.progress).toBeCloseTo(0.5, 2);
  });
});

describe('event system', () => {
  it('emits start and play on first play()', () => {
    const startFn = vi.fn();
    const playFn = vi.fn();
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.on('start', startFn);
    ctrl.on('play', playFn);
    ctrl.play();
    expect(startFn).toHaveBeenCalledTimes(1);
    expect(playFn).toHaveBeenCalledTimes(1);
  });

  it('emits pause on pause()', () => {
    const pauseFn = vi.fn();
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.on('pause', pauseFn);
    ctrl.play();
    ctrl.pause();
    expect(pauseFn).toHaveBeenCalledTimes(1);
  });

  it('emits stop on stop()', () => {
    const stopFn = vi.fn();
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.on('stop', stopFn);
    ctrl.play();
    ctrl.stop();
    expect(stopFn).toHaveBeenCalledTimes(1);
  });

  it('emits seek on seek()', () => {
    const seekFn = vi.fn();
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.on('seek', seekFn);
    ctrl.seek(500);
    expect(seekFn).toHaveBeenCalledTimes(1);
    expect(seekFn.mock.calls[0][0].currentTime).toBe(500);
  });

  it('emits reverse on reverse()', () => {
    const reverseFn = vi.fn();
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.on('reverse', reverseFn);
    ctrl.reverse();
    expect(reverseFn).toHaveBeenCalledTimes(1);
  });

  it('emits complete at end of animation', () => {
    const completeFn = vi.fn();
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.on('complete', completeFn);
    ctrl.play();
    vi.advanceTimersByTime(1200);
    expect(completeFn).toHaveBeenCalledTimes(1);
  });

  it('emits frame events during playback', () => {
    const frameFn = vi.fn();
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.on('frame', frameFn);
    ctrl.play();
    vi.advanceTimersByTime(100);
    expect(frameFn.mock.calls.length).toBeGreaterThan(0);
  });

  it('event payload contains currentTime, progress, playbackRate', () => {
    const seekFn = vi.fn();
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.playbackRate = 1.5;
    ctrl.on('seek', seekFn);
    ctrl.seek(500);
    const event = seekFn.mock.calls[0][0];
    expect(event.type).toBe('seek');
    expect(event.currentTime).toBe(500);
    expect(event.progress).toBeCloseTo(0.5, 2);
    expect(event.playbackRate).toBe(1.5);
  });

  it('on() returns unsubscribe function', () => {
    const fn = vi.fn();
    const ctrl = createPlayback({ timeline: mockTimeline });
    const unsub = ctrl.on('play', fn);
    ctrl.play();
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    ctrl.stop();
    ctrl.play();
    expect(fn).toHaveBeenCalledTimes(1); // no additional call
  });

  it('off() removes handler', () => {
    const fn = vi.fn();
    const ctrl = createPlayback({ timeline: mockTimeline });
    ctrl.on('play', fn);
    ctrl.play();
    expect(fn).toHaveBeenCalledTimes(1);
    ctrl.off('play', fn);
    ctrl.stop();
    ctrl.play();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
