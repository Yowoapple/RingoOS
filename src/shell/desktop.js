import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';
import { Fx } from '../ui/fx-tier.js';
import { createWindowStore } from '../wm/store.js';
import { createWindowManager } from '../wm/window-manager.js';
import { createDock } from '../dock/dock.js';

const CONTROL_GLYPHS = {
  close: '<path d="M4.15 4.15l3.7 3.7M7.85 4.15l-3.7 3.7" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" fill="none"/>',
  minimize: '<path d="M3.6 6h4.8" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" fill="none"/>',
  zoom: '<path d="M3.7 3.7h3.4L3.7 7.1zM8.3 8.3H4.9L8.3 4.9z" fill="currentColor" stroke="currentColor" stroke-width="0.5" stroke-linejoin="round"/>',
};
const GLYPH_IN = { response: 0.32, damping: 0.56 };
const GLYPH_OUT = { response: 0.2, damping: 1 };
const PRESS = { response: 0.14, damping: 1 };
const RELEASE = { response: 0.38, damping: 0.42 };
const DOT = { response: 0.42, damping: 0.58 };
const TIP_IN = { response: 0.3, damping: 0.62 };
const TIP_MOVE = { response: 0.3, damping: 0.8 };
const TIP_MORPH = { response: 0.34, damping: 0.7 };
const DOCK_SIZE = 54;
const DOCK_PAD = 10;

function rem() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 20.8;
}

function bindTrafficLights(group) {
  const controls = Array.from(group.querySelectorAll('[data-wm-control]')).map((el, index) => {
    el.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">${CONTROL_GLYPHS[el.dataset.wmControl] || ''}</svg>`);
    const glyph = el.lastElementChild;
    const motion = createMotion({ e: 0, p: 1 }, { response: 0.3, damping: 0.6, restDelta: 0.001 });
    motion.onUpdate(({ e, p }) => {
      const g = Math.max(0, e);
      glyph.style.opacity = String(Math.min(1, g));
      glyph.style.transform = `scale(${0.3 + 0.7 * g})`;
      const s = p * (1 + 0.08 * Math.min(1, g));
      el.style.transform = Math.abs(s - 1) < 0.001 ? '' : `scale(${s})`;
    });
    const release = () => motion.to({ p: 1 }, MotionSettings.reduced ? MotionSettings.spring('focus') : RELEASE);
    el.addEventListener('pointerdown', () => {
      if (!MotionSettings.reduced) motion.to({ p: 0.78 }, PRESS);
    });
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
    return { motion, index };
  });

  let timers = [];
  let hovering = false;
  let focused = false;

  function show(on) {
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
    controls.forEach(({ motion, index }) => {
      if (MotionSettings.reduced) {
        motion.to({ e: on ? 1 : 0 }, MotionSettings.spring('focus'));
        return;
      }
      if (!on) {
        motion.to({ e: 0 }, GLYPH_OUT);
        return;
      }
      timers.push(window.setTimeout(() => motion.to({ e: 1 }, GLYPH_IN), index * 34));
    });
  }

  function sync() {
    show(hovering || focused);
  }

  group.addEventListener('pointerenter', () => { hovering = true; sync(); });
  group.addEventListener('pointerleave', () => { hovering = false; sync(); });
  group.addEventListener('focusin', (event) => {
    focused = event.target.matches(':focus-visible');
    sync();
  });
  group.addEventListener('focusout', () => { focused = false; sync(); });
}

function bindScrollEdge(win) {
  const body = win.querySelector('.wm-window__body');
  if (!body) return;
  body.addEventListener('scroll', () => {
    win.classList.toggle('is-scrolled', body.scrollTop > 1);
  }, { passive: true });
}

function createDockDots({ dockEl, store, apps }) {
  const entries = apps.map((app) => {
    const item = dockEl.querySelector(`.dock__item[data-app-id="${app.id}"]`);
    const dot = item.querySelector('.dock__dot');
    const motion = createMotion({ s: 0, w: 0 }, { response: 0.42, damping: 0.6, restDelta: 0.002 });
    motion.onUpdate(({ s, w }) => {
      dot.style.transform = `scale(${Math.max(0, s)})`;
      dot.style.width = `${5 + 9 * Math.max(0, w)}px`;
    });
    return { app, item, motion };
  });

  function sync() {
    entries.forEach(({ app, item, motion }) => {
      const running = store.isRunning(app.id);
      const front = running && store.focusedId === app.id && store.get(app.id).state === 'open';
      item.classList.toggle('is-front', front);
      motion.to({ s: running ? 1 : 0, w: front ? 1 : 0 }, MotionSettings.reduced ? MotionSettings.spring('focus') : DOT);
    });
  }

  store.subscribe(({ type }) => {
    if (type !== 'frame') sync();
  });
  sync();
}

