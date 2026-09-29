import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';
import { Fx } from './fx-tier.js';

const WEEK = ['一', '二', '三', '四', '五', '六', '日'];
const GROW = { response: 0.42, damping: 0.68 };
const SHRINK = { response: 0.32, damping: 0.84 };

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function soft(config) {
  return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export function createDatePicker({ trigger, host, value, onChange }) {
  const shape = document.createElement('div');
  shape.className = 'dp-shape';
  const box = document.createElement('div');
  box.className = 'dp';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', '選擇記帳日期');
  box.innerHTML = '<div class="dp__head"><button type="button" class="dp__nav" data-step="-1" aria-label="上個月"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M7.4 3L4.4 6l3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="dp__month mono" aria-live="polite"></span><button type="button" class="dp__nav" data-step="1" aria-label="下個月"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.6 3l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>'
    + `<div class="dp__week" aria-hidden="true">${WEEK.map((d) => `<span>${d}</span>`).join('')}</div>`
    + '<div class="dp__grid" role="grid"></div>';
  host.append(shape, box);
  const monthEl = box.querySelector('.dp__month');
  const grid = box.querySelector('.dp__grid');
  const navs = Array.from(box.querySelectorAll('.dp__nav'));
  const parts = [box.querySelector('.dp__head'), box.querySelector('.dp__week'), grid];
  const geo = createMotion({ t: 0 }, { response: 0.4, damping: 0.7, restDelta: 0.0005 });
  const slide = createMotion({ e: 1, dir: 1 }, { response: 0.36, damping: 0.78, restDelta: { e: 0.002, dir: 0.01 } });
  const partMotions = parts.map((el) => {
    const motion = createMotion({ e: 0 }, { response: 0.3, damping: 0.8, restDelta: 0.002 });
    motion.onUpdate(({ e }) => {
      const t = clamp(e, 0, 1);
      el.style.opacity = String(t);
      el.style.transform = t > 0.999 ? '' : `translate3d(0, ${(1 - t) * -4}px, 0)`;
      el.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 3).toFixed(2)}px)` : '';
    });
    return motion;
  });
  let selected = startOfDay(value);
  let view = new Date(selected.getFullYear(), selected.getMonth(), 1);
  let open = false;
  let from = null;
  let to = null;
  let timers = [];
  let viaKeyboard = false;

  function later(fn, ms) {
    if (MotionSettings.reduced) fn();
    else timers.push(window.setTimeout(fn, ms));
  }

  geo.onUpdate(({ t }) => {
    if (!from || !to) return;
    const p = Math.max(0, t);
    const q = clamp(t, 0, 1);
    const left = from.x + (to.x - from.x) * q;
    const top = from.y + (to.y - from.y) * q;
    const w = from.w + (to.w - from.w) * p;
    const h = from.h + (to.h - from.h) * p;
    shape.style.left = `${left}px`;
    shape.style.top = `${top}px`;
    shape.style.width = `${Math.max(0, w)}px`;
    shape.style.height = `${Math.max(0, h)}px`;
    shape.style.borderRadius = `${from.r + (to.r - from.r) * q}px`;
    const blend = clamp(t / 0.3, 0, 1);
    shape.style.opacity = String(blend);
    shape.style.visibility = t > 0.001 || open ? 'visible' : 'hidden';
    trigger.style.opacity = blend >= 0.999 ? '0' : String(1 - blend);
  });

  slide.onUpdate(({ e, dir }) => {
    const t = clamp(e, 0, 1);
    grid.style.opacity = String(t);
    grid.style.transform = t > 0.999 ? '' : `translate3d(${(1 - t) * 14 * dir}px, 0, 0)`;
    grid.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 3).toFixed(2)}px)` : '';
  });

  function today() {
    return startOfDay(new Date());
  }

  function render() {
    monthEl.textContent = `${view.getFullYear()}.${pad(view.getMonth() + 1)}`;
    const now = today();
    navs[1].disabled = view.getFullYear() > now.getFullYear() || (view.getFullYear() === now.getFullYear() && view.getMonth() >= now.getMonth());
    grid.textContent = '';
    const offset = (view.getDay() + 6) % 7;
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (let i = 0; i < offset; i += 1) grid.appendChild(document.createElement('span'));
    for (let d = 1; d <= days; d += 1) {
      const date = new Date(view.getFullYear(), view.getMonth(), d);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'dp__day mono';
      cell.textContent = String(d);
      cell.dataset.date = String(date.getTime());
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `${date.getMonth() + 1} 月 ${d} 日`);
      if (date > now) cell.disabled = true;
      if (sameDay(date, now)) cell.classList.add('is-today');
      if (sameDay(date, selected)) {
        cell.classList.add('is-selected');
        cell.setAttribute('aria-selected', 'true');
      }
      cell.tabIndex = -1;
      grid.appendChild(cell);
    }
  }

  function shiftMonth(step) {
    const next = new Date(view.getFullYear(), view.getMonth() + step, 1);
    const now = today();
    if (next > new Date(now.getFullYear(), now.getMonth(), 1)) return;
    view = next;
    render();
    slide.set({ e: 0, dir: step });
    slide.to({ e: 1 }, soft({ response: 0.36, damping: 0.78 }));
  }

  function place() {
    const t = trigger.getBoundingClientRect();
    box.style.left = '0px';
    box.style.top = '0px';
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const x = clamp(t.right - w, 8, window.innerWidth - w - 8);
    const y = Math.min(t.bottom + 8, window.innerHeight - h - 8);
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    from = { x: t.left, y: t.top, w: t.width, h: t.height, r: t.height / 2 };
    to = { x, y, w, h, r: parseFloat(getComputedStyle(box).borderTopLeftRadius) || 18 };
  }

  function focusDay(date) {
    const cell = grid.querySelector(`[data-date="${startOfDay(date).getTime()}"]`);
    if (cell && !cell.disabled) cell.focus({ preventScroll: true });
  }

  function show() {
    if (open) return;
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
    view = new Date(selected.getFullYear(), selected.getMonth(), 1);
    render();
    place();
    open = true;
    box.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    geo.set({ t: Math.max(0.0011, geo.get('t')) });
    geo.to({ t: 1 }, soft(GROW));
    partMotions.forEach((motion, i) => later(() => motion.to({ e: 1 }, soft({ response: 0.3, damping: 0.8 })), 80 + i * 36));
    later(() => {
      if (viaKeyboard) focusDay(selected);
      else box.focus({ preventScroll: true });
    }, 120);
  }

  function hide({ focus = true } = {}) {
    if (!open) return;
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
    open = false;
    box.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    partMotions.forEach((motion) => motion.to({ e: 0 }, soft({ response: 0.14, damping: 1 })));
    const reset = () => {
      if (open) return;
      shape.style.visibility = 'hidden';
      trigger.style.opacity = '';
    };
    if (MotionSettings.reduced) {
      geo.set({ t: 0 });
      reset();
    } else {
      later(() => geo.to({ t: 0 }, SHRINK).then((done) => { if (done) reset(); }), 50);
    }
    if (focus) trigger.focus({ preventScroll: true });
  }

  function choose(date) {
    const next = startOfDay(date);
    const changed = !sameDay(next, selected);
    selected = next;
    render();
    later(() => hide(), 140);
    if (changed && onChange) onChange(next);
  }

  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  box.tabIndex = -1;
  trigger.addEventListener('click', (event) => {
    viaKeyboard = event.detail === 0;
    if (open) hide();
    else show();
  });
  navs.forEach((nav) => nav.addEventListener('click', () => shiftMonth(Number(nav.dataset.step))));
  grid.addEventListener('click', (event) => {
    const cell = event.target.closest('.dp__day');
    if (!cell || cell.disabled) return;
    choose(new Date(Number(cell.dataset.date)));
  });
  box.addEventListener('keydown', (event) => {
    const focused = document.activeElement && document.activeElement.classList.contains('dp__day') ? new Date(Number(document.activeElement.dataset.date)) : selected;
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key === 'Escape') {
      event.preventDefault();
      hide();
    } else if (moves[event.key] !== undefined) {
      event.preventDefault();
      const next = new Date(focused.getFullYear(), focused.getMonth(), focused.getDate() + moves[event.key]);
      if (next > today()) return;
      if (next.getMonth() !== view.getMonth()) shiftMonth(next > focused ? 1 : -1);
      focusDay(next);
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      shiftMonth(event.key === 'PageUp' ? -1 : 1);
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (open && !box.contains(event.target) && !trigger.contains(event.target)) hide({ focus: false });
  });
  window.addEventListener('resize', () => { if (open) hide({ focus: false }); });

  return {
    get value() { return selected; },
    set(date) {
      selected = startOfDay(date);
      if (open) render();
    },
    close: () => hide({ focus: false }),
  };
}
