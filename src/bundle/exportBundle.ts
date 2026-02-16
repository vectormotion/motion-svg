import type {
  ExportConfig,
  Bundle,
  BundleScene,
  BundleActor,
  BundleTimeline,
  BundleTrigger,
  BundleVariant,
} from '../types';

/**
 * Export a complete animation setup as a self-contained JSON string.
 *
 * The resulting `.motionsvg.json` file includes the original SVG data,
 * actor definitions, keyframe timelines, and trigger configurations.
 * No external files are needed to render the animation.
 */
export function exportBundle(config: ExportConfig): string {
  const { scene, actors, timelines, triggers, variants } = config;

  const bundleScene: BundleScene = {
    viewBox: { ...scene.viewBox },
    svg: scene.metadata.originalSvg,
    paths: scene.paths.map((p) => ({ ...p })),
    colors: { ...scene.colors },
    gradients: scene.gradients?.length ? scene.gradients.map((g) => ({ ...g })) : undefined,
  };

  const bundleActors: BundleActor[] = actors.map((a) => ({
    id: a.id,
    pathIds: [...a.pathIds],
    origin: { ...a.origin },
    z: a.z,
    ...(a.shapeType ? { shapeType: a.shapeType } : {}),
    ...(a.width !== undefined ? { width: a.width } : {}),
    ...(a.height !== undefined ? { height: a.height } : {}),
    ...(a.childIds ? { childIds: [...a.childIds] } : {}),
    ...(a.parentId ? { parentId: a.parentId } : {}),
  }));

  const bundleTimelines: BundleTimeline[] = timelines.map((tl) => ({
    actorId: tl.actorId,
    keyframes: tl.keyframes.map((kf): BundleTimeline['keyframes'][number] => ({
      at: kf.at,
      ...(kf.position ? { position: { ...kf.position } } : {}),
      ...(kf.scale !== undefined ? { scale: kf.scale } : {}),
      ...(kf.rotation !== undefined ? { rotation: kf.rotation } : {}),
      ...(kf.opacity !== undefined ? { opacity: kf.opacity } : {}),
      ...(kf.fill ? { fill: kf.fill } : {}),
      ...(kf.stroke ? { stroke: kf.stroke } : {}),
      ...(kf.strokeWidth !== undefined ? { strokeWidth: kf.strokeWidth } : {}),
      ...(kf.strokeAlign ? { strokeAlign: kf.strokeAlign } : {}),
      ...(kf.blurRadius !== undefined ? { blurRadius: kf.blurRadius } : {}),
      ...(kf.backdropBlur !== undefined ? { backdropBlur: kf.backdropBlur } : {}),
      ...(kf.width !== undefined ? { width: kf.width } : {}),
      ...(kf.height !== undefined ? { height: kf.height } : {}),
      ...(kf.curve ? { curve: kf.curve } : {}),
    })),
  }));

  const bundleTriggers: BundleTrigger[] = (triggers ?? []).map((tb) => {
    const tlIdx = timelines.findIndex((tl) => tl.id === tb.timelineId);
    const cfg = tb.config;

    const entry: BundleTrigger = {
      timelineIdx: tlIdx >= 0 ? tlIdx : 0,
      type: cfg.type,
      target: cfg.target,
    };

    if (cfg.type === 'hover') {
      entry.reverse = cfg.reverse;
    } else if (cfg.type === 'click') {
      entry.toggle = cfg.toggle;
    } else if (cfg.type === 'loop') {
      entry.iterations = cfg.iterations;
      entry.direction = cfg.direction;
      entry.delay = cfg.delay;
    } else if (cfg.type === 'scroll') {
      entry.start = cfg.start;
      entry.end = cfg.end;
    } else if (cfg.type === 'appear') {
      entry.threshold = cfg.threshold;
      entry.once = cfg.once;
    }

    return entry;
  });

  // Serialize variants if present
  const bundleVariants: BundleVariant[] | undefined =
    variants && variants.length > 0
      ? variants.map((v) => ({
          name: v.name,
          ...(v.actorIds ? { actorIds: [...v.actorIds] } : {}),
          timelineIndices: [...v.timelineIndices],
          triggerIndices: [...v.triggerIndices],
        }))
      : undefined;

  const bundle: Bundle = {
    version: bundleVariants ? '1.1' : '1.0',
    scene: bundleScene,
    actors: bundleActors,
    timelines: bundleTimelines,
    triggers: bundleTriggers,
    ...(bundleVariants ? { variants: bundleVariants } : {}),
  };

  return JSON.stringify(bundle, null, 2);
}
