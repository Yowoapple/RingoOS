import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';
import { rubberband } from '../wm/geometry.js';

const DRAG_THRESHOLD = 6;
const COMMIT_SHARE = 0.5;
const FLING = -900;
const FOLLOW = { response: 0.08, damping: 1 };
const SNAP_BACK = { response: 0.42, damping: 0.6 };
const FLY_OUT = { response: 0.28, damping: 1 };
const COLLAPSE = { response: 0.38, damping: 0.82 };
const EXPAND = { response: 0.46, damping: 0.72 };
const SLIDE_IN = { response: 0.5, damping: 0.62 };

function soft(config) {
  return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function createRowList(container, { render, onDelete, onSelect }) {
  const entries = [];
  let selected = null;

  function build(row) {
    const el = document.createElement('div');
    el.className = `row row--${row.type}`;
    el.tabIndex = 0;
    el.setAttribute('role', 'listitem');
    el.innerHTML = '<div class="row__action" aria-hidden="true"><span class="row__action-label">刪除</span></div><div class="row__slide"></div>';
    el.querySelector('.row__slide').appendChild(render(row));
    const entry = { row, el, slide: el.querySelector('.row__slide'), action: el.querySelector('.row__action'), label: el.querySelector('.row__action-label'), leaving: false };
    entry.motion = createMotion({ x: 0, h: 1, o: 1 }, { response: 0.4, damping: 0.7, restDelta: { x: 0.05, h: 0.002, o: 0.002 } });
    entry.motion.onUpdate((values) => paint(entry, values));
    bind(entry);
    return entry;
  }

  function paint(entry, { x, h, o }) {
    const width = entry.el.offsetWidth || 1;
    entry.slide.style.transform = Math.abs(x) < 0.05 ? '' : `translate3d(${x}px, 0, 0)`;
    const reveal = clamp(-x / width, 0, 1);
    const armed = reveal >= COMMIT_SHARE;
    entry.action.style.opacity = reveal > 0.001 ? String(clamp(reveal * 4, 0, 1)) : '0';
    entry.label.style.transform = `translate3d(${Math.min(0, x + width * 0.18) * 0.12}px, 0, 0) scale(${armed ? 1.12 : 0.86 + reveal * 0.3})`;
    entry.el.classList.toggle('is-armed', armed);
    if (entry.natural && h < 0.999) {
      entry.el.style.height = `${Math.max(0, h) * entry.natural}px`;
      entry.el.style.overflow = 'hidden';
    } else if (h >= 0.999) {
      entry.el.style.height = '';
      entry.el.style.overflow = '';
    }
    entry.el.style.opacity = o >= 0.999 ? '' : String(clamp(o, 0, 1));
  }

  function select(entry) {
    if (selected === entry) return;
    if (selected) selected.el.setAttribute('aria-selected', 'false');
    selected = entry;
    if (entry) entry.el.setAttribute('aria-selected', 'true');
    if (onSelect) onSelect(entry ? entry.row : null);
  }

  function remove(entry, { fling = false, silent = false } = {}) {
    if (entry.leaving) return Promise.resolve();
    entry.leaving = true;
    const index = entries.indexOf(entry);
    const width = entry.el.offsetWidth;
    entry.natural = entry.el.offsetHeight;
    if (selected === entry) select(null);
    const reduced = MotionSettings.reduced;
    return new Promise((resolve) => {
      const finish = () => {
        entry.el.remove();
        const at = entries.indexOf(entry);
        if (at >= 0) entries.splice(at, 1);
        entry.leaving = false;
        if (onDelete) onDelete(entry.row, index, { silent });
        resolve();
      };
      const after = (promise) => promise.then((done) => { if (done) finish(); else after(entry.motion.to({ h: 0, o: 0 }, COLLAPSE)); });
      if (reduced) {
        after(entry.motion.to({ o: 0 }, MotionSettings.spring('focus')));
        return;
      }
      entry.motion.to({ x: -width * 1.05 }, fling ? { response: 0.22, damping: 1 } : FLY_OUT);
      window.setTimeout(() => after(entry.motion.to({ h: 0 }, COLLAPSE)), 120);
    });
  }

  function bind(entry) {
    let drag = null;
    entry.el.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || entry.leaving) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: entry.motion.get('x'), swiping: false, samples: [] };
    });
    entry.el.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.swiping) {
        if (Math.abs(dx) < DRAG_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
        drag.swiping = true;
        try { entry.el.setPointerCapture(event.pointerId); } catch (err) {}
        entry.el.classList.add('is-swiping');
      }
      const width = entry.el.offsetWidth;
      const raw = drag.start + dx;
      const x = raw > 0 ? rubberband(raw, width, 0.3) : raw < -width ? -width - rubberband(-width - raw, width, 0.3) : raw;
      drag.samples.push({ t: performance.now(), x: raw });
      if (drag.samples.length > 6) drag.samples.shift();
      entry.motion.to({ x }, FOLLOW);
    });
    const end = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const state = drag;
      drag = null;
      entry.el.classList.remove('is-swiping');
      if (!state.swiping) {
        select(entry);
        return;
      }
      const first = state.samples[0];
      const last = state.samples[state.samples.length - 1];
      const velocity = first && last && last.t > first.t ? ((last.x - first.x) / (last.t - first.t)) * 1000 : 0;
      const width = entry.el.offsetWidth;
      if (-entry.motion.get('x') >= width * COMMIT_SHARE || velocity < FLING) remove(entry, { fling: velocity < FLING });
      else entry.motion.to({ x: 0 }, soft({ ...SNAP_BACK, velocity: { x: velocity } }));
    };
    entry.el.addEventListener('pointerup', end);
    entry.el.addEventListener('pointercancel', end);
    entry.el.addEventListener('keydown', (event) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        const next = entries[entries.indexOf(entry) + 1] || entries[entries.indexOf(entry) - 1];
        remove(entry);
        if (next) next.el.focus({ preventScroll: true });
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select(entry);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const target = entries[entries.indexOf(entry) + step];
        if (target) target.el.focus({ preventScroll: true });
      }
    });
    entry.el.addEventListener('focus', () => {
      if (entry.el.matches(':focus-visible')) select(entry);
    });
  }

  function insert(row, index, { animate = true, from = 'top' } = {}) {
    const entry = build(row);
    const at = clamp(index, 0, entries.length);
    const before = entries[at] ? entries[at].el : null;
    container.insertBefore(entry.el, before);
    entries.splice(at, 0, entry);
    if (!animate || MotionSettings.reduced) {
      if (animate) {
        entry.motion.set({ o: 0 });
        entry.motion.to({ o: 1 }, MotionSettings.spring('focus'));
      }
      return entry;
    }
    entry.natural = entry.el.offsetHeight;
    if (from === 'left') {
      entry.motion.set({ h: 0, x: -entry.el.offsetWidth, o: 1 });
      entry.motion.to({ h: 1 }, EXPAND);
      window.setTimeout(() => entry.motion.to({ x: 0 }, SLIDE_IN), 60);
    } else {
      entry.motion.set({ h: 0, o: 0 });
      entry.motion.to({ h: 1 }, EXPAND);
      entry.motion.to({ o: 1 }, { response: 0.3, damping: 1 });
    }
    return entry;
  }

  return {
    get size() { return entries.length; },
    rows: () => entries.map((entry) => entry.row),
    reset(rows) {
      entries.splice(0).forEach((entry) => entry.el.remove());
      selected = null;
      rows.forEach((row, i) => insert(row, i, { animate: false }));
    },
    prepend: (row) => insert(row, 0),
    restore: (row, index) => insert(row, index, { from: 'left' }),
    removeAll(stagger = 40) {
      const list = entries.slice();
      return Promise.all(list.map((entry, i) => new Promise((resolve) => {
        window.setTimeout(() => remove(entry, { silent: true }).then(resolve), MotionSettings.reduced ? 0 : i * stagger);
      })));
    },
  };
}
