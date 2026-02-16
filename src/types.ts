// ─── Geometry ───────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─── SVG Elements ───────────────────────────────────────────────────────────

export type StrokeAlign = 'center' | 'inside' | 'outside';

export interface SvgPath {
  id: string;
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Stroke alignment: center (default SVG), inside, or outside the path */
  strokeAlign?: StrokeAlign;
  opacity?: number;
  transform?: string;
  /** Bounding box computed from the path */
  bounds?: { x: number; y: number; w: number; h: number };
}

export interface SvgGroup {
  id: string;
  children: (SvgPath | SvgGroup)[];
  transform?: string;
}

export interface SvgMetadata {
  xmlns: string;
  width?: number;
  height?: number;
  originalSvg: string;
}

export interface ColorEntry {
  elementId: string;
  property: 'fill' | 'stroke';
  value: string;
}

export type ColorMap = Record<string, string>;

// ─── Gradients ─────────────────────────────────────────────────────────────

export interface GradientStop {
  offset: number;
  color: string;
  opacity?: number;
}

export interface LinearGradientDef {
  type: 'linear';
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: GradientStop[];
  gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  gradientTransform?: string;
}

export interface RadialGradientDef {
  type: 'radial';
  id: string;
  cx: number;
  cy: number;
  r: number;
  fx?: number;
  fy?: number;
  stops: GradientStop[];
  gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  gradientTransform?: string;
}

export type GradientDef = LinearGradientDef | RadialGradientDef;

// ─── Scene (parsed SVG) ────────────────────────────────────────────────────

export interface Scene {
  viewBox: ViewBox;
  paths: SvgPath[];
  groups: SvgGroup[];
  colors: ColorMap;
  gradients: GradientDef[];
  metadata: SvgMetadata;
}

// ─── Actor ──────────────────────────────────────────────────────────────────

export interface ActorConfig {
  id: string;
  paths: SvgPath[];
  origin: Point;
  /** Z-order (higher = rendered on top). Defaults to 0. */
  z?: number;
}

/** Shape type for actors created via the shape tool (undefined for imported SVG actors) */
export type ShapeType = 'rect' | 'ellipse' | 'line' | 'arrow' | 'polygon';

export interface Actor {
  id: string;
  pathIds: string[];
  paths: SvgPath[];
  origin: Point;
  position: Point;
  scale: number | Point;
  rotation: number;
  opacity: number;
  /** Gaussian blur radius (px) applied to the entire actor — 0 = no blur */
  blurRadius: number;
  /** Backdrop/background blur radius (px) behind the actor — 0 = no blur */
  backdropBlur: number;
  /** Z-order — controls rendering/stacking order. Higher values draw on top. */
  z: number;
  /** Shape type — set for geometric shape actors created via shape tool */
  shapeType?: ShapeType;
  /** Shape width in SVG units (only for shape actors) */
  width?: number;
  /** Shape height in SVG units (only for shape actors) */
  height?: number;
  /** If this actor is a group, contains the IDs of its child actors */
  childIds?: string[];
  /** If this actor belongs to a group, the parent group actor ID */
  parentId?: string;
}

// ─── Keyframe & Timeline ────────────────────────────────────────────────────

export type EasingName =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInQuart'
  | 'easeOutQuart'
  | 'easeInOutQuart'
  | 'easeInBack'
  | 'easeOutBack'
  | 'easeInOutBack'
  | 'easeInElastic'
  | 'easeOutElastic'
  | 'easeInOutElastic'
  | 'easeInBounce'
  | 'easeOutBounce'
  | 'easeInOutBounce';

