import { importBundle, getVariant, type ImportedBundle } from '../bundle/importBundle';
import { createPlayback } from '../trigger/playback';
import type { PlaybackController, TriggerBinding, Timeline, Actor } from '../types';
import type { ActorState } from '../timeline/interpolate';

/**
 * `<motion-svg>` Web Component — framework-free SVG animation player.
 *
 * Attributes:
 *   src      — URL to a .motionsvg.json file (fetched automatically)
 *   data     — Inline JSON string of the bundle
 *   variant  — Name of the variant to activate
 *   autoplay — If present, starts animation on load
 *   width    — CSS width
 *   height   — CSS height
 *
 * JS Properties:
 *   .bundle     — Set a Bundle object or JSON string directly
 *   .variant    — Get/set current variant name
 *   .controllers — Exposed PlaybackController[] for advanced control
 *
 * Methods:
 *   .play()  .pause()  .stop()  .seek(ms)
 *
 * Events:
 *   motionsvg:ready    — Bundle loaded and rendered
 *   motionsvg:play     — Animation started
 *   motionsvg:complete — All animations finished
 */
export class MotionSvgElement extends HTMLElement {
  static observedAttributes = ['src', 'data', 'variant', 'autoplay', 'width', 'height'];

  private _imported: ImportedBundle | null = null;
  private _controllers: PlaybackController[] = [];
  private _actorStates: Record<string, ActorState> = {};
  private _svgEl: SVGSVGElement | null = null;
  private _variant: string | undefined;

