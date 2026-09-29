import { createMotion } from '../../../src/motion/animator.js';
import { MotionSettings } from '../../../src/motion/presets.js';
import { Fx } from './fx-tier.js';

const GROW = { response: 0.44, damping: 0.68 };
const SHRINK = { response: 0.34, damping: 0.82 };
const ITEM_IN = { response: 0.3, damping: 0.78 };
const ITEM_OUT = { response: 0.14, damping: 1 };

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rem() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 20.8;
}

function soft(config) {
  return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
}

export function createDialogHost(host) {
  const scrim = document.createElement('div');
  scrim.className = 'dlg-scrim';
  const shape = document.createElement('div');
  shape.className = 'dlg-shape';
  const box = document.createElement('div');
  box.className = 'dlg';
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'dlg-title');
  box.setAttribute('aria-describedby', 'dlg-text');
  box.innerHTML = '<h4 class="dlg__title" id="dlg-title"></h4><p class="dlg__text" id="dlg-text"></p><div class="dlg__actions"><button type="button" class="btn btn--secondary dlg__cancel"></button><button type="button" class="btn btn--danger-fill dlg__confirm"></button></div>';
  host.append(scrim, shape, box);
  const titleEl = box.querySelector('.dlg__title');
  const textEl = box.querySelector('.dlg__text');
  const cancel = box.querySelector('.dlg__cancel');
  const confirm = box.querySelector('.dlg__confirm');
  const items = [titleEl, textEl, box.querySelector('.dlg__actions')];
  const geo = createMotion({ t: 0 }, { response: 0.4, damping: 0.7, restDelta: 0.0005 });
  const dim = createMotion({ d: 0 }, { response: 0.3, damping: 1, restDelta: 0.002 });
  const itemMotions = items.map((el) => {
    const motion = createMotion({ e: 0 }, { response: 0.3, damping: 0.8, restDelta: 0.002 });
    motion.onUpdate(({ e }) => {
      const t = clamp(e, 0, 1);
      el.style.opacity = String(t);
      el.style.transform = t > 0.999 ? '' : `translate3d(0, ${(1 - t) * 6}px, 0) scale(${0.96 + 0.04 * t})`;
      el.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 4).toFixed(2)}px)` : '';
    });
    return motion;
  });
  let from = null;
  let to = null;
  let origin = null;
  let resolver = null;
  let timers = [];
  let open = false;

  function later(fn, ms) {
    if (MotionSettings.reduced) fn();
    else timers.push(window.setTimeout(fn, ms));
  }

  function clearTimers() {
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
  }

  geo.onUpdate(({ t }) => {
    if (!from || !to) return;
    const p = Math.max(0, t);
    const q = clamp(t, 0, 1);
    const cx = from.x + from.w / 2 + (to.x + to.w / 2 - from.x - from.w / 2) * q;
    const cy = from.y + from.h / 2 + (to.y + to.h / 2 - from.y - from.h / 2) * q;
    const w = from.w + (to.w - from.w) * p;
    const h = from.h + (to.h - from.h) * p;
    shape.style.left = `${cx - w / 2}px`;
    shape.style.top = `${cy - h / 2}px`;
    shape.style.width = `${Math.max(0, w)}px`;
    shape.style.height = `${Math.max(0, h)}px`;
    shape.style.borderRadius = `${from.r + (to.r - from.r) * q}px`;
    shape.style.visibility = t > 0.001 || open ? 'visible' : 'hidden';
    const blend = clamp(t / 0.35, 0, 1);
    shape.style.opacity = String(blend);
    if (origin) origin.style.opacity = blend >= 0.999 ? '0' : String(1 - blend);
  });
  dim.onUpdate(({ d }) => {
    scrim.style.opacity = String(clamp(d, 0, 1));
  });

  function finish(result) {
    if (!open) return;
    open = false;
    clearTimers();
    host.removeEventListener('keydown', onKey, true);
    box.classList.remove('is-open');
    scrim.classList.remove('is-open');
    itemMotions.forEach((motion) => motion.to({ e: 0 }, soft(ITEM_OUT)));
    dim.to({ d: 0 }, soft({ response: 0.3, damping: 1 }));
    const reset = () => {
      if (open) return;
      shape.style.visibility = 'hidden';
      if (origin) {
        origin.style.opacity = '';
        origin.focus({ preventScroll: true });
      }
    };
    if (MotionSettings.reduced) {
      geo.set({ t: 0 });
      reset();
    } else {
      later(() => geo.to({ t: 0 }, SHRINK).then((done) => { if (done) reset(); }), 60);
    }
    const resolve = resolver;
    resolver = null;
    if (resolve) resolve(result);
  }

  function onKey(event) {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      (document.activeElement === cancel ? confirm : cancel).focus();
    }
  }

  cancel.addEventListener('click', () => finish(false));
  confirm.addEventListener('click', () => finish(true));
  scrim.addEventListener('pointerdown', () => finish(false));

  return {
    confirm({ source, frame, title, text, confirmLabel = '確定', cancelLabel = '取消' }) {
      if (open) return Promise.resolve(false);
      clearTimers();
      titleEl.textContent = title;
      textEl.textContent = text;
      confirm.textContent = confirmLabel;
      cancel.textContent = cancelLabel;
      origin = source;
      const unit = rem();
      const b = source.getBoundingClientRect();
      const f = frame.getBoundingClientRect();
      const width = Math.min(20 * unit, f.width - 2 * unit);
      box.style.width = `${width}px`;
      box.style.left = '0px';
      box.style.top = '0px';
      const height = box.offsetHeight;
      const x = f.left + (f.width - width) / 2;
      const y = f.top + Math.max(2.6 * unit, (f.height - height) / 2 - unit);
      box.style.left = `${x}px`;
      box.style.top = `${y}px`;
      from = { x: b.left, y: b.top, w: b.width, h: b.height, r: parseFloat(getComputedStyle(source).borderTopLeftRadius) || 12 };
      to = { x, y, w: width, h: height, r: parseFloat(getComputedStyle(box).borderTopLeftRadius) || 26 };
      scrim.style.left = `${f.left}px`;
      scrim.style.top = `${f.top}px`;
      scrim.style.width = `${f.width}px`;
      scrim.style.height = `${f.height}px`;
      open = true;
      box.classList.add('is-open');
      scrim.classList.add('is-open');
      geo.set({ t: 0.0011 });
      geo.to({ t: 1 }, soft(GROW));
      dim.to({ d: 1 }, soft({ response: 0.32, damping: 1 }));
      items.forEach((el, i) => later(() => itemMotions[i].to({ e: 1 }, soft(ITEM_IN)), 90 + i * 40));
      host.addEventListener('keydown', onKey, true);
      later(() => cancel.focus({ preventScroll: true }), 120);
      return new Promise((resolve) => { resolver = resolve; });
    },
  };
}
