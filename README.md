# motion-svg

> **Declarative SVG animation engine** — Parse, wrap, animate & export SVG paths with keyframes, easing curves, interaction triggers, path morphing, and a plugin system.

---

## Install

```bash
npm install motion-svg
```

## Entry Points

| Import Path | Description |
|---|---|
| `motion-svg` | Core engine (parser, actors, timelines, easing, bundles, plugins) |
| `motion-svg/react` | React components and hooks |
| `motion-svg/vanilla` | `<motion-svg>` Web Component (framework-free) |
| `motion-svg/plugins` | Official plugins (spring physics, custom easing) |

---

## Quick Start

```typescript
import { parseSvg, createActor, timeline, trigger, exportBundle } from 'motion-svg';

// 1. Parse an SVG
const scene = parseSvg('<svg viewBox="0 0 200 200"><path id="star" d="M100,10 L..." fill="#f00"/></svg>');

// 2. Create an Actor from a path
const star = createActor({
  id: 'star',
  paths: [scene.paths[0]],
  origin: { x: 100, y: 100 },
});

// 3. Define keyframes
const anim = timeline(star, {
  keyframes: [
    { at: 0, scale: 1, rotation: 0 },
    { at: 600, scale: 1.3, rotation: 180, curve: 'easeInOutBack' },
    { at: 1200, scale: 1, rotation: 360, curve: 'easeOutCubic' },
  ],
});

// 4. Set a trigger
const triggerBinding = trigger(anim, { type: 'hover', reverse: true });

// 5. Export as a self-contained JSON bundle
const json = exportBundle({
  scene,
  actors: [star],
  timelines: [anim],
  triggers: [triggerBinding],
});
```

### React

```tsx
import { useMotionSvg, MotionSvgPlayer } from 'motion-svg/react';
import bundle from './animation.motionsvg.json';

function App() {
  return <MotionSvgPlayer data={bundle} width={400} height={300} />;
}
```

### Vanilla (Web Component)

```html
<script type="module">
  import { registerMotionSvg } from 'motion-svg/vanilla';
  registerMotionSvg();
</script>

<motion-svg src="animation.motionsvg.json" autoplay width="400" height="300"></motion-svg>
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         motion-svg                               │
├────────────┬──────────────┬──────────────────┬───────────────────┤
│  Parser    │  Actor       │  Animation       │  Orchestration    │
│            │              │                  │                   │
│  parseSvg  │  createActor │  timeline        │  sequence         │
│            │  shapes      │  interpolation   │  stagger          │
│            │              │  easing curves   │  parallelDuration │
│            │              │  path morphing   │                   │
├────────────┴──────────────┴──────────────────┴───────────────────┤
│  Triggers: hover · click · loop · scroll · appear · manual       │
├──────────────────────────────────────────────────────────────────┤
│  Playback: createPlayback · rate · events · time-stretching      │
├──────────────────────────────────────────────────────────────────┤
│  Bundle I/O: exportBundle · importBundle · validateBundle        │
├──────────────────────────────────────────────────────────────────┤
│  Plugin System: PluginManager · hooks pipeline · zero-overhead   │
├────────────────────────────┬─────────────────────────────────────┤
│  React Bindings            │  Vanilla Web Component              │
│  MotionSvgPlayer           │  <motion-svg> custom element        │
│  MotionSvgActor            │  Shadow DOM + attributes API        │
│  useMotionSvg / useActor   │  registerMotionSvg()                │
└────────────────────────────┴─────────────────────────────────────┘
```

---

## API Reference

### Parser

#### `parseSvg(svgString): Scene`

Parse an SVG string into a structured Scene object. Works in Node.js and browsers (regex-based, no DOM required).

```typescript
import { parseSvg } from 'motion-svg';

const scene = parseSvg(svgString);
// scene.viewBox   → { x, y, w, h }
// scene.paths     → SvgPath[] (all <path>, <rect>, <circle>, etc.)
// scene.groups    → SvgGroup[] (all <g> with children)
// scene.colors    → Record<id, color>
// scene.gradients → GradientDef[] (linear + radial)
// scene.metadata  → { xmlns, width, height, originalSvg }
```

---

### Actor

#### `createActor(config): Actor`

Create an Actor — a controllable wrapper around one or more SVG paths with independent transform properties.

