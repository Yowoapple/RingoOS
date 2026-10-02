import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';

const LIFETIME = 7000;
const MAX = 3;
const ENTER = { response: 0.55, damping: 0.56 };
const SETTLE = { response: 0.46, damping: 0.55 };

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createNotices(root, renderIcon) {
  const cards = [];

  function tops() {
    return new Map(cards.map((card) => [card, card.el.offsetTop]));
  }

  function settleShifts(before) {
    cards.forEach((card) => {
      const top = before.get(card);
      if (top === undefined || card.leaving) return;
      const delta = top - card.el.offsetTop;
      if (Math.abs(delta) < 0.5) return;
      card.motion.set({ y: card.motion.get('y') + delta });
      card.motion.to({ y: 0 }, MotionSettings.reduced ? MotionSettings.spring('focus') : SETTLE);
    });
  }

  function dismiss(card, velocity = 0) {
    if (card.leaving) return;
    card.leaving = true;
    window.clearTimeout(card.timer);
    const done = () => {
      const before = tops();
      card.el.remove();
      cards.splice(cards.indexOf(card), 1);
      settleShifts(before);
    };
    if (MotionSettings.reduced) {
      card.motion.to({ o: 0 }, MotionSettings.spring('close')).then(done);
      return;
    }
    card.motion.to({ x: 1.25 }, { response: 0.32, damping: 0.92, velocity: { x: Math.max(1.6, velocity) } }).then(done);
  }

  function push({ app, title, body, meta = '剛剛', onClick }) {
    const el = document.createElement('article');
    el.className = 'notice chrome';
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.innerHTML = `${renderIcon(app)}<div><div class="notice__top"><span class="notice__title"></span><span class="tag"></span></div><div class="notice__body"></div></div>`;
    el.querySelector('.notice__title').textContent = title;
    el.querySelector('.tag').textContent = meta;
    el.querySelector('.notice__body').textContent = body;

    const motion = createMotion({ x: 1.15, y: 0, s: 1, o: 0, lift: 0 }, { response: 0.5, damping: 0.6, restDelta: { x: 0.0005, y: 0.05, s: 0.0005, o: 0.001, lift: 0.001 } });
    let width = 0;
    motion.onUpdate(({ x, y, s, o, lift }) => {
      const w = width || el.offsetWidth;
      const vx = motion.velocity('x') * w;
      const vy = motion.velocity('y');
      const kx = MotionSettings.reduced ? 0 : clamp(Math.abs(vx) / 3400, 0, 0.16);
      const ky = MotionSettings.reduced ? 0 : clamp(Math.abs(vy) / 2600, 0, 0.12);
      const grow = 1 + lift * 0.02;
      const sx = s * grow * (1 + kx) * (1 - ky * 0.5);
      const sy = s * grow * (1 + ky) * (1 - kx * 0.5);
      el.style.transform = `translate3d(${(x * w).toFixed(2)}px, ${(y - lift * 2).toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      const fade = x > 0.6 ? clamp(1 - (x - 0.6) / 0.6, 0, 1) : 1;
      el.style.opacity = String(clamp(o, 0, 1) * fade);
    });
    const card = { el, motion, leaving: false, timer: 0 };

    const before = tops();
    root.prepend(el);
    cards.unshift(card);
    width = el.offsetWidth;
    if (MotionSettings.reduced) {
      motion.set({ x: 0 });
      motion.to({ o: 1 }, MotionSettings.spring('open'));
    } else {
      motion.to({ o: 1 }, { response: 0.26, damping: 1 });
      motion.to({ x: 0 }, ENTER);
    }
    settleShifts(before);

    const activate = () => {
      dismiss(card);
      if (onClick) onClick();
    };

    let start = null;
    let dragged = false;
    let last = { x: 0, t: 0, v: 0 };
    el.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      start = event.clientX;
      dragged = false;
      last = { x: event.clientX, t: performance.now(), v: 0 };
      if (!MotionSettings.reduced) motion.to({ s: 0.97 }, { response: 0.14, damping: 1 });
    });
    el.addEventListener('pointermove', (event) => {
      if (start === null) return;
      const dx = event.clientX - start;
      if (!dragged && Math.abs(dx) < 6) return;
      if (!dragged) {
        dragged = true;
        window.clearTimeout(card.timer);
        try { el.setPointerCapture(event.pointerId); } catch (err) { dragged = true; }
      }
      const now = performance.now();
      last = { x: event.clientX, t: now, v: ((event.clientX - last.x) / Math.max(1, now - last.t)) * 1000 };
      motion.set({ x: (dx > 0 ? dx : dx * 0.25) / width });
    });
    const release = () => {
      if (start === null) return;
      start = null;
      if (!MotionSettings.reduced) motion.to({ s: 1 }, { response: 0.38, damping: 0.42 });
      if (!dragged) return;
      if (motion.get('x') > 0.3 || last.v > 600) dismiss(card, last.v / width);
      else {
        motion.to({ x: 0 }, { response: 0.4, damping: 0.55, velocity: { x: last.v / width } });
        card.timer = window.setTimeout(() => dismiss(card), 2600);
      }
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('click', () => {
      if (dragged) {
        dragged = false;
        return;
      }
      activate();
    });
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate();
      } else if (event.key === 'Escape' || event.key === 'Delete') {
        dismiss(card);
      }
    });
    el.addEventListener('pointerenter', () => {
      window.clearTimeout(card.timer);
      if (!MotionSettings.reduced && !card.leaving) motion.to({ lift: 1 }, { response: 0.3, damping: 0.55 });
    });
    el.addEventListener('pointerleave', () => {
      window.clearTimeout(card.timer);
      if (!card.leaving) motion.to({ lift: 0 }, { response: 0.36, damping: 0.6 });
      card.timer = window.setTimeout(() => dismiss(card), 2600);
    });
    card.timer = window.setTimeout(() => dismiss(card), LIFETIME);
    cards.slice(MAX).forEach((old) => dismiss(old));
  }

  function dismissAll() {
    cards.slice().forEach((card) => dismiss(card));
  }

  return { push, dismissAll };
}
