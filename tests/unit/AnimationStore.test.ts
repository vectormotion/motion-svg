import { describe, it, expect, vi } from 'vitest';
import { AnimationStore } from '../../src/core/AnimationStore';
import type { ActorState } from '../../src/timeline/interpolate';

function makeState(x: number): ActorState {
  return { position: { x, y: 0 }, scale: 1, rotation: 0, opacity: 1 };
}

describe('AnimationStore', () => {
  it('initial snapshot is empty', () => {
    const store = new AnimationStore();
    expect(store.getSnapshot()).toEqual({});
  });

  it('reset flushes immediately', () => {
    const store = new AnimationStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.reset({ a: makeState(10) });
    expect(store.getSnapshot()).toEqual({ a: makeState(10) });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('set batches updates via microtask', async () => {
    const store = new AnimationStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.set('a', makeState(1));
    store.set('b', makeState(2));
    store.set('c', makeState(3));

    // Not flushed yet synchronously
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toEqual({});

    // Flush via microtask
    await Promise.resolve();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({
      a: makeState(1),
      b: makeState(2),
      c: makeState(3),
    });
  });

  it('setMany batches multiple actors', async () => {
    const store = new AnimationStore();
    store.setMany({ x: makeState(10), y: makeState(20) });
    await Promise.resolve();
    expect(store.getSnapshot()).toEqual({ x: makeState(10), y: makeState(20) });
  });

  it('getActorState returns single actor from snapshot', () => {
    const store = new AnimationStore();
    store.reset({ a: makeState(42), b: makeState(99) });
    expect(store.getActorState('a')).toEqual(makeState(42));
    expect(store.getActorState('nonexistent')).toBeUndefined();
  });

  it('snapshot is immutable (new reference each flush)', async () => {
    const store = new AnimationStore();
    store.reset({ a: makeState(1) });
    const snap1 = store.getSnapshot();

    store.set('a', makeState(2));
    await Promise.resolve();
    const snap2 = store.getSnapshot();

    expect(snap1).not.toBe(snap2);
    expect(snap1.a.position.x).toBe(1);
    expect(snap2.a.position.x).toBe(2);
  });

  it('unsubscribe stops notifications', async () => {
    const store = new AnimationStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);

    store.set('a', makeState(1));
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    store.set('a', makeState(2));
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1); // no additional call
  });

  it('multiple subscribers all get notified', async () => {
    const store = new AnimationStore();
    const l1 = vi.fn();
    const l2 = vi.fn();
    store.subscribe(l1);
    store.subscribe(l2);

    store.set('a', makeState(1));
    await Promise.resolve();
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
  });

  it('no notification when not dirty', async () => {
    const store = new AnimationStore();
    const listener = vi.fn();
    store.subscribe(listener);

    // Don't set anything — just wait
    await Promise.resolve();
    expect(listener).not.toHaveBeenCalled();
  });
});
