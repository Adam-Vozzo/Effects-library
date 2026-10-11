// Tiny DOM construction helpers (no framework).

type Child = Node | string | number | null | undefined | false | Child[];
type Props = {
  class?: string | (string | false | null | undefined)[];
  style?: Partial<CSSStyleDeclaration> | Record<string, string>;
  dataset?: Record<string, string>;
  attrs?: Record<string, string | number | boolean | undefined>;
  [key: `on${string}`]: unknown;
  [key: string]: unknown;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) applyProps(el, props);
  append(el, children);
  return el;
}

export function applyProps(el: HTMLElement, props: Props): void {
  for (const k in props) {
    const v = props[k];
    if (v === undefined || v === null) continue;
    if (k === 'class') {
      el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : String(v);
    } else if (k === 'style') {
      for (const [sk, sv] of Object.entries(v as Record<string, string>)) {
        if (sk.startsWith('--')) el.style.setProperty(sk, sv);
        else (el.style as unknown as Record<string, string>)[sk] = sv;
      }
    } else if (k === 'dataset') {
      Object.assign(el.dataset, v as Record<string, string>);
    } else if (k === 'attrs') {
      for (const [ak, av] of Object.entries(v as Record<string, unknown>)) {
        if (av === false || av === undefined) continue;
        el.setAttribute(ak, av === true ? '' : String(av));
      }
    } else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else {
      (el as unknown as Record<string, unknown>)[k] = v;
    }
  }
}

export function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, ...children: (SVGElement | null)[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of children) if (c) el.appendChild(c);
  return el;
}

/** Format a number for display given the param step (e.g. step 0.01 → 2 decimals). */
export function formatNumber(v: number, step = 0.01): string {
  if (!Number.isFinite(v)) return '0';
  const decimals = step >= 1 ? 0 : Math.min(4, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)));
  return v.toFixed(decimals);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Capture pointer drags with a single callback; returns a cleanup function. */
export function onDrag(
  el: HTMLElement | SVGElement,
  handlers: {
    start?: (e: PointerEvent) => boolean | void;
    move: (e: PointerEvent) => void;
    end?: (e: PointerEvent) => void;
  },
): () => void {
  const down = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (handlers.start && handlers.start(e) === false) return;
    e.preventDefault();
    (el as Element).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => handlers.move(ev);
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move as EventListener);
      el.removeEventListener('pointerup', up as EventListener);
      el.removeEventListener('pointercancel', up as EventListener);
      handlers.end?.(ev);
    };
    el.addEventListener('pointermove', move as EventListener);
    el.addEventListener('pointerup', up as EventListener);
    el.addEventListener('pointercancel', up as EventListener);
    handlers.move(e);
  };
  el.addEventListener('pointerdown', down as EventListener);
  return () => el.removeEventListener('pointerdown', down as EventListener);
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number): (...a: A) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export function uid(prefix = 'l'): string {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}
