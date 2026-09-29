import { createMotion } from '../../../src/motion/animator.js';
import { MotionSettings } from '../../../src/motion/presets.js';
import { rubberband } from '../../../src/wm/geometry.js';

const STRETCH_GAIN = 0.025;
const STRETCH_MAX = 0.14;
const LIFT = 0.12;
const DRAG_THRESHOLD = 4;

export function createSegmented(root, { onChange, onLayout } = {}) {
  const buttons = Array.from(root.querySelectorAll('[role="tab"]'));
  const platter = root.querySelector('.seg__platter');
  const lens = root.querySelector('.seg__lens');
  const last = buttons.length - 1;
  let index = Math.max(0, buttons.findIndex((button) => button.getAttribute('aria-selected') === 'true'));
  let origin = 0;
  let pitch = 0;
  let drag = null;
  const motion = createMotion({ x: index, g: 0 }, { response: 0.4, damping: 0.8, restDelta: { x: 0.0005, g: 0.002 } });

  function render({ x, g }) {
    const velocity = motion.velocity('x');
    const reduced = MotionSettings.reduced;
    const stretch = reduced ? 0 : Math.min(Math.abs(velocity) * STRETCH_GAIN, STRETCH_MAX);
    const glass = reduced ? 0 : Math.max(0, Math.min(1, g));
    const scale = 1 + LIFT * glass;
    const transform = `translate3d(${origin + x * pitch}px, 0, 0) scale(${scale * (1 + stretch)}, ${scale * (1 - stretch * 0.3)})`;
    platter.style.transform = transform;
    platter.style.opacity = String(1 - glass);
    lens.style.transform = transform;
    lens.style.opacity = String(glass);
    buttons.forEach((button, i) => {
      button.style.setProperty('--w', String(Math.max(0, 1 - Math.abs(x - i))));
    });
  }

  function measure() {
    if (buttons.length === 0) return;
    origin = buttons[0].offsetLeft;
    pitch = buttons.length > 1 ? buttons[1].offsetLeft - buttons[0].offsetLeft : 0;
    const width = `${buttons[0].offsetWidth}px`;
    platter.style.width = width;
    lens.style.width = width;
    render(motion.values);
    if (onLayout) onLayout(lens);
  }

  function commit(target) {
    buttons.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === target));
      button.tabIndex = i === target ? 0 : -1;
    });
    if (target === index) return;
    index = target;
    if (onChange) onChange(target);
  }

  function settle(target, velocity = 0) {
    commit(target);
    motion.to({ x: target, g: 1 }, { ...MotionSettings.spring('snap'), velocity: { x: velocity } }).then((finished) => {
      if (finished && !drag) motion.to({ g: 0 }, { response: 0.35, damping: 1 });
    });
  }

  function select(next, focus = false) {
    const target = Math.max(0, Math.min(last, next));
    if (focus) buttons[target].focus();
    if (target === index) return;
    settle(target);
  }

  function pointerToX(clientX) {
    const rect = root.getBoundingClientRect();
    const raw = (clientX - rect.left - origin - buttons[0].offsetWidth / 2) / (pitch || 1);
    if (raw < 0) return -rubberband(-raw, 1, 0.55);
    if (raw > last) return last + rubberband(raw - last, 1, 0.55);
    return raw;
  }

  root.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    drag = { id: event.pointerId, startX: event.clientX, moved: false, samples: [{ t: performance.now(), x: motion.get('x') }] };
    try { root.setPointerCapture(event.pointerId); } catch (err) {}
    const onSelected = buttons[index].contains(event.target);
    if (onSelected && !MotionSettings.reduced) motion.to({ g: 1 }, { response: 0.22, damping: 0.85 });
  });

  root.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved && Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD) return;
    drag.moved = true;
    const x = pointerToX(event.clientX);
    drag.samples.push({ t: performance.now(), x });
    if (drag.samples.length > 6) drag.samples.shift();
    motion.to({ x, g: 1 }, { response: 0.12, damping: 1 });
  });

  function release(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const state = drag;
    drag = null;
    try { root.releasePointerCapture(event.pointerId); } catch (err) {}
    if (!state.moved) {
      const hit = buttons.findIndex((button) => button.contains(event.target));
      if (hit >= 0 && hit !== index) settle(hit);
      else motion.to({ g: 0 }, { response: 0.35, damping: 1 });
      return;
    }
    const first = state.samples[0];
    const end = state.samples[state.samples.length - 1];
    const dt = Math.max(0.016, (end.t - first.t) / 1000);
    const velocity = (end.x - first.x) / dt;
    const projected = motion.get('x') + velocity * 0.12;
    settle(Math.max(0, Math.min(last, Math.round(projected))), velocity);
  }

  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);

  motion.onUpdate(render);
  buttons.forEach((button, i) => {
    button.tabIndex = i === index ? 0 : -1;
    button.addEventListener('click', (event) => {
      if (event.detail === 0) select(i);
    });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') select(index + 1, true);
      else if (event.key === 'ArrowLeft') select(index - 1, true);
      else return;
      event.preventDefault();
    });
  });

  new ResizeObserver(measure).observe(root);
  measure();

  return {
    get index() { return index; },
    select,
    measure,
    lens,
  };
}
