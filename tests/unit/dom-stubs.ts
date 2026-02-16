/**
 * Minimal DOM stubs for testing Web Components in Node.
 * Must be imported (via setupFiles) BEFORE any module that references HTMLElement.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

class FakeElement {
  tagName: string;
  attributes: Record<string, string> = {};
  children: FakeElement[] = [];
  style: Record<string, string> = {};
  innerHTML = '';
  namespaceURI: string;

  constructor(ns: string, tag: string) {
    this.namespaceURI = ns;
    this.tagName = tag;
  }

  setAttribute(k: string, v: string) {
    this.attributes[k] = v;
  }

  getAttribute(k: string) {
    return this.attributes[k] ?? null;
  }

  appendChild(child: FakeElement) {
    this.children.push(child);
  }

  querySelector(sel: string): FakeElement | null {
    for (const c of this.children) {
      const attr = sel.match(/\[data-actor-id="(.+?)"\]/);
      if (attr && c.attributes['data-actor-id'] === attr[1]) return c;
      const found = c.querySelector(sel);
      if (found) return found;
    }
    return null;
  }

  querySelectorAll(sel: string): FakeElement[] {
    const result: FakeElement[] = [];
    for (const c of this.children) {
      if (sel === 'path' && c.tagName === 'path') result.push(c);
      result.push(...c.querySelectorAll(sel));
    }
    return result;
  }
}

if (typeof globalThis.document === 'undefined') {
  (globalThis as any).document = {
    createElementNS(ns: string, tag: string) {
      return new FakeElement(ns, tag);
    },
  };
}

if (typeof globalThis.HTMLElement === 'undefined') {
  (globalThis as any).HTMLElement = class {
    private _attrs: Record<string, string> = {};
    shadowRoot: any = null;

    attachShadow() {
      this.shadowRoot = {
        innerHTML: '',
        appendChild(child: any) {
          (this as any)._child = child;
        },
        querySelector(sel: string) {
          return (this as any)._child?.querySelector?.(sel) ?? null;
        },
      };
      return this.shadowRoot;
    }

    setAttribute(k: string, v: string) {
      const old = this._attrs[k] ?? null;
      this._attrs[k] = v;
      if ((this as any).attributeChangedCallback) {
        const ctor = (this as any).constructor;
        if (ctor.observedAttributes?.includes(k)) {
          (this as any).attributeChangedCallback(k, old, v);
        }
      }
    }

    getAttribute(k: string) {
      return this._attrs[k] ?? null;
    }

    hasAttribute(k: string) {
      return k in this._attrs;
    }

    removeAttribute(k: string) {
      const old = this._attrs[k] ?? null;
      delete this._attrs[k];
      if ((this as any).attributeChangedCallback) {
        const ctor = (this as any).constructor;
        if (ctor.observedAttributes?.includes(k)) {
          (this as any).attributeChangedCallback(k, old, null);
        }
      }
    }

    dispatchEvent(_e: any) {
      return true;
    }
  };
}

if (typeof globalThis.customElements === 'undefined') {
  const registry = new Map<string, any>();
  (globalThis as any).customElements = {
    define(name: string, ctor: any) {
      registry.set(name, ctor);
    },
    get(name: string) {
      return registry.get(name);
    },
  };
}

if (typeof globalThis.CustomEvent === 'undefined') {
  (globalThis as any).CustomEvent = class {
    type: string;
    detail: any;
    constructor(type: string, opts?: any) {
      this.type = type;
      this.detail = opts?.detail;
    }
  };
}

if (typeof globalThis.fetch === 'undefined') {
  (globalThis as any).fetch = async () => ({ text: async () => '{}' });
}
