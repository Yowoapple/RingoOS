import { createMotion } from '../../../src/motion/animator.js';
import { MotionSettings } from '../../../src/motion/presets.js';

const LIFETIME = 7000;
const MAX = 3;

export function createNotices(root, renderIcon) {
  const cards = [];

  function tops() {
    return new Map(cards.map((card) => [card, card.el.getBoundingClientRect().top]));
  }

  function settleShifts(before) {
    cards.forEach((card) => {
      const top = before.get(card);
      if (top === undefined) return;
      const delta = top - card.el.getBoundingClientRect().top;
      if (Math.abs(delta) < 0.5) return;
      card.motion.set({ y: card.motion.get('y') + delta });
      card.motion.to({ y: 0 }, MotionSettings.spring('snap'));
    });
  }

  function dismiss(card) {
    if (card.leaving) return;
    card.leaving = true;
    window.clearTimeout(card.timer);
    card.motion.to({ o: 0, s: 0.92, x: 0.15 }, MotionSettings.spring('close')).then(() => {
      const before = tops();
      card.el.remove();
      cards.splice(cards.indexOf(card), 1);
      settleShifts(before);
    });
  }

  function push({ app, title, body, meta = '剛剛' }) {
    const el = document.createElement('article');
    el.className = 'notice chrome';
    el.innerHTML = `${renderIcon(app)}<div><div class="notice__top"><span class="notice__title"></span><span class="tag"></span></div><div class="notice__body"></div></div>`;
    el.querySelector('.notice__title').textContent = title;
    el.querySelector('.tag').textContent = meta;
    el.querySelector('.notice__body').textContent = body;

    const motion = createMotion({ x: 1.1, y: 0, s: 0.94, o: 0 }, { response: 0.5, damping: 0.8, restDelta: { x: 0.0005, y: 0.05, s: 0.0005, o: 0.001 } });
    motion.onUpdate(({ x, y, s, o }) => {
      el.style.transform = `translate3d(${x * el.offsetWidth}px, ${y}px, 0) scale(${s})`;
      el.style.opacity = String(Math.max(0, Math.min(1, o)));
    });
    const card = { el, motion, leaving: false, timer: 0 };

    const before = tops();
    root.prepend(el);
    cards.unshift(card);
    if (MotionSettings.reduced) motion.set({ x: 0, s: 1, o: 0 });
    motion.to({ x: 0, s: 1, o: 1 }, MotionSettings.spring('open'));
    settleShifts(before);

    el.addEventListener('click', () => dismiss(card));
    card.timer = window.setTimeout(() => dismiss(card), LIFETIME);
    cards.slice(MAX).forEach(dismiss);
  }

  return { push };
}
