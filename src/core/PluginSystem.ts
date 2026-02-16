import type { Scene, Actor, Timeline, TriggerBinding, Keyframe, Bundle } from '../types';
import type { ActorState } from '../timeline/interpolate';

// ── Hook Points ──

export interface MotionSvgHooks {
  /** After SVG parsing, before actor creation */
  afterParse?: (scene: Scene) => Scene;

  /** After actor creation */
  afterCreateActor?: (actor: Actor, scene: Scene) => Actor;

  /** Before keyframe interpolation — can modify or add custom properties */
  beforeInterpolate?: (keyframes: Keyframe[], timeMs: number) => Keyframe[];

  /** After interpolation — can modify the resulting state */
  afterInterpolate?: (state: ActorState, actorId: string, timeMs: number) => ActorState;

  /** Before bundle export — can add custom data */
  beforeExport?: (bundle: Bundle) => Bundle;

  /** After bundle import — can transform reconstructed data */
  afterImport?: (
    scene: Scene,
    actors: Actor[],
    timelines: Timeline[],
    triggers: TriggerBinding[],
  ) => {
    scene: Scene;
    actors: Actor[];
    timelines: Timeline[];
    triggers: TriggerBinding[];
  };

  /** Custom interpolation for properties unknown to the core */
  interpolateProperty?: (
    propName: string,
    from: unknown,
    to: unknown,
    t: number,
  ) => unknown | undefined;
}

// ── Plugin Definition ──

export interface MotionSvgPlugin {
  /** Unique plugin name (e.g. 'path-morphing', 'spring-physics') */
  name: string;
  /** Semver version */
  version: string;
  /** Hooks implemented by this plugin */
  hooks: Partial<MotionSvgHooks>;
  /** Cleanup when the plugin is removed */
  destroy?: () => void;
}

// ── Plugin Manager ──

export class PluginManager {
  private _plugins: MotionSvgPlugin[] = [];

  register(plugin: MotionSvgPlugin): void {
    if (this._plugins.some((p) => p.name === plugin.name)) {
      console.warn(`motion-svg: plugin "${plugin.name}" already registered, replacing.`);
      this.unregister(plugin.name);
    }
    this._plugins.push(plugin);
  }

  unregister(name: string): void {
    const idx = this._plugins.findIndex((p) => p.name === name);
    if (idx >= 0) {
      this._plugins[idx].destroy?.();
      this._plugins.splice(idx, 1);
    }
  }

  /**
   * Run a hook pipeline — each plugin receives the output of the previous one.
   * Returns the original input unchanged if no plugins implement the hook.
   */
  run<K extends keyof MotionSvgHooks>(
    hookName: K,
    ...args: Parameters<NonNullable<MotionSvgHooks[K]>>
  ): ReturnType<NonNullable<MotionSvgHooks[K]>> {
    let result: any = args[0];
    for (const plugin of this._plugins) {
      const hook = plugin.hooks[hookName] as ((...a: any[]) => any) | undefined;
      if (hook) {
        result = hook(...[result, ...args.slice(1)]);
      }
    }
    return result;
  }

  /** Check if any plugin implements a given hook (for zero-overhead fast path) */
  has(hookName: keyof MotionSvgHooks): boolean {
    return this._plugins.some((p) => p.hooks[hookName] !== undefined);
  }

  getPlugin(name: string): MotionSvgPlugin | undefined {
    return this._plugins.find((p) => p.name === name);
  }

  listPlugins(): { name: string; version: string }[] {
    return this._plugins.map((p) => ({ name: p.name, version: p.version }));
  }

  /** Remove all plugins */
  clear(): void {
    for (const p of this._plugins) p.destroy?.();
    this._plugins = [];
  }
}

/** Global plugin manager singleton */
export const plugins = new PluginManager();
