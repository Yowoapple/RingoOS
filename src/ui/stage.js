import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';
import { Fx } from './fx-tier.js';

export function createStage(stage, { initial }) {
  const views = new Map(Array.from(stage.querySelectorAll('[data-view]')).map((view) => [view.dataset.view, view]));
  let current = initial;
  const height = createMotion({ h: 0 }, { response: 0.42, damping: 0.74, restDelta: 0.5 });
  height.onUpdate(({ h }) => {
    stage.style.height = `${Math.max(0, h)}px`;
  });
  const motions = new Map(Array.from(views.entries()).map(([name, view]) => {
    const motion = createMotion({ e: 1 }, { response: 0.3, damping: 0.8, restDelta: 0.002 });
    motion.onUpdate(({ e }) => {
      const t = Math.max(0, Math.min(1, e));
      view.style.opacity = t > 0.999 ? '' : String(t);
      view.style.transform = t > 0.999 ? '' : `translate3d(0, ${(1 - t) * 8}px, 0)`;
      view.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 4).toFixed(2)}px)` : '';
    });
    return [name, motion];
  }));
  views.forEach((view, name) => { view.hidden = name !== current; });

  function release(view) {
    view.style.position = '';
    view.style.left = '';
    view.style.right = '';
    view.style.top = '';
  }

  return {
    get current() { return current; },
    show(name) {
      if (name === current || !views.has(name)) return;
      const from = views.get(current);
      const fromName = current;
      const to = views.get(name);
      const start = stage.offsetHeight;
      current = name;
      from.style.position = 'absolute';
      from.style.left = '0';
      from.style.right = '0';
      from.style.top = '0';
      to.hidden = false;
      stage.style.height = '';
      const end = to.offsetHeight;
      if (MotionSettings.reduced) {
        from.hidden = true;
        release(from);
        motions.get(name).set({ e: 1 });
        return;
      }
      stage.style.overflow = 'hidden';
      height.set({ h: start });
      height.to({ h: end }).then((done) => {
        if (!done) return;
        stage.style.height = '';
        stage.style.overflow = '';
      });
      motions.get(name).set({ e: 0 });
      motions.get(name).to({ e: 1 }, { response: 0.36, damping: 0.78 });
      motions.get(fromName).to({ e: 0 }, { response: 0.16, damping: 1 }).then(() => {
        if (current === fromName) return;
        from.hidden = true;
        release(from);
        motions.get(fromName).set({ e: 1 });
      });
    },
  };
}
