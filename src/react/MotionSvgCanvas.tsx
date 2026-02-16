import React, { useRef, type CSSProperties, type ReactNode } from 'react';
import type { ViewBox } from '../types';

export interface MotionSvgCanvasProps {
  viewBox: ViewBox;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Background color */
  background?: string;
}

/**
 * SVG canvas wrapper that sets up the coordinate system.
 */
export const MotionSvgCanvas: React.FC<MotionSvgCanvasProps> = ({
  viewBox,
  width = '100%',
  height = '100%',
  className,
  style,
  children,
  background,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      width={width}
      height={height}
      className={className}
      style={{ overflow: 'visible', ...style }}
    >
      {background && (
        <rect
          x={viewBox.x}
          y={viewBox.y}
          width={viewBox.w}
          height={viewBox.h}
          fill={background}
        />
      )}
      {children}
    </svg>
  );
};
