// ─── motion-svg — Declarative SVG Animation Engine ────────────────────────────

// Types
export type {
  Point,
  ViewBox,
  StrokeAlign,
  SvgPath,
  SvgGroup,
  SvgMetadata,
  ColorMap,
  ColorEntry,
  GradientStop,
  LinearGradientDef,
  RadialGradientDef,
  GradientDef,
  Scene,
  ActorConfig,
  ShapeType,
  Actor,
  EasingName,
  CubicBezierCurve,
  EasingCurve,
  Keyframe,
  TimelineConfig,
  Timeline,
  TriggerType,
  LoopDirection,
  TriggerConfig,
  HoverTrigger,
  ClickTrigger,
  LoopTrigger,
  ScrollTrigger,
  AppearTrigger,
  ManualTrigger,
  TriggerBinding,
  Bundle,
  BundleScene,
  BundleActor,
  BundleTimeline,
  BundleTrigger,
  BundleVariant,
  ExportConfig,
  PlaybackState,
  PlaybackController,
  PlaybackEventType,
  PlaybackEvent,
  PlaybackEventHandler,
} from './types';

// Parser
export { parseSvg } from './parser';

// Actor
export { createActor } from './actor';
export { generateShapePath } from './actor';
export type { ShapeOptions } from './actor';

// Easing
export { easingFunctions, getEasingFunction, cubicBezier } from './easing';

// Timeline
export { timeline } from './timeline';
export { interpolateKeyframes, getActorStateAtTime, lerpGradientDef } from './timeline';
export { sequence, stagger, parallelDuration } from './timeline';
export type { SequenceConfig, SequenceItem, StaggerConfig, StaggerFrom } from './timeline/sequence';
export { lerpPath, parsePathD, normalizeToCubic, balanceCommands } from './timeline/pathMorph';
export type { PathCommand, CubicSegment, NormalizedPath } from './timeline/pathMorph';

// Trigger
export { trigger } from './trigger';
export { createPlayback } from './trigger';

// Bundle
export { exportBundle } from './bundle';
export { importBundle } from './bundle';
export { getVariant } from './bundle/importBundle';
export { validateBundle } from './bundle';

// Core
export { AnimationStore } from './core/AnimationStore';
export { PluginManager, plugins } from './core/PluginSystem';
export type { MotionSvgPlugin, MotionSvgHooks } from './core/PluginSystem';

// Re-export interpolation types
export type { ActorState, InterpolateOptions } from './timeline/interpolate';
export type { ImportedBundle } from './bundle/importBundle';
export type { ValidationResult } from './bundle/validate';
export type { UseMotionSvgOptions, MotionSvgInstance } from './react/useMotionSvg';

// React hooks
export { useActorState } from './react/useActorState';

// Plugins
export { springPlugin, springResponse } from './plugins/springPhysics';
export type { SpringConfig, SpringProperty } from './plugins/springPhysics';
export { customEasingPlugin, steppedEasing, slowMotionEasing, elasticEasing, springEasing } from './plugins/customEasing';
export type { CustomEasingConfig } from './plugins/customEasing';

// Vanilla Web Component
export { MotionSvgElement, registerMotionSvg } from './vanilla/MotionSvgElement';
