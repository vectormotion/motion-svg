import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Bundle, PlaybackController } from '../types';
import { importBundle, getVariant, type ImportedBundle } from '../bundle/importBundle';
import { createPlayback } from '../trigger/playback';
import type { ActorState } from '../timeline/interpolate';
import type { Actor, Timeline, TriggerBinding } from '../types';
import { AnimationStore } from '../core/AnimationStore';

export interface MotionSvgInstance {
  /** The imported bundle data */
  data: ImportedBundle | null;
  /** Actors resolved for the active variant (or all actors if no variant set) */
  actors: Actor[];
  /** Timelines resolved for the active variant */
  timelines: Timeline[];
  /** Triggers resolved for the active variant */
  triggers: TriggerBinding[];
  /** Map of actorId → current interpolated state */
  actorStates: Record<string, ActorState>;
  /** Playback controllers for each timeline */
  controllers: PlaybackController[];
  /** The animation store instance (for use with useActorState) */
  store: AnimationStore;
  /** Play all timelines */
  play(): void;
  /** Pause all timelines */
  pause(): void;
  /** Stop all timelines (reset to start) */
  stop(): void;
  /** Seek all timelines to a given time */
  seek(timeMs: number): void;
  /** Is currently playing */
  playing: boolean;
  /** List of available variant names from the bundle */
  variantNames: string[];
}

export interface UseMotionSvgOptions {
  /** Named variant to activate — filters actors, timelines, triggers */
  variant?: string;
}

/**
 * React hook for controlling a motion-svg animation bundle.
 *
 * Accepts either a Bundle object or a JSON string.
 * Pass `options.variant` to only play a specific variant's actors/timelines/triggers.
 *
 * Uses an external AnimationStore + useSyncExternalStore to batch all actor
 * state updates into a single re-render per frame (instead of N setState per frame).
 */
export function useMotionSvg(
  bundle: Bundle | string | null,
  options?: UseMotionSvgOptions,
): MotionSvgInstance {
  const variantName = options?.variant;
  const [data, setData] = useState<ImportedBundle | null>(null);
  const [playing, setPlaying] = useState(false);
  const controllersRef = useRef<PlaybackController[]>([]);
  const storeRef = useRef(new AnimationStore());

  // Subscribe to the external store with useSyncExternalStore
  const actorStates = useSyncExternalStore(
    useCallback((cb) => storeRef.current.subscribe(cb), []),
    useCallback(() => storeRef.current.getSnapshot(), []),
  );

  // Import bundle (only when bundle source changes)
  useEffect(() => {
    if (!bundle) {
      setData(null);
      return;
    }
    try {
      const jsonStr = typeof bundle === 'string' ? bundle : JSON.stringify(bundle);
      const imported = importBundle(jsonStr);
      setData(imported);
    } catch (e) {
      console.error('motion-svg: Failed to import bundle', e);
    }
  }, [bundle]);

  // Resolve which actors/timelines/triggers to use based on variant
  const resolved = useMemo<{
    actors: Actor[];
    timelines: Timeline[];
    triggers: TriggerBinding[];
  } | null>(() => {
    if (!data) return null;
    if (variantName) {
      const v = getVariant(data, variantName);
      if (v) return v;
      // Variant not found — fall through to all
    }
    return {
      actors: data.actors,
      timelines: data.timelines,
      triggers: data.triggers,
    };
  }, [data, variantName]);

  // Build playback controllers whenever the resolved set changes
  useEffect(() => {
    // Stop any previous controllers
    controllersRef.current.forEach((c) => c.stop());
    controllersRef.current = [];

    if (!data || !resolved) {
      storeRef.current.reset({});
      setPlaying(false);
      return;
    }

    // Build initial states
    const initial: Record<string, ActorState> = {};
    for (const actor of resolved.actors) {
      initial[actor.id] = {
        position: { ...actor.origin },
        scale: 1,
        rotation: 0,
        opacity: 1,
      };
    }
    storeRef.current.reset(initial);

    // Create playback controllers — match triggers to timelines by timelineId
    const controllers = resolved.timelines.map((tl) => {
      const triggerBinding = resolved.triggers.find((t) => t.timelineId === tl.id);
      return createPlayback({
        timeline: tl,
        trigger: triggerBinding,
        gradients: data.scene.gradients,
        onUpdate: (state, _time) => {
          // Batched: store.set() accumulates updates, notifies once per frame via microtask
          storeRef.current.set(tl.actorId, state);
        },
        onComplete: () => {
          const allDone = controllersRef.current.every(
            (c) => c.state === 'finished' || c.state === 'idle',
          );
          if (allDone) setPlaying(false);
        },
      });
    });
    controllersRef.current = controllers;
    setPlaying(false);
  }, [data, resolved]);

  // Variant names for enumeration
  const variantNames = useMemo(
    () => (data ? data.variants.map((v) => v.name) : []),
    [data],
  );

  const play = useCallback(() => {
    controllersRef.current.forEach((c) => c.play());
    setPlaying(true);
  }, []);

  const pause = useCallback(() => {
    controllersRef.current.forEach((c) => c.pause());
    setPlaying(false);
  }, []);

  const stop = useCallback(() => {
    controllersRef.current.forEach((c) => c.stop());
    setPlaying(false);
  }, []);

  const seek = useCallback((timeMs: number) => {
    controllersRef.current.forEach((c) => c.seek(timeMs));
  }, []);

  return {
    data,
    actors: resolved?.actors ?? [],
    timelines: resolved?.timelines ?? [],
    triggers: resolved?.triggers ?? [],
    actorStates,
    controllers: controllersRef.current,
    store: storeRef.current,
    play,
    pause,
    stop,
    seek,
    playing,
    variantNames,
  };
}