function createDockTip({ dockEl, dock, apps, host }) {
  const tip = document.createElement('div');
  tip.className = 'dock-tip';
  tip.setAttribute('aria-hidden', 'true');
  tip.innerHTML = '<span class="dock-tip__bg"></span><span class="dock-tip__text"></span><span class="dock-tip__measure"></span>';
  host.appendChild(tip);
  const text = tip.querySelector('.dock-tip__text');
  const measure = tip.querySelector('.dock-tip__measure');
  const titles = new Map(apps.map((app) => [app.id, app.title]));
  const motion = createMotion({ x: 0, w: 0, o: 0, s: 0.9, e: 1 }, { response: 0.3, damping: 0.8, restDelta: { x: 0.05, w: 0.05, o: 0.002, s: 0.0005, e: 0.002 } });
  let current = null;
  let baseY = 0;

  function centerOf(id) {
    const rect = dock.getIconRect(id);
    return rect.x + rect.size / 2;
  }

  function measureY() {
    const bottom = dockEl.getBoundingClientRect().bottom;
    baseY = bottom - DOCK_PAD - DOCK_SIZE * dock.magnify - 0.5 * rem() - tip.offsetHeight;
  }

  motion.onUpdate(({ x, w, o, s, e }) => {
    const width = Math.max(0, w);
    const shown = Math.max(0, Math.min(1, o));
    tip.style.width = `${width}px`;
    tip.style.opacity = String(shown);
    tip.style.transform = `translate3d(${x - width / 2}px, ${baseY + (1 - shown) * 5}px, 0) scale(${s})`;
    const t = Math.max(0, Math.min(1, e));
    text.style.opacity = String(t);
    text.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 4).toFixed(2)}px)` : '';
  });

  function show(id) {
    if (dockEl.dataset.layout === 'phone') return;
    const title = titles.get(id) || '';
    measure.textContent = title;
    const width = measure.offsetWidth;
    const x = centerOf(id);
    const visible = motion.get('o') > 0.05;
    const reduced = MotionSettings.reduced;
    measureY();
    if (!visible) {
      text.textContent = title;
      motion.set({ x, w: width, e: 1, s: reduced ? 1 : 0.86 });
      motion.to({ o: 1 }, { response: 0.2, damping: 1 });
      motion.to({ s: 1 }, reduced ? MotionSettings.spring('focus') : TIP_IN);
    } else if (id !== current) {
      text.textContent = title;
      if (reduced) {
        motion.set({ x, w: width });
      } else {
        motion.set({ e: 0.2 });
        motion.to({ e: 1 }, { response: 0.26, damping: 1 });
        motion.to({ w: width }, TIP_MORPH);
        motion.to({ x }, TIP_MOVE);
      }
    }
    current = id;
  }

  function follow() {
    if (!current || motion.get('o') < 0.05) return;
    motion.to({ x: centerOf(current) }, MotionSettings.reduced ? MotionSettings.spring('focus') : TIP_MOVE);
  }

  function hide() {
    current = null;
    motion.to({ o: 0 }, { response: 0.2, damping: 1 });
    motion.to({ s: 0.92 }, { response: 0.24, damping: 1 });
  }

  dockEl.querySelectorAll('.dock__item').forEach((item) => {
    item.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      show(item.dataset.appId);
    });
    item.addEventListener('focus', () => {
      if (item.matches(':focus-visible')) show(item.dataset.appId);
    });
    item.addEventListener('blur', hide);
  });
  dockEl.addEventListener('pointermove', follow);
  dockEl.addEventListener('pointerleave', hide);
  window.addEventListener('resize', hide);
}

export function createDesktop({ desk, areaEl, dockEl, wallEl, apps, renderIcon }) {
  const store = createWindowStore();
  let wm = null;
  const dock = createDock({
    root: dockEl,
    apps,
    store,
    renderIcon: (app) => renderIcon(app.id),
    onActivate: (id) => wm.open(id),
  });
  wm = createWindowManager({
    root: desk,
    areaEl,
    backdropEl: wallEl,
    apps,
    store,
    dock,
    renderIcon: (app) => renderIcon(app.id),
    radius: (layout) => (layout === 'phone' ? 0 : 0.9 * rem()),
  });

  areaEl.querySelectorAll('.wm-window').forEach((win) => {
    const group = win.querySelector('.wm-titlebar__controls');
    if (group) bindTrafficLights(group);
    bindScrollEdge(win);
  });
  createDockDots({ dockEl, store, apps });
  createDockTip({ dockEl, dock, apps, host: desk });

  const badgeMotions = new Map();

  function setBadge(id, count) {
    const previous = dockEl.querySelector(`.dock__item[data-app-id="${id}"] .dock__badge`);
    const was = previous ? previous.textContent : '';
    dock.setBadge(id, count);
    const badge = previous;
    if (!badge || badge.hidden || badge.textContent === was || MotionSettings.reduced) return;
    let motion = badgeMotions.get(id);
    if (!motion) {
      motion = createMotion({ s: 1 }, { response: 0.36, damping: 0.45, restDelta: 0.0005 });
      motion.onUpdate(({ s }) => {
        badge.style.transform = Math.abs(s - 1) < 0.0005 ? '' : `scale(${Math.max(0, s)})`;
      });
      badgeMotions.set(id, motion);
    }
    motion.set({ s: 0.5 });
    motion.to({ s: 1 }, { response: 0.36, damping: 0.45, velocity: { s: 4 } });
  }

  return { wm, store, dock, setBadge };
}

export const createLabDesktop = createDesktop;
