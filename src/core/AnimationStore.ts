import type { ActorState } from '../timeline/interpolate';

type Listener = () => void;

/**
 * External mutable store for actor animation states.
 *
 * Accumulates updates during a rAF frame and notifies subscribers
 * once per frame via a microtask batch. Designed for use with
 * `useSyncExternalStore` in React, but works without React too.
 */
export class AnimationStore {
  private _states: Record<string, ActorState> = {};
  private _listeners = new Set<Listener>();
  private _snapshot: Record<string, ActorState> = {};
  private _dirty = false;
  private _batchScheduled = false;

  /** Update a single actor's state — does NOT notify immediately */
  set(actorId: string, state: ActorState): void {
    this._states[actorId] = state;
    this._dirty = true;
    this._scheduleBatch();
  }

  /** Update multiple actors at once */
  setMany(updates: Record<string, ActorState>): void {
    Object.assign(this._states, updates);
    this._dirty = true;
    this._scheduleBatch();
  }

  /** Full reset (bundle/variant change) — flushes immediately */
  reset(initial: Record<string, ActorState>): void {
    this._states = { ...initial };
    this._dirty = true;
    this._flush();
  }

  /** Immutable snapshot for useSyncExternalStore */
  getSnapshot(): Record<string, ActorState> {
    return this._snapshot;
  }

  /** Single actor state — for granular selectors */
  getActorState(actorId: string): ActorState | undefined {
    return this._snapshot[actorId];
  }

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _scheduleBatch(): void {
    if (this._batchScheduled) return;
    this._batchScheduled = true;
    queueMicrotask(() => {
      this._batchScheduled = false;
      if (this._dirty) this._flush();
    });
  }

  private _flush(): void {
    this._snapshot = { ...this._states };
    this._dirty = false;
    this._listeners.forEach((l) => l());
  }
}