```typescript
import { createActor } from 'motion-svg';

const actor = createActor({
  id: 'my-actor',
  paths: [scene.paths[0], scene.paths[1]],
  origin: { x: 100, y: 100 },
  z: 1,  // optional z-order
});
```

**ActorConfig:**

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier |
| `paths` | `SvgPath[]` | SVG paths to include |
| `origin` | `Point` | Transform origin `{ x, y }` |
| `z` | `number?` | Z-order (default: 0) |

#### `generateShapePath(type, width, height, opts?): string`

Generate an SVG path `d` string for a geometric shape.

```typescript
import { generateShapePath } from 'motion-svg';

const rect = generateShapePath('rect', 100, 50);
const hex  = generateShapePath('polygon', 80, 80, { sides: 6 });
```

**Supported shapes:** `'rect'` | `'ellipse'` | `'line'` | `'arrow'` | `'polygon'`

---

### Timeline

#### `timeline(actor, config): Timeline`

Create a keyframe timeline for an actor. Keyframes are sorted by `at` time and the first keyframe is filled with actor defaults.

```typescript
import { timeline } from 'motion-svg';

const tl = timeline(actor, {
  keyframes: [
    { at: 0, opacity: 0, position: { x: 0, y: 20 } },
    { at: 400, opacity: 1, position: { x: 0, y: 0 }, curve: 'easeOutCubic' },
  ],
});
// tl.id, tl.actorId, tl.keyframes, tl.duration
```

**Keyframe properties:**

| Property | Type | Default | Description |
|---|---|---|---|
| `at` | `number` | *required* | Time in milliseconds |
| `position` | `Point` | actor origin | `{ x, y }` position |
| `scale` | `number \| Point` | `1` | Uniform or `{ x, y }` scale |
| `rotation` | `number` | `0` | Rotation in degrees |
| `opacity` | `number` | `1` | Opacity 0..1 |
| `fill` | `string` | original | Fill color or `url(#gradientId)` |
| `stroke` | `string` | original | Stroke color or gradient ref |
| `strokeWidth` | `number` | original | Stroke width |
| `strokeAlign` | `StrokeAlign` | `'center'` | `'center'` \| `'inside'` \| `'outside'` |
| `blurRadius` | `number` | `0` | Gaussian blur in px |
| `backdropBlur` | `number` | `0` | Backdrop blur in px |
| `width` | `number` | — | Shape width (shape actors) |
| `height` | `number` | — | Shape height (shape actors) |
| `pathD` | `string` | — | SVG path `d` for morphing |
| `curve` | `EasingCurve` | `'linear'` | Easing to reach this keyframe |

---

### Easing

20+ built-in easing functions plus custom cubic bezier:

| Category | Functions |
|---|---|
| Linear | `linear` |
| Sine | `easeIn`, `easeOut`, `easeInOut` |
| Quad | `easeInQuad`, `easeOutQuad`, `easeInOutQuad` |
| Cubic | `easeInCubic`, `easeOutCubic`, `easeInOutCubic` |
| Quart | `easeInQuart`, `easeOutQuart`, `easeInOutQuart` |
| Back | `easeInBack`, `easeOutBack`, `easeInOutBack` |
| Elastic | `easeInElastic`, `easeOutElastic`, `easeInOutElastic` |
| Bounce | `easeInBounce`, `easeOutBounce`, `easeInOutBounce` |

```typescript
import { cubicBezier, getEasingFunction } from 'motion-svg';

// Custom cubic bezier (like CSS cubic-bezier)
const myEasing = cubicBezier(0.25, 0.1, 0.25, 1.0);

// Resolve by name
const fn = getEasingFunction('easeOutBack'); // (t: number) => number
```

---

### Orchestration

#### `sequence(actor, config): Timeline`

Chain multiple timelines sequentially into a single Timeline.

```typescript
import { sequence } from 'motion-svg';

const combined = sequence(actor, {
  items: [
    { timeline: fadeIn },
    { timeline: slideUp, delay: 100 },  // 100ms gap
    { timeline: bounce, offset: 800 },  // starts at 800ms absolute
  ],
});
```

#### `stagger(config): Timeline[]`

Create staggered timelines for multiple actors with the same animation.

```typescript
import { stagger } from 'motion-svg';

const timelines = stagger({
  actors: [card1, card2, card3, card4],
  keyframes: [
    { at: 0, opacity: 0, position: { x: 0, y: 20 } },
    { at: 400, opacity: 1, position: { x: 0, y: 0 }, curve: 'easeOutCubic' },
  ],
  stagger: 100,       // 100ms between each actor
  from: 'start',      // 'start' | 'end' | 'center' | 'edges'
});
// card1: 0–400ms, card2: 100–500ms, card3: 200–600ms, card4: 300–700ms
```

