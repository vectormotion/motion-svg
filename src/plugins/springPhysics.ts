import type { MotionSvgPlugin } from '../core/PluginSystem';
import type { ActorState } from '../timeline/interpolate';
import type { Point } from '../types';

// ── Spring Physics Plugin ────────────────────────────────────────────────────
//
// Applies damped harmonic oscillator overshoot to animated properties.
// When an actor's scale or position changes, the spring adds natural-feeling
// overshoot and settling that goes beyond the target and springs back.
//

export type SpringProperty = 'scale' | 'position' | 'rotation';

export interface SpringConfig {
  /** Spring stiffness — higher = snappier (default: 100) */
  stiffness?: number;
  /** Damping coefficient — higher = less oscillation (default: 10) */
  damping?: number;
  /** Mass of the object — higher = more inertia (default: 1) */
  mass?: number;
  /** Which properties to apply spring to (default: ['scale', 'position']) */
  properties?: SpringProperty[];
}

/**
 * Compute the spring response at normalized time t.
 *
 * Uses the damped harmonic oscillator:
 *   response(t) = 1 - e^(-ζωt) * (cos(ωd*t) + (ζ/√(1-ζ²)) * sin(ωd*t))
 *
 * where:
 *   ω  = √(k/m)        natural frequency
 *   ζ  = c / (2√(km))   damping ratio
 *   ωd = ω√(1-ζ²)       damped frequency
 *
 * Returns a value that overshoots 1.0 then settles back to 1.0.
 */
export function springResponse(
  t: number,
  stiffness: number,
  damping: number,
  mass: number,
): number {
  if (t <= 0) return 0;
  if (t >= 10) return 1; // Fully settled after enough time

  const omega = Math.sqrt(stiffness / mass); // natural frequency
  const zeta = damping / (2 * Math.sqrt(stiffness * mass)); // damping ratio

  if (zeta >= 1) {
    // Critically/overdamped — no oscillation
    const e = Math.exp(-omega * zeta * t);
    return 1 - e * (1 + omega * zeta * t);
  }

  // Underdamped — oscillation with decay
  const omegaD = omega * Math.sqrt(1 - zeta * zeta);
  const e = Math.exp(-zeta * omega * t);
  return 1 - e * (Math.cos(omegaD * t) + (zeta * omega / omegaD) * Math.sin(omegaD * t));
}

/**
 * Create a spring physics plugin.
 *
 * The plugin replaces the linear interpolation factor with a spring response
 * curve, producing natural overshoot and settling on the configured properties.
 *
 * ```ts
 * import { plugins } from 'motion-svg';
 * import { springPlugin } from 'motion-svg/plugins';
 *
 * plugins.register(springPlugin({ stiffness: 120, damping: 8 }));
 * ```
 */
export function springPlugin(config?: SpringConfig): MotionSvgPlugin {
  const stiffness = config?.stiffness ?? 100;
  const damping = config?.damping ?? 10;
  const mass = config?.mass ?? 1;
  const properties = config?.properties ?? ['scale', 'position'];

  // Track previous states per actor to detect value changes
  const prevStates = new Map<string, { scale: number | Point; position: Point; rotation: number; time: number }>();

  return {
    name: 'spring-physics',
    version: '1.0.0',
    hooks: {
      afterInterpolate(state: ActorState, actorId: string, timeMs: number): ActorState {
        const prev = prevStates.get(actorId);

        if (!prev) {
          // First frame — store baseline, no spring applied
          prevStates.set(actorId, {
            scale: state.scale,
            position: { ...state.position },
            rotation: state.rotation,
            time: timeMs,
          });
          return state;
        }

        const dt = (timeMs - prev.time) / 1000; // seconds
        const result = { ...state };

        if (properties.includes('scale')) {
          const sx = typeof state.scale === 'number' ? state.scale : state.scale.x;
          const sy = typeof state.scale === 'number' ? state.scale : state.scale.y;
          const psx = typeof prev.scale === 'number' ? prev.scale : prev.scale.x;
          const psy = typeof prev.scale === 'number' ? prev.scale : prev.scale.y;

          if (sx !== psx || sy !== psy) {
            const spring = springResponse(dt, stiffness, damping, mass);
            const newSx = psx + (sx - psx) * spring;
            const newSy = psy + (sy - psy) * spring;
            if (Math.abs(newSx - newSy) < 0.0001) {
              result.scale = newSx;
            } else {
              result.scale = { x: newSx, y: newSy };
            }
          }
        }

        if (properties.includes('position')) {
          const dx = state.position.x - prev.position.x;
          const dy = state.position.y - prev.position.y;

          if (dx !== 0 || dy !== 0) {
            const spring = springResponse(dt, stiffness, damping, mass);
            result.position = {
              x: prev.position.x + dx * spring,
              y: prev.position.y + dy * spring,
            };
          }
        }

        if (properties.includes('rotation')) {
          const dr = state.rotation - prev.rotation;
          if (dr !== 0) {
            const spring = springResponse(dt, stiffness, damping, mass);
            result.rotation = prev.rotation + dr * spring;
          }
        }

        // Update tracking (store the original target values, not sprung values)
        prevStates.set(actorId, {
          scale: state.scale,
          position: { ...state.position },
          rotation: state.rotation,
          time: timeMs,
        });

        return result;
      },
    },

    destroy() {
      prevStates.clear();
    },
  };
}
