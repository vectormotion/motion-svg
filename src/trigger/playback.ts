import type {
  Timeline,
  PlaybackState,
  PlaybackController,
  PlaybackEventType,
  PlaybackEvent,
  PlaybackEventHandler,
  TriggerBinding,
  GradientDef,
} from '../types';
import { getActorStateAtTime, type ActorState } from '../timeline/interpolate';

interface PlaybackOptions {
  timeline: Timeline;
  trigger?: TriggerBinding;
  /** Gradient definitions available for interpolation */
  gradients?: GradientDef[];
  onUpdate?: (state: ActorState, timeMs: number) => void;
  onComplete?: () => void;
  /** Initial playback rate (default: 1) */
  initialRate?: number;
}

/**
 * Create a playback controller for a timeline.
 *
 * This is the runtime engine that drives the animation frame-by-frame
 * using requestAnimationFrame.
 */
export function createPlayback(options: PlaybackOptions): PlaybackController {
  const { timeline: tl, trigger: triggerBinding, gradients, onUpdate, onComplete, initialRate } = options;

  let state: PlaybackState = 'idle';
  let currentTime = 0;
  let direction: 1 | -1 = 1;
  let _playbackRate = initialRate ?? 1;
  let _totalDuration = tl.duration;
  let rafId: number | null = null;
  let lastFrameTime: number | null = null;
  let iterationCount = 0;
  let hasStarted = false;

  // Event system
  const eventHandlers = new Map<PlaybackEventType, Set<PlaybackEventHandler>>();

  function emit(type: PlaybackEventType, extra?: Partial<PlaybackEvent>): void {
    const handlers = eventHandlers.get(type);
    if (!handlers || handlers.size === 0) return;
    const event: PlaybackEvent = {
      type,
      currentTime,
      progress: _totalDuration > 0 ? currentTime / _totalDuration : 0,
      playbackRate: _playbackRate,
      ...extra,
    };
    handlers.forEach((h) => h(event));
  }

  // Trigger config
  const triggerType = triggerBinding?.config.type ?? 'manual';
  const loopIterations =
    triggerType === 'loop' && triggerBinding?.config.type === 'loop'
      ? triggerBinding.config.iterations ?? Infinity
      : 1;
  const loopDirection =
    triggerType === 'loop' && triggerBinding?.config.type === 'loop'
      ? triggerBinding.config.direction ?? 'normal'
      : 'normal';
  const loopDelay =
    triggerType === 'loop' && triggerBinding?.config.type === 'loop'
      ? triggerBinding.config.delay ?? 0
      : 0;

  function tick(now: number) {
    if (state !== 'playing') return;
    if (lastFrameTime === null) {
      lastFrameTime = now;
      rafId = requestAnimationFrame(tick);
      return;
    }

    const rawDelta = now - lastFrameTime;
    const delta = rawDelta * direction * Math.abs(_playbackRate);
    lastFrameTime = now;
    currentTime += delta;

    // Time stretching: map currentTime onto the real timeline duration
    const timeScale = tl.duration / _totalDuration;

    // Check upper bound
    if (currentTime >= _totalDuration) {
      currentTime = _totalDuration;
      emitUpdate(tl.duration);
      emit('frame');
      iterationCount++;

      if (iterationCount >= loopIterations) {
        state = 'finished';
        emit('complete');
        onComplete?.();
        return;
      }

      emit('repeat', { iteration: iterationCount });

      // Handle loop direction
      if (loopDirection === 'alternate') {
        direction = -1;
        currentTime = _totalDuration;
      } else if (loopDirection === 'reverse') {
        currentTime = _totalDuration;
        direction = -1;
      } else {
        currentTime = 0;
      }

      if (loopDelay > 0) {
        state = 'paused';
        setTimeout(() => {
          if (state === 'paused') {
            state = 'playing';
            lastFrameTime = null;
            rafId = requestAnimationFrame(tick);
          }
        }, loopDelay);
        return;
      }
    } else if (currentTime <= 0) {
      currentTime = 0;
      emitUpdate(0);
      emit('frame');
      iterationCount++;

      if (iterationCount >= loopIterations) {
        state = 'finished';
        emit('complete');
        onComplete?.();
        return;
      }

      emit('repeat', { iteration: iterationCount });

      if (loopDirection === 'alternate') {
        direction = 1;
        currentTime = 0;
      }
    } else {
      const mappedTime = Math.min(currentTime * timeScale, tl.duration);
      emitUpdate(mappedTime);
      emit('frame');
    }

    rafId = requestAnimationFrame(tick);
  }

  function emitUpdate(timeMs: number) {
    const actorState = getActorStateAtTime(tl, timeMs, { gradients });
    onUpdate?.(actorState, timeMs);
  }

  const controller: PlaybackController = {
    play() {
      const wasIdle = state === 'idle' || state === 'finished';
      if (state === 'finished') {
        currentTime = direction === 1 ? 0 : _totalDuration;
        iterationCount = 0;
      }
      state = 'playing';
      direction = 1;
      lastFrameTime = null;

      if (!hasStarted || wasIdle) {
        hasStarted = true;
        emit('start');
      }
      emit('play');

      rafId = requestAnimationFrame(tick);
    },

    pause() {
      state = 'paused';
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      lastFrameTime = null;
      emit('pause');
    },

    stop() {
      state = 'idle';
      currentTime = 0;
      direction = 1;
      iterationCount = 0;
      hasStarted = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      lastFrameTime = null;
      emitUpdate(0);
      emit('stop');
    },

    seek(timeMs: number) {
      currentTime = Math.max(0, Math.min(timeMs, _totalDuration));
      const timeScale = tl.duration / _totalDuration;
      emitUpdate(Math.min(currentTime * timeScale, tl.duration));
      emit('seek');
    },

    reverse() {
      direction = direction === 1 ? -1 : 1;
      if (state !== 'playing') {
        state = 'playing';
        lastFrameTime = null;
        rafId = requestAnimationFrame(tick);
      }
      emit('reverse');
    },

    get state() {
      return state;
    },

    get currentTime() {
      return currentTime;
    },

    get duration() {
      return _totalDuration;
    },

    get progress() {
      return _totalDuration > 0 ? currentTime / _totalDuration : 0;
    },

    get playbackRate() {
      return _playbackRate;
    },

    set playbackRate(rate: number) {
      _playbackRate = rate;
    },

    get totalDuration() {
      return _totalDuration;
    },

    set totalDuration(d: number) {
      const progress = _totalDuration > 0 ? currentTime / _totalDuration : 0;
      _totalDuration = Math.max(0, d);
      currentTime = progress * _totalDuration;
    },

    on(type: PlaybackEventType, handler: PlaybackEventHandler) {
      if (!eventHandlers.has(type)) eventHandlers.set(type, new Set());
      eventHandlers.get(type)!.add(handler);
      return () => eventHandlers.get(type)?.delete(handler);
    },

    off(type: PlaybackEventType, handler: PlaybackEventHandler) {
      eventHandlers.get(type)?.delete(handler);
    },
  };

  return controller;
}
