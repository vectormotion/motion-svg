import React, { useEffect, useMemo, type CSSProperties } from 'react';
import type { Bundle } from '../types';
import { useMotionSvg } from './useMotionSvg';
import { MotionSvgCanvas } from './MotionSvgCanvas';
import { MotionSvgActor } from './MotionSvgActor';

export interface MotionSvgPlayerProps {
  /** Bundle data (object or JSON string) */
  data: Bundle | string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  /** Auto-play on mount (default: depends on trigger type) */
  autoPlay?: boolean;
  /** Background color */
  background?: string;
  /** Named variant to play — filters actors, timelines, and triggers */
  variant?: string;
}

/**
 * All-in-one player that renders a `.motionsvg.json` bundle.
 *
 * Handles parsing, actor rendering, and trigger-based playback automatically.
 * Pass `variant` to render only a specific named variant's configuration.
 */
export const MotionSvgPlayer: React.FC<MotionSvgPlayerProps> = ({
  data: bundleData,
  width,
  height,
  className,
  style,
  autoPlay,
  background,
  variant,
}) => {
  const options = useMemo(() => (variant ? { variant } : undefined), [variant]);
  const instance = useMotionSvg(bundleData, options);

  // Auto-play logic — use resolved triggers (variant-filtered)
  useEffect(() => {
    if (!instance.data) return;

    const hasLoop = instance.triggers.some((t) => t.config.type === 'loop');
    const shouldAutoPlay = autoPlay ?? hasLoop;

    if (shouldAutoPlay) {
      instance.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.data, instance.triggers, autoPlay]);

  if (!instance.data) return null;

  const { scene } = instance.data;
  // Use resolved actors / timelines / triggers (filtered by variant)
  const actors = instance.actors;
  const resolvedTimelines = instance.timelines;
  const resolvedTriggers = instance.triggers;

  // Determine hover/click handlers based on resolved triggers
  const hoverTriggerActors = new Set<string>();
  const clickTriggerActors = new Set<string>();

  resolvedTriggers.forEach((tb) => {
    const tl = resolvedTimelines.find((t) => t.id === tb.timelineId);
    if (!tl) return;
    if (tb.config.type === 'hover') hoverTriggerActors.add(tl.actorId);
    if (tb.config.type === 'click') clickTriggerActors.add(tl.actorId);
  });

  return (
    <MotionSvgCanvas
      viewBox={scene.viewBox}
      width={width}
      height={height}
      className={className}
      style={style}
      background={background}
    >
      {/* Render non-actor paths (background/static) */}
      {scene.paths
        .filter((p) => !actors.some((a) => a.pathIds.includes(p.id)))
        .map((p) => (
          <path
            key={p.id}
            d={p.d}
            fill={p.fill ?? 'currentColor'}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            opacity={p.opacity}
            transform={p.transform}
          />
        ))}

      {/* Render actors */}
      {actors.map((actor) => (
        <MotionSvgActor
          key={actor.id}
          actor={actor}
          state={instance.actorStates[actor.id]}
          onMouseEnter={
            hoverTriggerActors.has(actor.id) ? () => instance.play() : undefined
          }
          onMouseLeave={
            hoverTriggerActors.has(actor.id) ? () => instance.stop() : undefined
          }
          onClick={
            clickTriggerActors.has(actor.id)
              ? () => (instance.playing ? instance.stop() : instance.play())
              : undefined
          }
        />
      ))}
    </MotionSvgCanvas>
  );
};
