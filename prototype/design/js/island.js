import { createMotion } from '../../../src/motion/animator.js';
import { MotionSettings } from '../../../src/motion/presets.js';
import { createOdometer, formatAmount } from './odometer.js';

const OPEN_W = { response: 0.42, damping: 0.6 };
const OPEN_H = { response: 0.5, damping: 0.64 };
const CLOSE_W = { response: 0.38, damping: 0.68 };
const CLOSE_H = { response: 0.32, damping: 0.72 };
const WIDE_W = { response: 0.45, damping: 0.55 };
const WIDE_H = { response: 0.38, damping: 0.5 };
const ROW_IN = { response: 0.3, damping: 0.78 };
const ROW_OUT = { response: 0.16, damping: 1 };
const HOLD = 1800;

export function createIsland({ root, pill, label, panel, activity, onOpen }) {
  const rows = Array.from(panel.querySelectorAll('.island__row'));
  const badge = activity.querySelector('.island__badge');
  const ring = activity.querySelector('.island__ring');
  const fill = activity.querySelector('.island__fill');
  const tick = activity.querySelector('.island__tick');
  const text = activity.querySelector('.island__activity-text');
  const amountEl = activity.querySelector('.island__activity-amount');
  const activityRows = [text, amountEl];
  let sign = '−';
  const odometer = createOdometer(amountEl.querySelector('.odo-host'), { value: 0, format: (value) => `${sign}${formatAmount(value)}` });

  const shape = createMotion({ w: 0, h: 0 }, { response: 0.4, damping: 0.7, restDelta: 0.05 });
  const labelMotion = createMotion({ e: 1 }, { response: 0.3, damping: 1, restDelta: 0.002 });
  const done = createMotion({ ring: 0, fill: 0, tick: 0, spin: 0 }, { response: 0.4, damping: 1, restDelta: 0.001 });
  const rowMotions = rows.map(bindRow);
  const activityMotions = activityRows.map(bindRow);

  let mode = 'idle';
  let hovering = false;
  let pressed = false;
  let timers = [];
  let rem = 20.8;
  let size = { W: 0, H: 0, w0: 0, h0: 0, aw: 0, ah: 0, R: 0 };

  function bindRow(row) {
    const motion = createMotion({ e: 0 }, { response: 0.42, damping: 0.74, restDelta: 0.002 });
    motion.onUpdate(({ e }) => paintContent(row, e));
    paintContent(row, 0);
    return motion;
  }

  function paintContent(el, e) {
    const t = Math.max(0, e);
    const blur = Math.max(0, (1 - Math.min(1, t)) * 5);
    el.style.opacity = String(Math.min(1, t));
    el.style.transform = `translate3d(0, ${(1 - t) * 6}px, 0) scale(${0.9 + 0.1 * t})`;
    el.style.filter = blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : '';
  }

  function measure() {
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 20.8;
    size = {
      W: root.offsetWidth,
      H: root.offsetHeight,
      w0: pill.offsetWidth,
      h0: pill.offsetHeight,
      aw: 16 * rem,
      ah: 2.15 * rem,
      R: 1.6 * rem,
    };
  }

  function restTarget() {
    const { w0, h0 } = size;
    if (pressed) return { w: w0 * 0.93, h: h0 * 0.88 };
    if (hovering) return { w: w0 * 1.08, h: h0 * 1.06 };
    return { w: w0, h: h0 };
  }

  function render({ w, h }) {
    const { W, H, R } = size;
    const width = Math.max(0, w);
    const height = Math.max(0, h);
    const side = (W - width) / 2;
    const bottom = H - height;
    const radius = Math.max(0, Math.min(height / 2, R));
    root.style.clipPath = `inset(0 ${side}px ${bottom}px ${side}px round ${radius}px)`;
    root.style.setProperty('--outer-now', `${radius}px`);
    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
  }

  function spring(config) {
    return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
  }

  function clearTimers() {
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
  }

  function later(fn, ms) {
    if (MotionSettings.reduced) fn();
    else timers.push(window.setTimeout(fn, ms));
  }

  function toShape(target, wConfig, hConfig, hDelay = 0) {
    shape.to({ w: target.w }, spring(wConfig));
    later(() => shape.to({ h: target.h }, spring(hConfig)), hDelay);
  }

  function rowsIn(list, start, stagger = 32) {
    list.forEach((motion, i) => later(() => motion.to({ e: 1 }, spring(ROW_IN)), start + i * stagger));
  }

  function rowsOut(list) {
    list.forEach((motion) => motion.to({ e: 0 }, spring(ROW_OUT)));
  }

  function setMode(next) {
    mode = next;
    root.dataset.mode = next;
    panel.inert = next !== 'open';
    pill.setAttribute('aria-expanded', String(next === 'open'));
  }

  function hideActivity() {
    rowsOut(activityMotions);
    done.to({ ring: 0, fill: 0, tick: 0 }, spring({ response: 0.18, damping: 1 }));
  }

  function collapse() {
    if (mode === 'idle') return;
    clearTimers();
    const from = mode;
    setMode('idle');
    rowsOut(rowMotions);
    hideActivity();
    if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
    later(() => {
      toShape(restTarget(), CLOSE_W, CLOSE_H, 0);
      labelMotion.to({ e: 1 }, spring({ response: 0.35, damping: 0.8 }));
    }, from === 'open' ? 60 : 90);
  }

  function open() {
    if (mode === 'open') return;
    clearTimers();
    measure();
    setMode('open');
    hideActivity();
    labelMotion.to({ e: 0.55 }, spring({ response: 0.3, damping: 1 }));
    toShape({ w: size.W, h: size.H }, OPEN_W, OPEN_H, 40);
    rowsIn(rowMotions, 60, 28);
    later(() => { if (onOpen) onOpen(); }, 300);
  }

  function celebrate({ label: message, amount, income }) {
    clearTimers();
    measure();
    const from = mode;
    setMode('activity');
    rowsOut(rowMotions);
    labelMotion.to({ e: 0 }, spring({ response: 0.16, damping: 1 }));
    if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
    text.textContent = message;
    sign = income ? '+' : '−';
    odometer.set(0, { from: 0 });
    done.set({ ring: 0, fill: 0, tick: 0, spin: 0 });
    const start = from === 'open' ? 70 : 0;
    later(() => toShape({ w: size.aw, h: size.ah }, WIDE_W, WIDE_H, 30), start);
    later(() => done.to({ ring: 1, spin: 1 }, spring({ response: 0.5, damping: 1 })), start + 120);
    later(() => done.to({ fill: 1 }, spring({ response: 0.34, damping: 0.55 })), start + 470);
    later(() => done.to({ tick: 1 }, spring({ response: 0.26, damping: 1 })), start + 560);
    rowsIn(activityMotions, start + 150, 50);
    later(() => odometer.set(amount), start + 260);
    later(collapse, start + HOLD + 300);
  }

  shape.onUpdate(render);
  labelMotion.onUpdate(({ e }) => {
    label.style.opacity = String(Math.max(0, Math.min(1, e)));
    label.style.filter = e < 0.98 && e > 0.02 && mode === 'activity' ? `blur(${((1 - e) * 4).toFixed(2)}px)` : '';
  });
  done.onUpdate(({ ring: r, fill: f, tick: t, spin }) => {
    const clamp = (value) => Math.max(0, Math.min(1, value));
    ring.style.strokeDashoffset = String(1 - clamp(r));
    ring.style.opacity = r > 0.01 ? '1' : '0';
    badge.style.transform = `rotate(${(1 - clamp(spin)) * -90}deg)`;
    fill.style.transform = `scale(${Math.max(0, f)})`;
    tick.style.strokeDashoffset = String(1 - clamp(t));
  });

  pill.addEventListener('pointerenter', () => {
    hovering = true;
    if (mode === 'idle') toShape(restTarget(), { response: 0.3, damping: 0.55 }, { response: 0.3, damping: 0.55 });
  });
  pill.addEventListener('pointerleave', () => {
    hovering = false;
    pressed = false;
    if (mode === 'idle') toShape(restTarget(), { response: 0.35, damping: 0.6 }, { response: 0.35, damping: 0.6 });
  });
  pill.addEventListener('pointerdown', () => {
    pressed = true;
    if (mode === 'idle') toShape(restTarget(), { response: 0.14, damping: 1 }, { response: 0.14, damping: 1 });
  });
  pill.addEventListener('pointerup', () => { pressed = false; });
  pill.addEventListener('click', () => {
    if (mode !== 'open') open();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mode === 'open') collapse();
  });
  document.addEventListener('pointerdown', (event) => {
    if (mode === 'open' && !root.contains(event.target)) collapse();
  });
  window.addEventListener('resize', () => {
    measure();
    render(shape.values);
  });

  measure();
  shape.set(restTarget());
  setMode('idle');

  return {
    get mode() { return mode; },
    open,
    close: collapse,
    celebrate,
    formatAmount,
    relayout() {
      measure();
      if (mode === 'idle') shape.set(restTarget());
      render(shape.values);
    },
  };
}
