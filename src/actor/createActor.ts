import type { Actor, ActorConfig } from '../types';

let actorCounter = 0;

/**
 * Create an Actor — a controllable wrapper around one or more SVG paths.
 *
 * An Actor has its own position, scale, rotation and opacity and can be
 * animated independently via the timeline system.
 */
export function createActor(config: ActorConfig): Actor {
  const { id, paths, origin, z } = config;

  if (!paths || paths.length === 0) {
    throw new Error(`motion-svg: createActor("${id}") requires at least one path.`);
  }

  actorCounter++;

  return {
    id: id || `actor-${actorCounter}`,
    pathIds: paths.map((p) => p.id),
    paths: [...paths],
    origin: { ...origin },
    position: { ...origin },
    scale: 1,
    rotation: 0,
    opacity: 1,
    blurRadius: 0,
    backdropBlur: 0,
    z: z ?? 0,
  };
}
