// Popup menus and small overlay helpers.

import { h } from './dom';
import { icon } from './icons';

export interface MenuItem {
  label?: string;
  action?: () => void;
  checked?: boolean;
  disabled?: boolean;
  icon?: string;
  shortcut?: string;
  separator?: boolean;
  heading?: boolean;
  /** Keep the menu open after activation. */
  keepOpen?: boolean;
}

let openEl: HTMLElement | null = null;
let closeOpen: (() => void) | null = null;

export function closeMenus(): void {
  closeOpen?.();
}

export function openMenu(anchor: HTMLElement | { x: number; y: number }, items: MenuItem[], opts: { align?: 'start' | 'end' | 'stretch'; placement?: 'below' | 'above' } = {}): HTMLElement {
  closeMenus();
  const menu = h('div', { class: 'menu', role: 'menu' });
  for (const it of items) {
    if (it.separator) {
      menu.append(h('div', { class: 'menu__sep' }));
      continue;
    }
    if (it.heading) {
      menu.append(h('div', { class: 'menu__heading' }, it.label ?? ''));
      continue;
    }
    const row = h(
      'button',
      {
        class: ['menu__item', it.checked && 'is-checked', it.disabled && 'is-disabled'],
        type: 'button',
        role: 'menuitem',
        disabled: !!it.disabled,
        onclick: (e: Event) => {
          e.stopPropagation();
          if (it.disabled) return;
          if (!it.keepOpen) closeMenus();
          it.action?.();
        },
      },
      h('span', { class: 'menu__check' }, it.checked ? icon('check', 14) : it.icon ? icon(it.icon, 14) : null),
      h('span', { class: 'menu__label' }, it.label ?? ''),
      it.shortcut ? h('span', { class: 'menu__shortcut' }, it.shortcut) : null,
    );
    menu.append(row);
  }
  document.body.append(menu);
  const mr = menu.getBoundingClientRect();
  let x: number;
  let y: number;
  if (anchor instanceof HTMLElement) {
    const r = anchor.getBoundingClientRect();
    if (opts.align === 'stretch') menu.style.minWidth = r.width + 'px';
    const width = Math.max(mr.width, opts.align === 'stretch' ? r.width : 0);
    x = opts.align === 'end' ? r.right - width : r.left;
    const above = opts.placement === 'above' || (opts.placement !== 'below' && r.bottom + mr.height + 8 > window.innerHeight && r.top - mr.height - 8 > 0);
    y = above ? r.top - mr.height - 6 : r.bottom + 6;
  } else {
    x = anchor.x;
    y = anchor.y;
  }
  x = Math.max(8, Math.min(window.innerWidth - menu.offsetWidth - 8, x));
  y = Math.max(8, Math.min(window.innerHeight - menu.offsetHeight - 8, y));
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  const onDown = (e: Event) => {
    if (!menu.contains(e.target as Node) && !(anchor instanceof HTMLElement && anchor.contains(e.target as Node))) closeMenus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeMenus();
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
  });
  openEl = menu;
  closeOpen = () => {
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    openEl?.remove();
    openEl = null;
    closeOpen = null;
  };
  (menu.querySelector('.menu__item:not(.is-disabled)') as HTMLElement | null)?.focus({ preventScroll: true });
  return menu;
}

/** Floating panel anchored to an element (used for the export popover). Returns a close fn. */
export function openPopover(anchor: HTMLElement, content: HTMLElement, opts: { placement?: 'above' | 'below'; align?: 'start' | 'end' | 'center'; onClose?: () => void } = {}): () => void {
  closeMenus();
  const pop = h('div', { class: 'popover' }, content);
  document.body.append(pop);
  const place = () => {
    const r = anchor.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    let x = opts.align === 'end' ? r.right - pr.width : opts.align === 'center' ? r.left + r.width / 2 - pr.width / 2 : r.left;
    let y = opts.placement === 'below' ? r.bottom + 8 : r.top - pr.height - 8;
    if (y < 8) y = r.bottom + 8;
    x = Math.max(8, Math.min(window.innerWidth - pr.width - 8, x));
    y = Math.max(8, Math.min(window.innerHeight - pr.height - 8, y));
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
  };
  place();
  const ro = new ResizeObserver(place);
  ro.observe(pop);
  const onDown = (e: Event) => {
    const t = e.target as Node;
    if (!pop.contains(t) && !anchor.contains(t) && !(t as Element).closest?.('.menu')) close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
  });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    ro.disconnect();
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('keydown', onKey);
    pop.remove();
    opts.onClose?.();
  };
  return close;
}

let toastWrap: HTMLElement | null = null;

export function toast(message: string, kind: 'info' | 'error' | 'success' = 'info', ms = 3200): void {
  if (!toastWrap) {
    toastWrap = h('div', { class: 'toasts', attrs: { 'aria-live': 'polite' } });
    document.body.append(toastWrap);
  }
  const t = h('div', { class: `toast toast--${kind}` }, message);
  toastWrap.append(t);
  setTimeout(() => {
    t.classList.add('is-leaving');
    setTimeout(() => t.remove(), 300);
  }, ms);
}

/** Modal dialog. Returns { el, close }. */
export function modal(title: string, body: HTMLElement, opts: { onClose?: () => void; dismissable?: boolean; wide?: boolean } = {}): { el: HTMLElement; close: () => void } {
  const closeBtn =
    opts.dismissable === false ? null : h('button', { class: 'icon-button', type: 'button', attrs: { 'aria-label': 'Close' }, onclick: () => close() }, icon('x', 18));
  const box = h('div', { class: ['modal', opts.wide && 'modal--wide'], role: 'dialog', attrs: { 'aria-modal': 'true' } }, h('div', { class: 'modal__header' }, h('h2', { class: 'modal__title' }, title), closeBtn), body);
  const backdrop = h('div', { class: 'modal-backdrop' }, box);
  if (opts.dismissable !== false) {
    backdrop.addEventListener('pointerdown', (e) => {
      if (e.target === backdrop) close();
    });
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && opts.dismissable !== false) close();
  };
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    opts.onClose?.();
  };
  return { el: box, close };
}

export function prompt(title: string, label: string, initial = '', okLabel = 'OK'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = h('input', { class: 'input', type: 'text', value: initial }) as HTMLInputElement;
    let result: string | null = null;
    const form = h(
      'form',
      {
        class: 'modal__body',
        onsubmit: (e: Event) => {
          e.preventDefault();
          result = input.value;
          m.close();
        },
      },
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, label), input),
      h('div', { class: 'modal__actions' }, h('button', { class: 'button', type: 'button', onclick: () => m.close() }, 'Cancel'), h('button', { class: 'button button--primary', type: 'submit' }, okLabel)),
    );
    const m = modal(title, form, { onClose: () => resolve(result) });
    setTimeout(() => {
      input.focus();
      input.select();
    });
  });
}
