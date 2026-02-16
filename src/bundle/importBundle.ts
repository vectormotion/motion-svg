import type {
  Bundle,
  BundleVariant,
  Scene,
  Actor,
  Timeline,
  TriggerBinding,
  TriggerConfig,
  Point,
} from '../types';
import { parseSvg } from '../parser/parseSvg';
import { createActor } from '../actor/createActor';
import { timeline as createTimeline } from '../timeline/timeline';
import { trigger as createTrigger } from '../trigger/trigger';

export interface ImportedBundle {
  scene: Scene;
  actors: Actor[];
  timelines: Timeline[];
  triggers: TriggerBinding[];
  variants: BundleVariant[];
  bundle: Bundle;
}

/**
 * Import a `.motionsvg.json` bundle string and reconstruct all objects.
 *
 * Returns a fully hydrated set of Scene, Actors, Timelines, and TriggerBindings
 * ready to be rendered or played back.
 */
export function importBundle(jsonString: string): ImportedBundle {
  const raw: Bundle = JSON.parse(jsonString);

  if (!raw.version) {
    throw new Error('motion-svg: Invalid bundle — missing "version" field.');
  }

  // 1. Reconstruct Scene
  const scene: Scene = raw.scene.svg
    ? parseSvg(raw.scene.svg)
    : {
        viewBox: raw.scene.viewBox,
        paths: raw.scene.paths ?? [],
        groups: [],
        colors: raw.scene.colors ?? {},
        gradients: raw.scene.gradients ?? [],
        metadata: {
          xmlns: 'http://www.w3.org/2000/svg',
          originalSvg: '',
        },
      };

  if (raw.scene.paths?.length) {
    scene.paths = raw.scene.paths;
  }
  if (raw.scene.colors) {
    scene.colors = raw.scene.colors;
  }
  if (raw.scene.gradients?.length) {
    scene.gradients = raw.scene.gradients;
  }
  scene.viewBox = raw.scene.viewBox;

  // 2. Reconstruct Actors
  const actors: Actor[] = raw.actors.map((ba) => {
    const paths = ba.pathIds
      .map((pid) => scene.paths.find((p) => p.id === pid))
      .filter(Boolean) as typeof scene.paths;

    // Group actors may have no paths — create a minimal placeholder if needed
    const isGroupActor = ba.childIds && ba.childIds.length > 0;
    const actorPaths = paths.length > 0 ? paths : (isGroupActor ? [{ id: `${ba.id}_empty`, d: 'M0,0' }] : scene.paths.slice(0, 1));

    const base = createActor({
      id: ba.id,
      paths: actorPaths,
      origin: ba.origin,
      z: ba.z,
    });

    // For group actors, clear the placeholder paths
    if (isGroupActor && paths.length === 0) {
      base.paths = [];
      base.pathIds = [];
    }

    // Restore shape actor fields if present
    if (ba.shapeType) base.shapeType = ba.shapeType;
    if (ba.width !== undefined) base.width = ba.width;
    if (ba.height !== undefined) base.height = ba.height;
    // Restore group fields
    if (ba.childIds) base.childIds = ba.childIds;
    if (ba.parentId) base.parentId = ba.parentId;

    return base;
  });

  // 3. Reconstruct Timelines
  const timelines: Timeline[] = raw.timelines.map((bt) => {
    const actor = actors.find((a) => a.id === bt.actorId) ?? actors[0];
    return createTimeline(actor, { keyframes: bt.keyframes });
  });

  // 4. Reconstruct Triggers
  const triggers: TriggerBinding[] = (raw.triggers ?? []).map((bt) => {
    const tl = timelines[bt.timelineIdx] ?? timelines[0];

    let config: TriggerConfig;

    switch (bt.type) {
      case 'hover':
        config = { type: 'hover', target: bt.target as 'self' | 'parent', reverse: bt.reverse };
        break;
      case 'click':
        config = { type: 'click', target: bt.target as 'self' | 'parent', toggle: bt.toggle };
        break;
      case 'loop':
        config = {
          type: 'loop',
          iterations: bt.iterations,
          direction: bt.direction,
          delay: bt.delay,
        };
        break;
      case 'scroll':
        config = { type: 'scroll', start: bt.start, end: bt.end };
        break;
      case 'appear':
        config = { type: 'appear', threshold: bt.threshold, once: bt.once };
        break;
      default:
        config = { type: 'manual' };
    }

    return createTrigger(tl, config);
  });

  // 5. Parse variants
  const variants: BundleVariant[] = (raw.variants ?? []).map((v) => ({
    name: v.name,
    ...(v.actorIds ? { actorIds: [...v.actorIds] } : {}),
    timelineIndices: [...v.timelineIndices],
    triggerIndices: [...v.triggerIndices],
  }));

  return { scene, actors, timelines, triggers, variants, bundle: raw };
}

/**
 * Get the filtered actors, timelines, and triggers for a named variant.
 * Returns `null` if the variant is not found.
 */
export function getVariant(
  imported: ImportedBundle,
  variantName: string,
): { actors: Actor[]; timelines: Timeline[]; triggers: TriggerBinding[] } | null {
  const variant = imported.variants.find((v) => v.name === variantName);
  if (!variant) return null;

  const actors = variant.actorIds
    ? imported.actors.filter((a) => variant.actorIds!.includes(a.id))
    : imported.actors;

  const timelines = variant.timelineIndices
    .map((i) => imported.timelines[i])
    .filter(Boolean);

  const triggers = variant.triggerIndices
    .map((i) => imported.triggers[i])
    .filter(Boolean);

  return { actors, timelines, triggers };
}
