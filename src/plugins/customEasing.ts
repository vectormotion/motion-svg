import type { MotionSvgPlugin } from '../core/PluginSystem';
import { easingFunctions, type EasingFunction } from '../easing/curves';

// ── Custom Easing Plugin ─────────────────────────────────────────────────────
//
// Registers user-defined easing functions that can be used in keyframes
// by name, just like built-in easings ('easeInCubic', 'easeOutBack', etc.).
//
// The plugin injects custom functions directly into the easing registry,
// making them available immediately to the interpolation system.
//

export interface CustomEasingConfig {
  /** Map of easing name → easing function (t: 0..1) → output 0..1 */
  easings: Record<string, EasingFunction>;
}

/**
 * Create a custom easing plugin.
 *
 * Registers named easing functions that keyframes can reference as `curve` values.
 *
 * ```ts
 * import { plugins } from 'motion-svg';
 * import { customEasingPlugin } from 'motion-svg/plugins';
 *
 * plugins.register(customEasingPlugin({
 *   easings: {
 *     // Slow start, fast end, sharp stop
 *     sharpSnap: (t) => t < 0.8 ? t * 0.5 / 0.8 : 0.5 + (t - 0.8) * 0.5 / 0.2,
 *
 *     // Stepped animation (5 steps)
 *     stepped5: (t) => Math.floor(t * 5) / 5,
 *
 *     // Elastic with custom parameters
 *     superBouncy: (t) => {
 *       if (t === 0 || t === 1) return t;
 *       return Math.pow(2, -12 * t) * Math.sin((t - 0.05) * 20 * Math.PI) + 1;
 *     },
 *   },
 * }));
 *
 * // Then use in keyframes:
 * // { at: 500, scale: 2, curve: 'sharpSnap' as any }
 * ```
 */
export function customEasingPlugin(config: CustomEasingConfig): MotionSvgPlugin {
  const registeredNames: string[] = [];

  // Inject each custom easing into the global easingFunctions record
  for (const [name, fn] of Object.entries(config.easings)) {
    if (name in easingFunctions) {
      console.warn(`motion-svg custom-easing: "${name}" overwrites a built-in easing.`);
    }
    (easingFunctions as Record<string, EasingFunction>)[name] = fn;
    registeredNames.push(name);
  }

  return {
    name: 'custom-easing',
    version: '1.0.0',
    hooks: {},

    destroy() {
      // Remove injected easings on cleanup
      for (const name of registeredNames) {
        delete (easingFunctions as Record<string, EasingFunction>)[name];
      }
    },
  };
}

// ── Preset Easing Functions ──────────────────────────────────────────────────

/** Step easing — creates discrete steps instead of continuous interpolation */
export function steppedEasing(steps: number): EasingFunction {
  return (t: number) => Math.floor(t * steps) / steps;
}

/** Slow-motion easing — normal speed in/out, slow in the middle */
export function slowMotionEasing(slowFactor = 0.3): EasingFunction {
  return (t: number) => {
    if (t < 0.2) return t * 2.5 * 0.2;
    if (t > 0.8) return 0.8 + (t - 0.8) * 2.5 * 0.2;
    return 0.2 + (t - 0.2) * slowFactor / 0.6 * (0.6);
  };
}

/** Elastic easing with configurable amplitude and period */
export function elasticEasing(amplitude = 1, period = 0.3): EasingFunction {
  const s = (period / (2 * Math.PI)) * Math.asin(1 / amplitude);
  return (t: number) => {
    if (t === 0 || t === 1) return t;
    return amplitude * Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / period) + 1;
  };
}

/** Spring-like easing with configurable overshoot */
export function springEasing(overshoot = 1.70158): EasingFunction {
  return (t: number) => {
    const t1 = t - 1;
    return t1 * t1 * ((overshoot + 1) * t1 + overshoot) + 1;
  };
}