#### `parallelDuration(timelines): number`

Return the total duration of timelines running in parallel (max duration).

---

### Path Morphing

Interpolate SVG path `d` attributes between shapes.

#### `lerpPath(pathA, pathB, t): string`

Interpolate between two SVG path strings. Automatically normalizes all commands to cubic beziers and balances segment counts.

```typescript
import { lerpPath } from 'motion-svg';

const mid = lerpPath(
  'M0,0 L10,0 L10,10 Z',   // triangle
  'M0,0 L10,0 L10,10 L0,10 Z', // square
  0.5
);
```

Use `pathD` in keyframes for animated morphing:

```typescript
const morph = timeline(actor, {
  keyframes: [
    { at: 0, pathD: circlePath },
    { at: 1000, pathD: starPath, curve: 'easeInOutCubic' },
  ],
});
```

**Supporting functions:** `parsePathD(d)`, `normalizeToCubic(commands)`, `balanceCommands(a, b)`

Supports all SVG path commands: M, L, H, V, C, S, Q, T, A, Z (absolute and relative).

---

### Triggers

#### `trigger(timeline, config): TriggerBinding`

Bind a trigger to a timeline.

```typescript
import { trigger } from 'motion-svg';

trigger(tl, { type: 'hover', reverse: true });
trigger(tl, { type: 'click', toggle: true });
trigger(tl, { type: 'loop', iterations: Infinity, direction: 'alternate', delay: 200 });
trigger(tl, { type: 'scroll', start: 0.2, end: 0.8 });
trigger(tl, { type: 'appear', threshold: 0.5, once: true });
trigger(tl, { type: 'manual' });
```

| Trigger | Key Options |
|---|---|
| `hover` | `reverse?: boolean` |
| `click` | `toggle?: boolean` |
| `loop` | `iterations?, direction?: 'normal'\|'reverse'\|'alternate', delay?` |
| `scroll` | `start?: number, end?: number` (0..1 viewport %) |
| `appear` | `threshold?: number, once?: boolean` |
| `manual` | — (controlled via PlaybackController) |

---

### Playback

#### `createPlayback(options): PlaybackController`

Create a runtime playback controller that drives animations frame-by-frame using requestAnimationFrame.

```typescript
import { createPlayback } from 'motion-svg';

const ctrl = createPlayback({
  timeline: tl,
  trigger: triggerBinding,
  gradients: scene.gradients,
  onUpdate: (state, timeMs) => { /* apply state to DOM */ },
  onComplete: () => { /* all done */ },
  initialRate: 1,
});

ctrl.play();
ctrl.pause();
ctrl.stop();
ctrl.seek(500);
ctrl.reverse();
```

**PlaybackController properties:**

| Property | Type | Description |
|---|---|---|
| `state` | `PlaybackState` | `'idle'` \| `'playing'` \| `'paused'` \| `'finished'` |
| `currentTime` | `number` | Current time in ms |
| `duration` | `number` | Timeline duration in ms |
| `progress` | `number` | Normalized progress 0..1 |
| `playbackRate` | `number` | Speed: 1=normal, 0.5=half, 2=double, negative=reverse |
| `totalDuration` | `number` | Override for time-stretching |

**Events:**

```typescript
const unsub = ctrl.on('complete', (event) => {
  console.log(event.progress, event.currentTime);
});

// Event types: 'start' | 'play' | 'pause' | 'stop' | 'seek' | 'reverse' | 'frame' | 'complete' | 'repeat'
```

---

### Bundle I/O

#### `exportBundle(config): string`

Export a complete animation as a self-contained `.motionsvg.json` string.

```typescript
import { exportBundle } from 'motion-svg';

const json = exportBundle({
  scene,
  actors: [actor1, actor2],
  timelines: [tl1, tl2],
  triggers: [trigger1],
  variants: [{ name: 'idle', actorIds: ['a1'], timelineIndices: [0], triggerIndices: [0] }],
});
```

#### `importBundle(jsonString): ImportedBundle`

Import a `.motionsvg.json` bundle and reconstruct all objects.

