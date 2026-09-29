import { createMotion } from '../../../src/motion/animator.js';
import { MotionSettings } from '../../../src/motion/presets.js';

const shifts = new WeakMap();

function shiftMotion(element) {
  let motion = shifts.get(element);
  if (motion) return motion;
  motion = createMotion({ y: 0, o: 1 }, { response: 0.45, damping: 0.8, restDelta: { y: 0.05, o: 0.001 } });
  motion.onUpdate(({ y, o }) => {
    element.style.transform = Math.abs(y) < 0.05 ? '' : `translate3d(0, ${y}px, 0)`;
    element.style.opacity = o >= 0.999 ? '' : String(Math.max(0, o));
  });
  shifts.set(element, motion);
  return motion;
}

export function flip(elements, mutate) {
  const before = new Map(elements.map((element) => [element, element.getBoundingClientRect().top]));
  mutate();
  before.forEach((top, element) => {
    if (!element.isConnected) return;
    const delta = top - element.getBoundingClientRect().top;
    if (Math.abs(delta) < 0.5) return;
    const motion = shiftMotion(element);
    motion.set({ y: motion.get('y') + delta });
    motion.to({ y: 0 }, MotionSettings.spring('snap'));
  });
}

export function enter(element, fromY = -10) {
  const motion = shiftMotion(element);
  if (MotionSettings.reduced) {
    motion.set({ y: 0, o: 0 });
  } else {
    motion.set({ y: fromY, o: 0 });
  }
  motion.to({ y: 0, o: 1 }, MotionSettings.spring('open'));
}

export function pressable(element) {
  const motion = createMotion({ s: 1 }, { response: 0.3, damping: 0.7, restDelta: 0.0005 });
  motion.onUpdate(({ s }) => {
    element.style.transform = Math.abs(s - 1) < 0.0005 ? '' : `scale(${s})`;
  });
  const release = () => motion.to({ s: 1 }, { response: 0.35, damping: 0.55 });
  element.addEventListener('pointerdown', () => {
    if (!MotionSettings.reduced) motion.to({ s: 0.95 }, { response: 0.16, damping: 1 });
  });
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
  element.addEventListener('pointerleave', release);
}