export interface CubicBezierCurve {
  type: 'cubicBezier';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type EasingCurve = EasingName | CubicBezierCurve;

export interface Keyframe {
  /** Time in milliseconds */
  at: number;
  position?: Point;
  scale?: number | Point;
  rotation?: number;
  opacity?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeAlign?: StrokeAlign;
  /** Gaussian blur radius (px) applied to the entire actor */
  blurRadius?: number;
  /** Backdrop/background blur radius (px) behind the actor */
  backdropBlur?: number;
  /** Shape width in SVG units (shape actors only) */
  width?: number;
  /** Shape height in SVG units (shape actors only) */
  height?: number;
  /** SVG path `d` attribute — for morphing between different shapes */
  pathD?: string;
  /** Easing curve to reach THIS keyframe from the previous one */
  curve?: EasingCurve;
}

export interface TimelineConfig {
  keyframes: Keyframe[];
}

export interface Timeline {
  id: string;
  actorId: string;
  keyframes: Keyframe[];
  duration: number;
}

// ─── Trigger ────────────────────────────────────────────────────────────────

export type TriggerType = 'hover' | 'click' | 'loop' | 'scroll' | 'appear' | 'manual';
export type LoopDirection = 'normal' | 'reverse' | 'alternate';

export interface BaseTrigger {
  type: TriggerType;
  target?: 'self' | 'parent';
}

export interface HoverTrigger extends BaseTrigger {
  type: 'hover';
  reverse?: boolean;
}

export interface ClickTrigger extends BaseTrigger {
  type: 'click';
  toggle?: boolean;
}

export interface LoopTrigger extends BaseTrigger {
  type: 'loop';
  iterations?: number;
  direction?: LoopDirection;
  delay?: number;
}

export interface ScrollTrigger extends BaseTrigger {
  type: 'scroll';
  start?: number;
  end?: number;
}

export interface AppearTrigger extends BaseTrigger {
  type: 'appear';
  threshold?: number;
  once?: boolean;
}

export interface ManualTrigger extends BaseTrigger {
  type: 'manual';
}

export type TriggerConfig =
  | HoverTrigger
  | ClickTrigger
  | LoopTrigger
  | ScrollTrigger
  | AppearTrigger
  | ManualTrigger;

export interface TriggerBinding {
  timelineId: string;
  config: TriggerConfig;
}

// ─── Bundle (JSON export/import) ────────────────────────────────────────────

export interface BundleScene {
  viewBox: ViewBox;
  svg: string;
  paths: SvgPath[];
  colors: ColorMap;
  gradients?: GradientDef[];
}

export interface BundleActor {
  id: string;
  pathIds: string[];
  origin: Point;
  /** Z-order for stacking */
  z?: number;
  /** Shape type — set for geometric shape actors */
  shapeType?: ShapeType;
  /** Shape width in SVG units */
  width?: number;
  /** Shape height in SVG units */
  height?: number;
  /** Group children IDs */
  childIds?: string[];
  /** Parent group ID */
  parentId?: string;
}

export interface BundleTimeline {
  actorId: string;
  keyframes: Keyframe[];
}

export interface BundleTrigger {
  timelineIdx: number;
  type: TriggerType;
  target?: string;
  reverse?: boolean;
  toggle?: boolean;
  iterations?: number;
  direction?: LoopDirection;
  delay?: number;
  start?: number;
  end?: number;
  threshold?: number;
  once?: boolean;
}

export interface BundleVariant {
  /** Display name used as the variant prop value (e.g. "idle", "loading") */
  name: string;
  /** Actor IDs visible in this variant. undefined = all actors visible */
  actorIds?: string[];
  /** Indices into Bundle.timelines[] that are active in this variant */
  timelineIndices: number[];
  /** Indices into Bundle.triggers[] that are active in this variant */
  triggerIndices: number[];
}

export interface Bundle {
  version: string;
  scene: BundleScene;
  actors: BundleActor[];
  timelines: BundleTimeline[];
  triggers: BundleTrigger[];
  /** Named variants — each defines a subset of actors/timelines/triggers */
  variants?: BundleVariant[];
}

// ─── Export config ──────────────────────────────────────────────────────────

export interface ExportConfig {
  scene: Scene;
  actors: Actor[];
  timelines: Timeline[];
  triggers?: TriggerBinding[];
  /** Named variants to include in the bundle */
  variants?: BundleVariant[];
}

// ─── Playback state ─────────────────────────────────────────────────────────

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'finished';

export type PlaybackEventType =
  | 'start'
  | 'play'
  | 'pause'
  | 'stop'
  | 'seek'
  | 'reverse'
  | 'frame'
  | 'complete'
  | 'repeat';

export interface PlaybackEvent {
  type: PlaybackEventType;
  currentTime: number;
  /** Normalised progress 0..1 */
  progress: number;
  playbackRate: number;
  /** Current loop iteration (present on 'repeat' events) */
  iteration?: number;
}

export type PlaybackEventHandler = (event: PlaybackEvent) => void;

export interface PlaybackController {
  play(): void;
  pause(): void;
  stop(): void;
  seek(timeMs: number): void;
  reverse(): void;
  readonly state: PlaybackState;
  readonly currentTime: number;
  readonly duration: number;
  /** Normalised progress 0..1 */
  readonly progress: number;
  /** Playback speed: 1 = normal, 0.5 = half, 2 = double. Can be negative. */
  playbackRate: number;
  /** Total duration in ms. Overrides timeline duration for time stretching. */
  totalDuration: number;
  /** Subscribe to a playback event. Returns an unsubscribe function. */
  on(type: PlaybackEventType, handler: PlaybackEventHandler): () => void;
  /** Unsubscribe from a playback event. */
  off(type: PlaybackEventType, handler: PlaybackEventHandler): void;
}
