import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';
import { rubberband } from '../wm/geometry.js';
import { createGlass } from './glass.js';

const LEAD = { response: 0.26, damping: 0.6 };
const TRAIL = { response: 0.46, damping: 0.72 };
const LIFT = 0.12;
const DRAG_THRESHOLD = 4;

export function createSegmented(root, { onChange, onLayout } = {}) {
  const buttons = Array.from(root.querySelectorAll('[role="tab"]'));
  const platter = root.querySelector('.seg__platter');
  const blob = root.querySelector('.seg__blob');
  const lens = root.querySelector('.seg__lens');
  const last = buttons.length - 1;
  let index = Math.max(0, buttons.findIndex((button) => button.getAttribute('aria-selected') === 'true'));
  let geo = { origin: 0, pitch: 0, button: 0, width: 0, height: 0 };
  let drag = null;
  const edges = createMotion({ l: index, r: index }, { response: 0.4, damping: 0.8, restDelta: 0.0005 });
  const glass = createMotion({ g: 0 }, { response: 0.3, damping: 0.9, restDelta: 0.002 });
  const pop = createMotion({ p: 0 }, { response: 0.35, damping: 0.45, restDelta: 0.002 });

  function render() {
    const { l, r } = edges.values;
    const g = MotionSettings.reduced ? 0 : Math.max(0, Math.min(1, glass.get('g')));
    const p = pop.get('p');
    const { origin, pitch, button, width, height } = geo;
    const left = origin + Math.min(l, r) * pitch;
    const right = origin + Math.max(l, r) * pitch + button;
    const spread = right - left - button;
    const squash = Math.min(height * 0.12, spread * 0.03) + g * 1.5;
    const radius = Math.max(0, height / 2 - squash);
    blob.style.clipPath = `inset(${squash}px ${Math.max(0, width - right)}px ${squash}px ${left}px round ${radius}px)`;
    const glassy = document.documentElement.dataset.style === 'a';
    platter.style.opacity = glassy ? '0' : '';
    const center = (left + right) / 2;
    const lift = 1 + LIFT * g;
    const span = Math.max(1, right - left);
    const sx = (span / Math.max(1, button)) * lift;
    const sy = (height > 0 ? (height - squash * 2) / height : 1) * lift;
    lens.style.transform = `translate3d(${center - (button * sx) / 2}px, 0, 0) scale(${sx}, ${sy})`;
    lens.style.opacity = glassy ? '1' : '0';
    const centerIndex = (l + r) / 2;
    buttons.forEach((el, i) => {
      const w = Math.max(0, 1 - Math.abs(centerIndex - i));
      el.style.setProperty('--w', String(w));
      el.style.transform = `scale(${1 + 0.08 * p * w})`;
    });
  }

  function measure() {
    if (buttons.length === 0) return;
    geo = {
      origin: buttons[0].offsetLeft,
      pitch: buttons.length > 1 ? buttons[1].offsetLeft - buttons[0].offsetLeft : 0,
      button: buttons[0].offsetWidth,
      width: platter.offsetWidth,
      height: platter.offsetHeight,
    };
    lens.style.width = `${geo.button}px`;
    render();
    if (onLayout) onLayout(lens);
  }

  function commit(target) {
    buttons.forEach((el, i) => {
      el.setAttribute('aria-selected', String(i === target));
      el.tabIndex = i === target ? 0 : -1;
    });
    if (target === index) return false;
    index = target;
    if (onChange) onChange(target);
    return true;
  }

  function flow(target, velocity = 0) {
    const reduced = MotionSettings.reduced;
    const forward = target >= (edges.get('l') + edges.get('r')) / 2;
    const lead = reduced ? MotionSettings.spring('focus') : LEAD;
    const trail = reduced ? MotionSettings.spring('focus') : TRAIL;
    edges.to({ r: target }, { ...(forward ? lead : trail), velocity: { r: velocity } });
    edges.to({ l: target }, { ...(forward ? trail : lead), velocity: { l: velocity } });
    if (!reduced) pop.to({ p: 0 }, { response: 0.38, damping: 0.42, velocity: { p: 9 } });
  }

  function select(next, focus = false) {
    const target = Math.max(0, Math.min(last, next));
    if (focus) buttons[target].focus();
    if (commit(target)) flow(target);
  }

  function pointerToIndex(clientX) {
    const rect = root.getBoundingClientRect();
    const raw = (clientX - rect.left - geo.origin - geo.button / 2) / (geo.pitch || 1);
    if (raw < 0) return -rubberband(-raw, 1, 0.55);
    if (raw > last) return last + rubberband(raw - last, 1, 0.55);
    return raw;
  }

  root.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    drag = { id: event.pointerId, startX: event.clientX, moved: false, samples: [], hit: buttons.findIndex((el) => el.contains(event.target)) };
    try { root.setPointerCapture(event.pointerId); } catch (err) {}
    if (buttons[index].contains(event.target)) glass.to({ g: 1 }, { response: 0.24, damping: 0.8 });
  });

  root.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved && Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD) return;
    drag.moved = true;
    glass.to({ g: 1 }, { response: 0.24, damping: 0.8 });
    const x = pointerToIndex(event.clientX);
    drag.samples.push({ t: performance.now(), x });
    if (drag.samples.length > 6) drag.samples.shift();
    const forward = x >= (edges.get('l') + edges.get('r')) / 2;
    edges.to({ r: x }, { response: forward ? 0.1 : 0.2, damping: 1 });
    edges.to({ l: x }, { response: forward ? 0.2 : 0.1, damping: 1 });
  });

  function release(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const state = drag;
    drag = null;
    try { root.releasePointerCapture(event.pointerId); } catch (err) {}
    glass.to({ g: 0 }, { response: 0.4, damping: 0.85 });
    if (!state.moved) {
      if (state.hit >= 0) select(state.hit);
      return;
    }
    const samples = state.samples;
    const first = samples[0];
    const end = samples[samples.length - 1];
    const dt = Math.max(0.016, (end.t - first.t) / 1000);
    const velocity = samples.length > 1 ? (end.x - first.x) / dt : 0;
    const target = Math.max(0, Math.min(last, Math.round(end.x + velocity * 0.12)));
    commit(target);
    flow(target, velocity);
  }

  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);

  edges.onUpdate(render);
  glass.onUpdate(render);
  pop.onUpdate(render);
  buttons.forEach((el, i) => {
    el.tabIndex = i === index ? 0 : -1;
    el.addEventListener('click', (event) => {
      if (event.detail === 0) select(i);
    });
    el.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') select(index + 1, true);
      else if (event.key === 'ArrowLeft') select(index - 1, true);
      else return;
      event.preventDefault();
    });
  });

  new ResizeObserver(measure).observe(root);
  measure();
  const refraction = createGlass(lens, {
    variable: '--lens-seg',
    observe: root,
    band: 5,
    strength: 4,
    measure: () => ({ w: lens.offsetWidth, h: lens.offsetHeight, r: lens.offsetHeight / 2 }),
  });

  return {
    get index() { return index; },
    select,
    measure,
    lens,
    refreshGlass() {
      measure();
      refraction.rebuild();
    },
  };
}
