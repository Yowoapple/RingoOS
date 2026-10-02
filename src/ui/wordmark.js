import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';

export function wordmarkHTML(variant = 'line') {
  return `<span class="wm wm--${variant}" role="img" aria-label="RingoOS"><span class="wm__r" aria-hidden="true">Ringo</span><span class="wm__os" aria-hidden="true"><span class="wm__o"><i class="wm__pour"></i></span>S</span></span>`;
}

export function animateWordmark(el, { stretch = 0.62, fill = true } = {}) {
  const o = el.querySelector('.wm__o');
  const pour = el.querySelector('.wm__pour');
  const motion = createMotion({ w: 0, p: 1, f: 0 }, { response: 0.4, damping: 0.6, restDelta: { w: 0.0005, p: 0.0005, f: 0.001 } });
  let base = 0;
  let em = 16;
  let busy = false;
  motion.onUpdate(({ w, p, f }) => {
    if (!base) return;
    const extra = w * em;
    o.style.width = Math.abs(w) < 0.0005 ? '' : `${(base + extra).toFixed(2)}px`;
    const squash = Math.min(0.14, Math.max(0, extra / base) * 0.22);
    o.style.transform = Math.abs(p - 1) < 0.0005 && squash < 0.001 ? '' : `scale(${p.toFixed(4)}, ${(p * (1 - squash)).toFixed(4)})`;
    if (fill) {
      const level = Math.max(0, Math.min(1, f));
      pour.style.transform = level < 0.001 ? '' : `scaleX(${level.toFixed(4)})`;
      pour.style.opacity = level < 0.001 ? '' : '1';
    }
  });

  async function play() {
    if (busy || MotionSettings.reduced) return;
    busy = true;
    o.style.width = '';
    base = o.getBoundingClientRect().width;
    em = parseFloat(getComputedStyle(o).fontSize) || 16;
    try {
      await motion.to({ p: 0.9 }, { response: 0.14, damping: 1 });
      motion.to({ p: 1 }, { response: 0.38, damping: 0.42 });
      if (fill) motion.to({ f: 1 }, { response: 0.3, damping: 0.7 });
      await motion.to({ w: stretch }, { response: 0.26, damping: 0.6 });
      motion.to({ w: 0 }, { response: 0.46, damping: 0.5 });
      if (fill) {
        await new Promise((resolve) => window.setTimeout(resolve, 260));
        await motion.to({ f: 0 }, { response: 0.5, damping: 0.9 });
      } else {
        await motion.to({ w: 0 }, { response: 0.46, damping: 0.5 });
      }
    } finally {
      busy = false;
    }
  }

  return { play };
}