```typescript
import { importBundle, getVariant } from 'motion-svg';

const imported = importBundle(jsonString);
// imported.scene, imported.actors, imported.timelines, imported.triggers, imported.variants

const variant = getVariant(imported, 'idle');
// variant.actors, variant.timelines, variant.triggers — or null
```

#### `validateBundle(jsonString): ValidationResult`

Validate a bundle JSON string without importing it.

---

### Interpolation

#### `interpolateKeyframes(keyframes, timeMs, opts?): ActorState`

Compute the interpolated state at a given time. Each property is interpolated independently.

#### `getActorStateAtTime(timeline, timeMs, opts?): ActorState`

Shorthand for interpolating a timeline's keyframes.

#### `lerpGradientDef(a, b, t): GradientDef`

Interpolate between two gradient definitions (linear/radial, cross-type).

**ActorState:**

```typescript
interface ActorState {
  position: Point;
  scale: number | Point;
  rotation: number;
  opacity: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeAlign?: StrokeAlign;
  blurRadius?: number;
  backdropBlur?: number;
  width?: number;
  height?: number;
  fillGradient?: GradientDef;
  strokeGradient?: GradientDef;
  pathD?: string;
}
```

---

### Plugin System

Zero-overhead hook-based plugin system. Plugins compose in a pipeline where each receives the output of the previous one.

```typescript
import { plugins, PluginManager } from 'motion-svg';

plugins.register(myPlugin);
plugins.unregister('my-plugin');
plugins.listPlugins();  // [{ name, version }]
plugins.clear();
```

**Available hooks:**

| Hook | Signature | Called When |
|---|---|---|
| `afterParse` | `(scene) => Scene` | After SVG parsing |
| `afterCreateActor` | `(actor, scene) => Actor` | After actor creation |
| `beforeInterpolate` | `(keyframes, timeMs) => Keyframe[]` | Before each frame interpolation |
| `afterInterpolate` | `(state, actorId, timeMs) => ActorState` | After each frame interpolation |
| `beforeExport` | `(bundle) => Bundle` | Before bundle export |
| `afterImport` | `(scene, actors, timelines, triggers) => {...}` | After bundle import |
| `interpolateProperty` | `(propName, from, to, t) => unknown` | Custom property interpolation |

**Creating a plugin:**

```typescript
import type { MotionSvgPlugin } from 'motion-svg';

const myPlugin: MotionSvgPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  hooks: {
    afterInterpolate(state, actorId, timeMs) {
      return { ...state, opacity: state.opacity * 0.8 };
    },
  },
  destroy() { /* cleanup */ },
};
```

---

### AnimationStore

High-performance external store for batching actor state updates. Uses `queueMicrotask` to notify subscribers once per frame instead of per-actor.

```typescript
import { AnimationStore } from 'motion-svg';

const store = new AnimationStore();
store.set('actor-1', state);
store.setMany({ 'actor-1': state1, 'actor-2': state2 });
const snapshot = store.getSnapshot();
const actorState = store.getActorState('actor-1');
const unsub = store.subscribe(() => { /* re-render */ });
store.reset(); // flush immediately
```

---

### React — `motion-svg/react`

```typescript
import {
  MotionSvgPlayer,   // Full player component
  MotionSvgActor,    // Single actor renderer
  MotionSvgCanvas,   // SVG canvas wrapper
  useMotionSvg,      // Control hook
  useActorState,     // Granular actor state hook
} from 'motion-svg/react';
```

#### `useMotionSvg(bundle, options?): MotionSvgInstance`

React hook for controlling animations. Uses `useSyncExternalStore` for optimal batched rendering.

```typescript
const {
  data,           // ImportedBundle | null
  actors,         // Actor[]
  timelines,      // Timeline[]
  triggers,       // TriggerBinding[]
  actorStates,    // Record<string, ActorState>
  controllers,    // PlaybackController[]
  store,          // AnimationStore
  play, pause, stop, seek,
  playing,        // boolean
  variantNames,   // string[]
} = useMotionSvg(bundleJson, { variant: 'idle' });
```

#### `useActorState(store, actorId): ActorState | undefined`

Granular hook that re-renders only when a specific actor's state changes.

```typescript
const state = useActorState(store, 'my-actor');
```

#### `<MotionSvgPlayer data={bundle} width={400} height={300} />`

Renders a complete animation bundle.

#### `<MotionSvgActor actor={actor} state={actorState} />`

