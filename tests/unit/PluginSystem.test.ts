import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginManager } from '../../src/core/PluginSystem';
import type { MotionSvgPlugin } from '../../src/core/PluginSystem';
import type { Scene, Keyframe } from '../../src/types';
import type { ActorState } from '../../src/timeline/interpolate';

function makePlugin(overrides?: Partial<MotionSvgPlugin>): MotionSvgPlugin {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    hooks: {},
    ...overrides,
  };
}

describe('PluginManager', () => {
  let pm: PluginManager;

  beforeEach(() => {
    pm = new PluginManager();
  });

  describe('register / unregister', () => {
    it('registers a plugin', () => {
      pm.register(makePlugin());
      expect(pm.listPlugins()).toHaveLength(1);
      expect(pm.listPlugins()[0]).toEqual({ name: 'test-plugin', version: '1.0.0' });
    });

    it('replaces plugin with same name', () => {
      const destroy = vi.fn();
      pm.register(makePlugin({ destroy }));
      pm.register(makePlugin({ version: '2.0.0' }));
      expect(pm.listPlugins()).toHaveLength(1);
      expect(pm.listPlugins()[0].version).toBe('2.0.0');
      expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('unregisters a plugin by name', () => {
      const destroy = vi.fn();
      pm.register(makePlugin({ destroy }));
      pm.unregister('test-plugin');
      expect(pm.listPlugins()).toHaveLength(0);
      expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('unregister is no-op for unknown name', () => {
      pm.unregister('nonexistent');
      expect(pm.listPlugins()).toHaveLength(0);
    });

    it('getPlugin returns the plugin', () => {
      pm.register(makePlugin());
      expect(pm.getPlugin('test-plugin')).toBeDefined();
      expect(pm.getPlugin('test-plugin')!.name).toBe('test-plugin');
    });

    it('getPlugin returns undefined for unknown', () => {
      expect(pm.getPlugin('nope')).toBeUndefined();
    });

    it('clear removes all plugins and calls destroy', () => {
      const d1 = vi.fn();
      const d2 = vi.fn();
      pm.register(makePlugin({ name: 'a', destroy: d1 }));
      pm.register(makePlugin({ name: 'b', destroy: d2 }));
      pm.clear();
      expect(pm.listPlugins()).toHaveLength(0);
      expect(d1).toHaveBeenCalledTimes(1);
      expect(d2).toHaveBeenCalledTimes(1);
    });
  });

  describe('has', () => {
    it('returns false when no plugins registered', () => {
      expect(pm.has('afterParse')).toBe(false);
    });

    it('returns false when plugin does not implement the hook', () => {
      pm.register(makePlugin({ hooks: {} }));
      expect(pm.has('afterParse')).toBe(false);
    });

    it('returns true when a plugin implements the hook', () => {
      pm.register(makePlugin({ hooks: { afterParse: (s) => s } }));
      expect(pm.has('afterParse')).toBe(true);
    });
  });

  describe('run (hook pipeline)', () => {
    it('returns input unchanged when no plugins', () => {
      const scene = { viewBox: { x: 0, y: 0, w: 100, h: 100 } } as Scene;
      const result = pm.run('afterParse', scene);
      expect(result).toBe(scene);
    });

    it('runs a single plugin hook', () => {
      pm.register(makePlugin({
        hooks: {
          afterParse: (scene) => ({ ...scene, colors: { custom: '#123456' } }),
        },
      }));
      const scene = { viewBox: { x: 0, y: 0, w: 100, h: 100 }, colors: {} } as unknown as Scene;
      const result = pm.run('afterParse', scene);
      expect(result.colors).toEqual({ custom: '#123456' });
    });

    it('pipelines through multiple plugins in order', () => {
      pm.register(makePlugin({
        name: 'first',
        hooks: {
          afterParse: (scene) => ({ ...scene, colors: { ...scene.colors, a: '1' } }),
        },
      }));
      pm.register(makePlugin({
        name: 'second',
        hooks: {
          afterParse: (scene) => ({ ...scene, colors: { ...scene.colors, b: '2' } }),
        },
      }));
      const scene = { colors: {} } as unknown as Scene;
      const result = pm.run('afterParse', scene);
      expect(result.colors).toEqual({ a: '1', b: '2' });
    });

    it('skips plugins that do not implement the hook', () => {
      pm.register(makePlugin({ name: 'no-hook', hooks: {} }));
      pm.register(makePlugin({
        name: 'with-hook',
        hooks: {
          afterParse: (scene) => ({ ...scene, colors: { modified: 'yes' } }),
        },
      }));
      const scene = { colors: {} } as unknown as Scene;
      const result = pm.run('afterParse', scene);
      expect(result.colors).toEqual({ modified: 'yes' });
    });

    it('beforeInterpolate receives keyframes and timeMs', () => {
      const hookFn = vi.fn((kfs: Keyframe[], _timeMs: number) => kfs);
      pm.register(makePlugin({ hooks: { beforeInterpolate: hookFn } }));

      const kfs: Keyframe[] = [{ at: 0 }, { at: 1000 }];
      pm.run('beforeInterpolate', kfs, 500);

      expect(hookFn).toHaveBeenCalledWith(kfs, 500);
    });

    it('afterInterpolate receives state, actorId, timeMs', () => {
      const hookFn = vi.fn((state: ActorState, _actorId: string, _timeMs: number) => ({
        ...state,
        opacity: state.opacity * 0.5,
      }));
      pm.register(makePlugin({ hooks: { afterInterpolate: hookFn } }));

      const state: ActorState = { position: { x: 0, y: 0 }, scale: 1, rotation: 0, opacity: 1 };
      const result = pm.run('afterInterpolate', state, 'actor-1', 500);

      expect(hookFn).toHaveBeenCalledWith(state, 'actor-1', 500);
      expect(result.opacity).toBe(0.5);
    });
  });
});

describe('Plugin integration with interpolation', () => {
  it('afterInterpolate plugin modifies interpolated state', async () => {
    // Use the global plugins singleton
    const { plugins: globalPlugins } = await import('../../src/core/PluginSystem');
    const { interpolateKeyframes } = await import('../../src/timeline/interpolate');

    globalPlugins.register({
      name: 'test-scale-boost',
      version: '1.0.0',
      hooks: {
        afterInterpolate: (state) => ({
          ...state,
          scale: typeof state.scale === 'number' ? state.scale * 10 : state.scale,
        }),
      },
    });

    try {
      const kfs: Keyframe[] = [
        { at: 0, scale: 1 },
        { at: 1000, scale: 2, curve: 'linear' },
      ];
      const state = interpolateKeyframes(kfs, 500);
      // Scale at t=500 with linear = 1.5, then plugin multiplies by 10 = 15
      expect(state.scale).toBeCloseTo(15, 1);
    } finally {
      globalPlugins.unregister('test-scale-boost');
    }
  });

  it('no plugins = zero overhead (same result as before)', async () => {
    const { plugins: globalPlugins } = await import('../../src/core/PluginSystem');
    const { interpolateKeyframes } = await import('../../src/timeline/interpolate');

    // Ensure no plugins
    globalPlugins.clear();

    const kfs: Keyframe[] = [
      { at: 0, scale: 1 },
      { at: 1000, scale: 2, curve: 'linear' },
    ];
    const state = interpolateKeyframes(kfs, 500);
    expect(state.scale).toBeCloseTo(1.5, 2);
  });
});

describe('Plugin integration with parser', () => {
  it('afterParse plugin modifies scene', async () => {
    const { plugins: globalPlugins } = await import('../../src/core/PluginSystem');
    const { parseSvg } = await import('../../src/parser/parseSvg');

    globalPlugins.register({
      name: 'test-parse-hook',
      version: '1.0.0',
      hooks: {
        afterParse: (scene) => ({
          ...scene,
          colors: { ...scene.colors, injected: '#ABCDEF' },
        }),
      },
    });

    try {
      const scene = parseSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path id="x" d="M0,0"/></svg>');
      expect(scene.colors['injected']).toBe('#ABCDEF');
    } finally {
      globalPlugins.unregister('test-parse-hook');
    }
  });
});
