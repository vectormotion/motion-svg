# Variants — Motion SVG

## What Are Variants?

A **variant** is a named configuration of the animation scene. Each variant specifies:

- **Which actors** are visible (or all by default)
- **Which timelines** are active (by index)
- **Which triggers** fire (by index)

Variants let a single `.motionsvg.json` bundle contain **multiple named states** — for example `idle`, `loading`, `success`, `error`, `hover`, `active`, `disabled`. The consuming developer simply passes a `variant` prop to switch between states without loading separate files.

A bundle **without variants** works exactly as before (fully backward-compatible).

---

## Bundle Format

Variants are stored as an optional `variants` array at the top level of the bundle:

```json
{
  "version": "1.1",
  "scene": { ... },
  "actors": [ ... ],
  "timelines": [ ... ],
  "triggers": [ ... ],
  "variants": [
    {
      "name": "idle",
      "actorIds": ["logo", "background"],
      "timelineIndices": [0, 1],
      "triggerIndices": [0]
    },
    {
      "name": "loading",
      "actorIds": ["logo", "spinner"],
      "timelineIndices": [2, 3],
      "triggerIndices": [1, 2]
    },
    {
      "name": "success",
      "timelineIndices": [4],
      "triggerIndices": [3]
    }
  ]
}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Unique display name (used as the `variant` prop value) |
| `actorIds` | `string[]?` | Actor IDs visible in this variant. **Omit** (or `undefined`) to show all actors. |
| `timelineIndices` | `number[]` | Indices into the top-level `timelines[]` array |
| `triggerIndices` | `number[]` | Indices into the top-level `triggers[]` array |

### Versioning

- Bundles **without variants** → `version: "1.0"`
- Bundles **with variants** → `version: "1.1"`

Old consumers that don't understand variants will ignore the field and play all timelines/triggers as usual.

---

## Creating Variants in the Kit

1. Open the **right sidebar** in the editor.
2. Scroll down to the **Variants** section.
3. Click **+ Add Variant** to create a new variant.
4. Click the variant name to expand it.
5. Configure:
   - **Actors**: Check/uncheck which actors are visible in this variant. "All actors" means every actor renders.
   - **Timelines**: Check which actor timelines are active.
   - **Triggers**: Check which triggers fire in this variant.
6. Click the variant name to rename it (e.g., `idle`, `hover`).
7. **Export** — variants are automatically included in the `.motionsvg.json` output.

---

## Using `variant` in Code

### MotionSvgPlayer Component

```tsx
import { MotionSvgPlayer } from 'motion-svg';
import bundleData from './icon.motionsvg.json';

function App() {
  const [state, setState] = useState('idle');

  return (
    <>
      <MotionSvgPlayer
        data={bundleData}
        variant={state}
        width={200}
        height={200}
      />

      <button onClick={() => setState('loading')}>Start Loading</button>
      <button onClick={() => setState('success')}>Success</button>
      <button onClick={() => setState('idle')}>Reset</button>
    </>
  );
}
```

When `variant` is set:
- Only the variant's actors render
- Only the variant's timelines play
- Only the variant's triggers fire

When `variant` is **not set** (or `undefined`):
- All actors, timelines, and triggers are active (backward-compatible)

### useMotionSvg Hook

```tsx
import { useMotionSvg } from 'motion-svg';

function MyComponent() {
  const instance = useMotionSvg(bundleData, { variant: 'hover' });

  // List available variants
  console.log(instance.variantNames); // ['idle', 'hover', 'active', 'disabled']

  // Control playback
  instance.play();
  instance.pause();
  instance.stop();

  return (
    <svg viewBox="0 0 100 100">
      {/* Render actors using instance.actorStates */}
    </svg>
  );
}
```

### Enumerating Variants

```tsx
const instance = useMotionSvg(bundleData);

// instance.variantNames is always available, even without passing a variant
const names = instance.variantNames; // string[]

// Dynamically build a variant switcher
names.map(name => (
  <button key={name} onClick={() => setVariant(name)}>
    {name}
  </button>
));
```

### Vanilla JavaScript

```js
import { importBundle, getVariant } from 'motion-svg';

const imported = importBundle(jsonString);

// Get all variant names
const names = imported.variants.map(v => v.name);

// Get filtered data for a specific variant
const idle = getVariant(imported, 'idle');
if (idle) {
  console.log(idle.actors);    // Actor[] — only the variant's actors
  console.log(idle.timelines); // Timeline[] — only the variant's timelines
  console.log(idle.triggers);  // TriggerBinding[] — only the variant's triggers
}
```

---

## Example: Icon with States

An animated icon might define these variants:

| Variant | Actors | Behavior |
|---------|--------|----------|
| `idle` | logo, background | Gentle loop animation |
| `hover` | logo, background, glow | Scale up + glow pulse |
| `active` | logo, background, ripple | Click ripple effect |
| `disabled` | logo-gray, background | No animations, muted colors |

In the kit, each variant is configured with the appropriate actor visibility and trigger assignments. The developer then switches between them:

```tsx
<MotionSvgPlayer
  data={iconBundle}
  variant={isDisabled ? 'disabled' : isHovered ? 'hover' : 'idle'}
/>
```

---

## Migration

### v1.0 Bundles (No Variants)

v1.0 bundles work **unchanged**. The `variants` field is optional and defaults to an empty array. All actors, timelines, and triggers play as before.

### v1.1 Bundles (With Variants)

v1.1 bundles include the `variants` array. If consumed by a player that doesn't understand variants, the extra field is simply ignored — all content plays normally.

---

## TypeScript Types

```typescript
import type { BundleVariant, Bundle } from 'motion-svg';

// BundleVariant
interface BundleVariant {
  name: string;
  actorIds?: string[];
  timelineIndices: number[];
  triggerIndices: number[];
}

// Bundle includes optional variants
interface Bundle {
  version: string;
  scene: BundleScene;
  actors: BundleActor[];
  timelines: BundleTimeline[];
  triggers: BundleTrigger[];
  variants?: BundleVariant[];
}
```

---

## API Reference

### `getVariant(imported, name)`

```typescript
function getVariant(
  imported: ImportedBundle,
  variantName: string,
): { actors: Actor[]; timelines: Timeline[]; triggers: TriggerBinding[] } | null;
```

Returns filtered actors, timelines, and triggers for a named variant, or `null` if not found.

### `MotionSvgPlayer` — `variant` prop

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `string?` | `undefined` | Named variant to render. Omit to play everything. |

### `useMotionSvg` — options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `variant` | `string?` | `undefined` | Named variant to activate. |

Returns `variantNames: string[]` for enumeration.
