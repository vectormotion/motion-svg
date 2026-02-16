import { useSyncExternalStore, useCallback } from 'react';
import type { AnimationStore } from '../core/AnimationStore';
import type { ActorState } from '../timeline/interpolate';

/**
 * Granular selector for a single actor's animation state.
 *
 * Re-renders ONLY when the specified actor's state changes,
 * making it ideal for scenes with many actors where only a
 * few need to trigger component updates.
 *
 * @param store - The AnimationStore instance (from `useMotionSvg().store`)
 * @param actorId - The actor ID to subscribe to
 */
export function useActorState(store: AnimationStore, actorId: string): ActorState | undefined {
  return useSyncExternalStore(
    useCallback((cb) => store.subscribe(cb), [store]),
    useCallback(() => store.getActorState(actorId), [store, actorId]),
  );
}