  // ── Lifecycle ──

  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this._loadFromAttributes();
  }

  disconnectedCallback() {
    this._controllers.forEach((c) => c.stop());
    this._controllers = [];
  }

  attributeChangedCallback(name: string, _old: string | null, _new: string | null) {
    if (name === 'src' || name === 'data') this._loadFromAttributes();
    if (name === 'variant') {
      this._variant = _new ?? undefined;
      this._rebuild();
    }
    if (name === 'width' || name === 'height') this._updateSize();
  }

  // ── Public API ──

  set bundle(value: unknown) {
    const json = typeof value === 'string' ? value : JSON.stringify(value);
    this._import(json);
  }

  get variant(): string | undefined {
    return this._variant;
  }

  set variant(v: string | undefined) {
    this._variant = v;
    if (v) this.setAttribute('variant', v);
    else this.removeAttribute('variant');
    this._rebuild();
  }

  get controllers(): PlaybackController[] {
    return this._controllers;
  }

  play() {
    this._controllers.forEach((c) => c.play());
    this.dispatchEvent(new CustomEvent('motionsvg:play'));
  }

  pause() {
    this._controllers.forEach((c) => c.pause());
  }

  stop() {
    this._controllers.forEach((c) => c.stop());
  }

  seek(ms: number) {
    this._controllers.forEach((c) => c.seek(ms));
  }

  // ── Internal ──

  private async _loadFromAttributes() {
    const src = this.getAttribute('src');
    const data = this.getAttribute('data');
    this._variant = this.getAttribute('variant') ?? undefined;

    if (src) {
      try {
        const res = await fetch(src);
        const json = await res.text();
        this._import(json);
      } catch (e) {
        console.error('motion-svg: Failed to fetch bundle from', src, e);
      }
    } else if (data) {
      this._import(data);
    }
  }

  private _import(jsonString: string) {
    try {
      this._imported = importBundle(jsonString);
      this._rebuild();
      this.dispatchEvent(new CustomEvent('motionsvg:ready'));
      if (this.hasAttribute('autoplay')) this.play();
    } catch (e) {
      console.error('motion-svg: Failed to import bundle', e);
    }
  }

  private _rebuild() {
    this._controllers.forEach((c) => c.stop());
    this._controllers = [];
    if (!this._imported || !this.shadowRoot) return;

    // Resolve variant
    let actors: Actor[];
    let timelines: Timeline[];
    let triggers: TriggerBinding[];

    if (this._variant) {
      const v = getVariant(this._imported, this._variant);
      if (v) {
        actors = v.actors;
        timelines = v.timelines;
        triggers = v.triggers;
      } else {
        actors = this._imported.actors;
        timelines = this._imported.timelines;
        triggers = this._imported.triggers;
      }
    } else {
      actors = this._imported.actors;
      timelines = this._imported.timelines;
      triggers = this._imported.triggers;
    }

    // Render SVG into shadow DOM
    this._renderSvg(actors);

    // Build controllers
    this._controllers = timelines.map((tl) => {
      const tb = triggers.find((t) => t.timelineId === tl.id);
      return createPlayback({
        timeline: tl,
        trigger: tb,
        gradients: this._imported!.scene.gradients,
        onUpdate: (state) => {
          this._actorStates[tl.actorId] = state;
          this._applyState(tl.actorId, state);
        },
        onComplete: () => {
          const allDone = this._controllers.every(
            (c) => c.state === 'finished' || c.state === 'idle',
          );
          if (allDone) {
            this.dispatchEvent(new CustomEvent('motionsvg:complete'));
          }
        },
      });
    });
  }

  private _renderSvg(actors: Actor[]) {
    if (!this.shadowRoot || !this._imported) return;
    const { scene } = this._imported;
    const vb = scene.viewBox;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.style.width = this.getAttribute('width') || '100%';
    svg.style.height = this.getAttribute('height') || '100%';
    svg.style.display = 'block';

    // Render defs for gradients
    if (scene.gradients.length > 0) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      for (const grad of scene.gradients) {
        const el = this._createGradientElement(grad);
        if (el) defs.appendChild(el);
      }
      svg.appendChild(defs);
    }

    // Static paths (not part of any actor)
    const actorPathIds = new Set(actors.flatMap((a) => a.pathIds));
    for (const p of scene.paths) {
      if (actorPathIds.has(p.id)) continue;
      svg.appendChild(this._createPathElement(p));
    }

    // Actor groups
    for (const actor of actors) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('data-actor-id', actor.id);
      for (const p of actor.paths) {
        g.appendChild(this._createPathElement(p));
      }
      svg.appendChild(g);
    }

    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(svg);
    this._svgEl = svg;
  }

  private _createPathElement(p: { id: string; d: string; fill?: string; stroke?: string; strokeWidth?: number; opacity?: number }) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.setAttribute('d', p.d);
    if (p.fill) el.setAttribute('fill', p.fill);
    if (p.stroke) el.setAttribute('stroke', p.stroke);
    if (p.strokeWidth) el.setAttribute('stroke-width', String(p.strokeWidth));
    if (p.opacity !== undefined) el.setAttribute('opacity', String(p.opacity));
    return el;
  }

  private _createGradientElement(grad: import('../types').GradientDef): SVGElement | null {
    if (grad.type === 'linear') {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      el.setAttribute('id', grad.id);
      el.setAttribute('x1', String(grad.x1));
      el.setAttribute('y1', String(grad.y1));
      el.setAttribute('x2', String(grad.x2));
      el.setAttribute('y2', String(grad.y2));
      if (grad.gradientUnits) el.setAttribute('gradientUnits', grad.gradientUnits);
      for (const stop of grad.stops) {
        const s = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s.setAttribute('offset', String(stop.offset));
        s.setAttribute('stop-color', stop.color);
        if (stop.opacity !== undefined) s.setAttribute('stop-opacity', String(stop.opacity));
        el.appendChild(s);
      }
      return el;
    }

    if (grad.type === 'radial') {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
      el.setAttribute('id', grad.id);
      el.setAttribute('cx', String(grad.cx));
      el.setAttribute('cy', String(grad.cy));
      el.setAttribute('r', String(grad.r));
      if (grad.fx !== undefined) el.setAttribute('fx', String(grad.fx));
      if (grad.fy !== undefined) el.setAttribute('fy', String(grad.fy));
      if (grad.gradientUnits) el.setAttribute('gradientUnits', grad.gradientUnits);
      for (const stop of grad.stops) {
        const s = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s.setAttribute('offset', String(stop.offset));
        s.setAttribute('stop-color', stop.color);
        if (stop.opacity !== undefined) s.setAttribute('stop-opacity', String(stop.opacity));
        el.appendChild(s);
      }
      return el;
    }

    return null;
  }

  private _applyState(actorId: string, state: ActorState) {
    if (!this._svgEl) return;
    const g = this._svgEl.querySelector(`[data-actor-id="${actorId}"]`) as SVGGElement | null;
    if (!g) return;

    const actor = this._imported!.actors.find((a) => a.id === actorId);
    if (!actor) return;

    const pos = state.position;
    const ox = actor.origin.x;
    const oy = actor.origin.y;
    const dx = pos.x - ox;
    const dy = pos.y - oy;
    const sx = typeof state.scale === 'number' ? state.scale : state.scale.x;
    const sy = typeof state.scale === 'number' ? state.scale : state.scale.y;

    g.setAttribute(
      'transform',
      `translate(${dx},${dy}) translate(${ox},${oy}) rotate(${state.rotation}) scale(${sx},${sy}) translate(${-ox},${-oy})`,
    );
    g.setAttribute('opacity', String(state.opacity));

    // Update fill/stroke on child paths
    if (state.fill || state.stroke) {
      const paths = g.querySelectorAll('path');
      paths.forEach((p) => {
        if (state.fill) p.setAttribute('fill', state.fill);
        if (state.stroke) p.setAttribute('stroke', state.stroke);
        if (state.strokeWidth !== undefined) p.setAttribute('stroke-width', String(state.strokeWidth));
      });
    }

    // Apply path morphing
    if (state.pathD) {
      const paths = g.querySelectorAll('path');
      paths.forEach((p) => p.setAttribute('d', state.pathD!));
    }

    // Apply blur filter
    if (state.blurRadius && state.blurRadius > 0) {
      g.style.filter = `blur(${state.blurRadius}px)`;
    } else {
      g.style.filter = '';
    }
  }

  private _updateSize() {
    if (!this._svgEl) return;
    this._svgEl.style.width = this.getAttribute('width') || '100%';
    this._svgEl.style.height = this.getAttribute('height') || '100%';
  }
}

// ── Registration ──

/**
 * Register the `<motion-svg>` custom element.
 * Call this once before using the element in HTML.
 *
 * @param tagName Custom tag name (default: 'motion-svg')
 */
export function registerMotionSvg(tagName = 'motion-svg') {
  if (typeof customElements !== 'undefined' && !customElements.get(tagName)) {
    customElements.define(tagName, MotionSvgElement);
  }
}
