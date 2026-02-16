import React from 'react';
import type { Actor, Point, GradientDef } from '../types';
import type { ActorState } from '../timeline/interpolate';

export interface MotionSvgActorProps {
  actor: Actor;
  state?: ActorState;
  /** Whether this actor is selected (adds visual indicator) */
  selected?: boolean;
  onClick?: (actor: Actor) => void;
  onMouseEnter?: (actor: Actor) => void;
  onMouseLeave?: (actor: Actor) => void;
}

/**
 * Renders a single Actor as an SVG <g> group with transform applied.
 *
 * Supports:
 * - Smooth fill/stroke color and gradient interpolation via ActorState
 * - Animated strokeWidth
 * - strokeAlign: center (default), inside (clip-path), outside (paint-order)
 * - Inline gradient definitions when interpolating between gradients
 */
export const MotionSvgActor: React.FC<MotionSvgActorProps> = ({
  actor,
  state,
  selected,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  const pos = state?.position ?? actor.position;
  const scale = state?.scale ?? actor.scale;
  const rotation = state?.rotation ?? actor.rotation;
  const opacity = state?.opacity ?? actor.opacity;
  const blurRadius = state?.blurRadius ?? actor.blurRadius ?? 0;
  const backdropBlur = state?.backdropBlur ?? actor.backdropBlur ?? 0;

  const sx = typeof scale === 'number' ? scale : scale.x;
  const sy = typeof scale === 'number' ? scale : scale.y;

  // Build transform: translate to position, rotate around origin, then scale
  const ox = actor.origin.x;
  const oy = actor.origin.y;
  const dx = pos.x - ox;
  const dy = pos.y - oy;

  const transform = [
    `translate(${dx}, ${dy})`,
    `translate(${ox}, ${oy})`,
    `rotate(${rotation})`,
    `scale(${sx}, ${sy})`,
    `translate(${-ox}, ${-oy})`,
  ].join(' ');

  return (
    <g
      data-actor-id={actor.id}
      transform={transform}
      opacity={opacity}
      style={{ cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick ? () => onClick(actor) : undefined}
      onMouseEnter={onMouseEnter ? () => onMouseEnter(actor) : undefined}
      onMouseLeave={onMouseLeave ? () => onMouseLeave(actor) : undefined}
    >
      {/* Inline gradient definitions + blur filters */}
      {(state?.fillGradient || state?.strokeGradient || blurRadius > 0) && (
        <defs>
          {state?.fillGradient && <InlineGradient grad={state.fillGradient} />}
          {state?.strokeGradient && <InlineGradient grad={state.strokeGradient} />}
          {blurRadius > 0 && (
            <filter id={`blur-${actor.id}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={blurRadius} />
            </filter>
          )}
        </defs>
      )}

      {/* Backdrop blur (CSS-based, rendered as a style on the group) */}
      {backdropBlur > 0 && (
        <g style={{ backdropFilter: `blur(${backdropBlur}px)`, WebkitBackdropFilter: `blur(${backdropBlur}px)` }}>
          <rect x="-9999" y="-9999" width="99999" height="99999" fill="transparent" />
        </g>
      )}

      <g filter={blurRadius > 0 ? `url(#blur-${actor.id})` : undefined}>
      {actor.paths.map((p) => {
        const sw = state?.strokeWidth ?? p.strokeWidth;
        const align = state?.strokeAlign ?? p.strokeAlign ?? 'center';
        const fillVal = state?.fill ?? p.fill ?? 'currentColor';
        const strokeVal = state?.stroke ?? p.stroke;
        const effectiveD = state?.pathD ?? p.d;

        if (align === 'inside' && sw && sw > 0) {
          const clipId = `clip-in-${actor.id}-${p.id}`;
          return (
            <g key={p.id} opacity={p.opacity} transform={p.transform}>
              <defs>
                <clipPath id={clipId}>
                  <path d={effectiveD} />
                </clipPath>
              </defs>
              <path d={effectiveD} fill={fillVal} stroke="none" />
              <path
                d={effectiveD}
                fill="none"
                stroke={strokeVal}
                strokeWidth={sw * 2}
                clipPath={`url(#${clipId})`}
              />
            </g>
          );
        }

        if (align === 'outside' && sw && sw > 0) {
          return (
            <path
              key={p.id}
              d={effectiveD}
              fill={fillVal}
              stroke={strokeVal}
              strokeWidth={sw * 2}
              opacity={p.opacity}
              transform={p.transform}
              style={{ paintOrder: 'stroke fill markers' }}
            />
          );
        }

        return (
          <path
            key={p.id}
            d={effectiveD}
            fill={fillVal}
            stroke={strokeVal}
            strokeWidth={sw}
            opacity={p.opacity}
            transform={p.transform}
          />
        );
      })}
      </g>

      {selected && (
        <rect
          x={ox - 4}
          y={oy - 4}
          width={8}
          height={8}
          fill="none"
          stroke="#4f8ff7"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          rx={2}
        />
      )}
    </g>
  );
};

/** Renders a GradientDef as an inline SVG gradient element */
const InlineGradient: React.FC<{ grad: GradientDef }> = ({ grad }) => {
  const stops = grad.stops.map((s, i) => (
    <stop
      key={i}
      offset={s.offset}
      stopColor={s.color}
      stopOpacity={s.opacity}
    />
  ));

  if (grad.type === 'linear') {
    return (
      <linearGradient
        id={grad.id}
        x1={grad.x1}
        y1={grad.y1}
        x2={grad.x2}
        y2={grad.y2}
        gradientUnits={grad.gradientUnits}
      >
        {stops}
      </linearGradient>
    );
  }

  return (
    <radialGradient
      id={grad.id}
      cx={grad.cx}
      cy={grad.cy}
      r={grad.r}
      fx={grad.fx}
      fy={grad.fy}
      gradientUnits={grad.gradientUnits}
    >
      {stops}
    </radialGradient>
  );
};