Renders a single actor with its current interpolated state. Supports stroke alignment (inside/outside/center), inline gradients, blur filters, and path morphing.

---

### Vanilla — `motion-svg/vanilla`

#### `registerMotionSvg(tagName?)`

Register the `<motion-svg>` custom element. Call once before using in HTML.

```typescript
import { registerMotionSvg } from 'motion-svg/vanilla';
registerMotionSvg(); // or registerMotionSvg('my-player')
```

#### `<motion-svg>` Element

**Attributes:**

| Attribute | Description |
|---|---|
| `src` | URL to a `.motionsvg.json` file (fetched automatically) |
| `data` | Inline JSON string of the bundle |
| `variant` | Name of the variant to activate |
| `autoplay` | Start animation on load (boolean attribute) |
| `width` | CSS width (default: `100%`) |
| `height` | CSS height (default: `100%`) |

**JS API:**

```javascript
const el = document.querySelector('motion-svg');
el.bundle = bundleObject;     // set bundle programmatically
el.variant = 'dark';          // switch variant
el.play();
el.pause();
el.stop();
el.seek(500);
el.controllers;               // PlaybackController[]
```

**Events:** `motionsvg:ready`, `motionsvg:play`, `motionsvg:complete`

---

### Plugins — `motion-svg/plugins`

#### `springPlugin(config?): MotionSvgPlugin`

Damped harmonic oscillator that adds natural overshoot and settling to scale, position, and rotation.

```typescript
import { springPlugin } from 'motion-svg/plugins';
import { plugins } from 'motion-svg';

plugins.register(springPlugin({
  stiffness: 120,    // higher = snappier (default: 100)
  damping: 8,        // higher = less oscillation (default: 10)
  mass: 1,           // higher = more inertia (default: 1)
  properties: ['scale', 'position'], // which to apply (default: ['scale', 'position'])
}));
```

#### `customEasingPlugin(config): MotionSvgPlugin`

Register named easing functions usable in keyframes.

```typescript
import { customEasingPlugin, steppedEasing, elasticEasing } from 'motion-svg/plugins';
import { plugins } from 'motion-svg';

plugins.register(customEasingPlugin({
  easings: {
    stepped5: steppedEasing(5),
    superElastic: elasticEasing(1.5, 0.3),
    myCustom: (t) => t * t * (3 - 2 * t), // smoothstep
  },
}));

// Then use in keyframes:
// { at: 500, scale: 2, curve: 'stepped5' }
```

**Preset easing factories:**

| Function | Description |
|---|---|
| `steppedEasing(steps)` | Discrete step animation |
| `slowMotionEasing(factor?)` | Slow in the middle |
| `elasticEasing(amplitude?, period?)` | Configurable elastic |
| `springEasing(overshoot?)` | Spring-like back easing |

#### `springResponse(t, stiffness, damping, mass): number`

Low-level spring response function (exported for direct use).

---

## Types

All types are exported from the main entry point:

```typescript
import type {
  // Core
  Point, ViewBox, SvgPath, SvgGroup, Scene, SvgMetadata,
  // Color & Gradients
  ColorMap, ColorEntry, GradientStop, GradientDef, LinearGradientDef, RadialGradientDef,
  // Actor
  Actor, ActorConfig, ShapeType,
  // Animation
  Keyframe, TimelineConfig, Timeline, EasingName, EasingCurve, CubicBezierCurve,
  // Trigger
  TriggerType, TriggerConfig, TriggerBinding, LoopDirection,
  HoverTrigger, ClickTrigger, LoopTrigger, ScrollTrigger, AppearTrigger, ManualTrigger,
  // Bundle
  Bundle, BundleScene, BundleActor, BundleTimeline, BundleTrigger, BundleVariant, ExportConfig,
  // Playback
  PlaybackState, PlaybackController, PlaybackEventType, PlaybackEvent, PlaybackEventHandler,
  // Interpolation
  ActorState, InterpolateOptions,
  // Bundle I/O
  ImportedBundle, ValidationResult,
  // React
  UseMotionSvgOptions, MotionSvgInstance,
  // Path Morphing
  PathCommand, CubicSegment, NormalizedPath,
  // Orchestration
  SequenceConfig, SequenceItem, StaggerConfig, StaggerFrom,
  // Plugins
  MotionSvgPlugin, MotionSvgHooks, SpringConfig, SpringProperty, CustomEasingConfig,
} from 'motion-svg';
```

---

## License

MIT
