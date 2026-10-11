// Minimal timeline for animated effects: play/pause, loop and a time scrubber.
// Stills export the frame at the current time.

import type { Store } from '../state/store';
import { clamp, h, onDrag } from './dom';
import { icon } from './icons';

export class Timeline {
  readonly el: HTMLElement;
  private playBtn: HTMLButtonElement;
  private loopBtn: HTMLButtonElement;
  private head: HTMLElement;
  private label: HTMLElement;
  private track: HTMLElement;
  private durationLabel: HTMLElement;

  constructor(private store: Store) {
    this.playBtn = h('button', { class: 'icon-button', type: 'button', title: 'Play / pause (K)', onclick: () => this.toggle() }) as HTMLButtonElement;
    this.loopBtn = h('button', { class: 'icon-button', type: 'button', title: 'Loop', onclick: () => store.set({ loop: !store.state.loop }) }, icon('loop', 18)) as HTMLButtonElement;
    this.durationLabel = h('button', {
      class: 'timeline__duration',
      type: 'button',
      title: 'Click to change duration',
      onclick: () => {
        const opts = [2, 3, 5, 8, 10, 15, 30];
        const i = opts.indexOf(store.state.duration);
        store.set({ duration: opts[(i + 1) % opts.length] });
      },
    });
    this.head = h('div', { class: 'timeline__head' });
    this.label = h('span', { class: 'timeline__time' });
    const ticks = h('div', { class: 'timeline__ticks' });
    this.track = h('div', { class: 'timeline__track' }, ticks, this.head, this.label);
    onDrag(this.track, {
      start: () => {
        if (this.store.state.playing) this.store.set({ playing: false });
      },
      move: (e) => {
        const r = this.track.getBoundingClientRect();
        const t = clamp((e.clientX - r.left) / r.width, 0, 1) * this.store.state.duration;
        this.store.updateProject((p) => ({ ...p, time: Math.round(t * 100) / 100 }), { history: false });
      },
    });
    this.el = h('footer', { class: 'timeline', hidden: true }, h('div', { class: 'timeline__controls' }, this.playBtn, this.loopBtn, this.durationLabel), this.track);
    store.subscribe((s, prev) => {
      if (s.playing !== prev.playing || s.loop !== prev.loop || s.duration !== prev.duration || s.project.time !== prev.project.time) this.sync();
    });
    this.sync();
  }

  setVisible(v: boolean): void {
    if (this.el.hidden === !v) return;
    this.el.hidden = !v;
    if (!v && this.store.state.playing) this.store.set({ playing: false });
  }

  toggle(): void {
    this.store.set({ playing: !this.store.state.playing });
  }

  private sync(): void {
    const s = this.store.state;
    this.playBtn.replaceChildren(icon(s.playing ? 'pause' : 'play', 18));
    this.loopBtn.classList.toggle('is-active', s.loop);
    this.durationLabel.textContent = `${s.duration.toFixed(1)}s`;
    const t = s.project.time;
    const f = clamp(t / s.duration, 0, 1);
    this.head.style.left = f * 100 + '%';
    this.label.style.left = f * 100 + '%';
    this.label.textContent = formatTime(t);
    const ticks = this.track.querySelector('.timeline__ticks')!;
    if (ticks.childElementCount !== Math.round(s.duration * 2) + 1) {
      ticks.replaceChildren(
        ...Array.from({ length: Math.round(s.duration * 2) + 1 }, (_, i) =>
          h('span', { class: ['timeline__tick', i % 2 === 0 && 'is-major'], style: { left: (i / (s.duration * 2)) * 100 + '%' } }, i % 2 === 0 ? `${i / 2}s` : ''),
        ),
      );
    }
  }
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
