import { createMotion } from '../../../src/motion/animator.js';
import { MotionSettings } from '../../../src/motion/presets.js';
import { Fx } from './fx-tier.js';
import { createOdometer, formatAmount } from './odometer.js';

const OPEN_W = { response: 0.42, damping: 0.6 };
const OPEN_H = { response: 0.5, damping: 0.64 };
const CLOSE_W = { response: 0.38, damping: 0.68 };
const CLOSE_H = { response: 0.32, damping: 0.72 };
const WIDE_W = { response: 0.45, damping: 0.55 };
const WIDE_H = { response: 0.38, damping: 0.5 };
const ROW_IN = { response: 0.3, damping: 0.78 };
const ROW_OUT = { response: 0.16, damping: 1 };
const TITLE_OPEN = { response: 0.44, damping: 0.62 };
const TITLE_CLOSE = { response: 0.38, damping: 0.7 };
const PLUS_TURN = { response: 0.5, damping: 0.5 };
const HOLD = 1800;
const TITLE_SCALE = 1.08;

export function createIsland({ root, pill, label, panel, activity, onOpen }) {
  const plus = label.querySelector('.island__plus');
  const title = label.querySelector('.island__label-text');
  const closeButton = root.querySelector('.island__close');
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
  const morph = createMotion({ ls: 1, tx: 0, ty: 0, ts: 1, px: 0, py: 0, pr: 0, c: 0 }, { response: 0.4, damping: 0.7, restDelta: { ls: 0.0005, tx: 0.05, ty: 0.05, ts: 0.0005, px: 0.05, py: 0.05, pr: 0.05, c: 0.002 } });
  let spots = { tx: 0, ty: 0, px: 0, py: 0 };
  const done = createMotion({ ring: 0, fill: 0, tick: 0, spin: 0 }, { response: 0.4, damping: 1, restDelta: 0.001 });
  const rowMotions = rows.map(bindRow);
  const activityMotions = activityRows.map(bindRow);
  const toastEl = root.querySelector('.island__toast');
  const toastText = toastEl.querySelector('.island__toast-text');
  const toastAction = toastEl.querySelector('.island__toast-action');
  const undoBadge = toastEl.querySelector('.island__undo');
  const undoRing = toastEl.querySelector('.island__undo-ring');
  const undoArrow = toastEl.querySelector('.island__undo-arrow');
  const toastAmount = toastEl.querySelector('.island__toast-amount');
  const toastStrike = toastEl.querySelector('.island__strike');
  const toastNote = toastEl.querySelector('.island__toast-note');
  let toastSign = '−';
  const toastOdometer = createOdometer(toastAmount.querySelector('.odo-host'), { value: 0, format: (value) => `${toastSign}${formatAmount(value)}` });
  const toastMotions = [toastText, toastAmount, toastNote, toastAction].map(bindRow);
  const undoMotion = createMotion({ s: 0, a: 0, k: 0 }, { response: 0.34, damping: 0.6, restDelta: 0.002 });
  undoMotion.onUpdate(({ s, a, k }) => {
    undoBadge.style.transform = `scale(${Math.max(0, s)})`;
    undoBadge.style.opacity = String(Math.max(0, Math.min(1, s * 1.5)));
    undoArrow.style.strokeDashoffset = String(1 - Math.max(0, Math.min(1, a)));
    toastStrike.style.transform = `scaleX(${Math.max(0, Math.min(1, k))})`;
    toastAmount.classList.toggle('is-struck', k > 0.5);
  });
  let toastHandler = null;
  let toastTimer = 0;
  let toastDeadline = 0;
  let toastRemaining = 0;
  let toastTotal = 1;
  let countdownFrame = 0;

  function paintCountdown() {
    const left = mode === 'toast' ? Math.max(0, Math.min(1, toastRemaining / toastTotal)) : 0;
    undoRing.style.strokeDasharray = `${left.toFixed(4)} 1`;
    undoRing.style.strokeDashoffset = String(-(1 - left));
  }

  function tickCountdown() {
    countdownFrame = 0;
    if (mode !== 'toast') return;
    if (toastDeadline) toastRemaining = Math.max(0, toastDeadline - performance.now());
    paintCountdown();
    if (toastDeadline) countdownFrame = window.requestAnimationFrame(tickCountdown);
  }

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
    el.style.filter = blur > 0.1 && Fx.tier !== 'solid' ? `blur(${blur.toFixed(2)}px)` : '';
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
    measureSpots();
  }

  function measureSpots() {
    const rowY = 1.35 * rem;
    const host = root.getBoundingClientRect();
    const ls = Math.max(0.01, morph.get('ls'));
    const box = label.getBoundingClientRect();
    const lcx = (box.left + box.right) / 2;
    const lcy = (box.top + box.bottom) / 2;
    const restCenter = (el, dx, dy) => {
      const r = el.getBoundingClientRect();
      return {
        x: lcx + ((r.left + r.right) / 2 - lcx) / ls - dx - host.left,
        y: lcy + ((r.top + r.bottom) / 2 - lcy) / ls - dy - host.top,
      };
    };
    const textW = title.offsetWidth;
    const textRest = restCenter(title, morph.get('tx'), morph.get('ty'));
    const plusRest = restCenter(plus, morph.get('px'), morph.get('py'));
    const textCx = textRest.x;
    const textCy = textRest.y;
    const plusCx = plusRest.x;
    const plusCy = plusRest.y;
    const closeSize = 1.4 * rem;
    const closeCx = size.W - 0.65 * rem - closeSize / 2;
    spots = {
      tx: 1 * rem + (textW * TITLE_SCALE) / 2 - textCx,
      ty: rowY - textCy,
      px: closeCx - plusCx,
      py: rowY - plusCy,
    };
    closeButton.style.width = `${closeSize}px`;
    closeButton.style.height = `${closeSize}px`;
    closeButton.style.left = `${closeCx - closeSize / 2}px`;
    closeButton.style.top = `${rowY - closeSize / 2}px`;
  }

  function paintMorph({ ls, tx, ty, ts, px, py, pr, c }) {
    label.style.transform = Math.abs(ls - 1) < 0.0005 ? '' : `scale(${ls})`;
    title.style.transform = Math.abs(tx) < 0.05 && Math.abs(ty) < 0.05 && Math.abs(ts - 1) < 0.0005 ? '' : `translate3d(${tx}px, ${ty}px, 0) scale(${ts})`;
    plus.style.transform = Math.abs(px) < 0.05 && Math.abs(py) < 0.05 && Math.abs(pr) < 0.05 ? '' : `translate3d(${px}px, ${py}px, 0) rotate(${pr}deg)`;
    const shown = Math.max(0, Math.min(1, c));
    closeButton.style.opacity = String(shown);
    closeButton.style.transform = `scale(${0.5 + 0.5 * Math.max(0, c)})`;
  }

  function morphTo(open, config) {
    const target = open
      ? { tx: spots.tx, ty: spots.ty, ts: TITLE_SCALE, px: spots.px, py: spots.py }
      : { tx: 0, ty: 0, ts: 1, px: 0, py: 0 };
    if (MotionSettings.reduced) {
      morph.set({ ...target, pr: open ? 45 : 0, ls: 1 });
      morph.to({ c: open ? 1 : 0 }, MotionSettings.spring('focus'));
      return;
    }
    morph.to(target, config);
    morph.to({ pr: open ? 45 : 0 }, open ? PLUS_TURN : TITLE_CLOSE);
    morph.to({ ls: 1 }, config);
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
    window.clearTimeout(toastTimer);
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
    closeButton.tabIndex = next === 'open' ? 0 : -1;
    closeButton.setAttribute('aria-hidden', String(next !== 'open'));
  }

  function hideActivity() {
    rowsOut(activityMotions);
    rowsOut(toastMotions);
    undoMotion.to({ s: 0, a: 0, k: 0 }, spring({ response: 0.16, damping: 1 }));
    toastDeadline = 0;
    toastHandler = null;
    done.to({ ring: 0, fill: 0, tick: 0 }, spring({ response: 0.18, damping: 1 }));
  }

  function collapse() {
    if (mode === 'idle') return;
    clearTimers();
    const from = mode;
    setMode('idle');
    rowsOut(rowMotions);
    hideActivity();
    morph.to({ c: 0 }, spring({ response: 0.16, damping: 1 }));
    morphTo(false, TITLE_CLOSE);
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
    labelMotion.to({ e: 1 }, spring({ response: 0.3, damping: 1 }));
    morphTo(true, TITLE_OPEN);
    later(() => morph.to({ c: 1 }, { response: 0.32, damping: 0.62 }), 120);
    toShape({ w: size.W, h: size.H }, OPEN_W, OPEN_H, 40);
    rowsIn(rowMotions, 60, 28);
    later(() => { if (onOpen) onOpen(); }, 300);
  }

  function armToast(ms) {
    window.clearTimeout(toastTimer);
    toastRemaining = ms;
    toastDeadline = performance.now() + ms;
    toastTimer = window.setTimeout(collapse, ms);
    if (!countdownFrame) countdownFrame = window.requestAnimationFrame(tickCountdown);
  }

  function pauseToast() {
    toastRemaining = Math.max(0, toastDeadline - performance.now());
    toastDeadline = 0;
    window.clearTimeout(toastTimer);
    paintCountdown();
  }

  function toast({ text: message, amount = null, income = false, note = '', action, onAction, duration = 4000 }) {
    clearTimers();
    measure();
    const from = mode;
    setMode('toast');
    rowsOut(rowMotions);
    rowsOut(activityMotions);
    done.to({ ring: 0, fill: 0, tick: 0 }, spring({ response: 0.18, damping: 1 }));
    labelMotion.to({ e: 0 }, spring({ response: 0.16, damping: 1 }));
    morph.to({ c: 0 }, spring({ response: 0.16, damping: 1 }));
    morphTo(false, { response: 0.3, damping: 1 });
    if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
    toastText.textContent = message;
    toastAmount.hidden = amount === null;
    toastNote.hidden = !note;
    toastNote.textContent = note;
    toastSign = income ? '+' : '−';
    if (amount !== null) toastOdometer.set(amount, { from: amount });
    const undoable = !!action;
    undoBadge.hidden = !undoable;
    undoBadge.disabled = !undoable;
    toastAction.textContent = action || '';
    toastAction.hidden = !undoable;
    toastHandler = onAction || null;
    undoMotion.set({ s: 0, a: 0, k: 0 });
    toastTotal = duration;
    toastRemaining = duration;
    paintCountdown();
    toastEl.style.width = 'auto';
    const width = Math.min(size.W, Math.max(size.aw, Math.ceil(toastEl.scrollWidth)));
    toastEl.style.width = `${width}px`;
    toastEl.style.marginLeft = `${-width / 2}px`;
    const start = from === 'open' ? 70 : 0;
    later(() => toShape({ w: width, h: size.ah }, WIDE_W, WIDE_H, 30), start);
    if (undoable) {
      later(() => undoMotion.to({ s: 1 }, spring({ response: 0.34, damping: 0.55 })), start + 120);
      later(() => undoMotion.to({ a: 1 }, spring({ response: 0.3, damping: 1 })), start + 260);
    }
    rowsIn(toastMotions, start + 150, 50);
    if (amount !== null) later(() => undoMotion.to({ k: 1 }, spring({ response: 0.32, damping: 1 })), start + 480);
    later(() => armToast(duration), start + 300);
  }

  function celebrate({ label: message, amount, income }) {
    clearTimers();
    measure();
    const from = mode;
    setMode('activity');
    rowsOut(rowMotions);
    labelMotion.to({ e: 0 }, spring({ response: 0.16, damping: 1 }));
    morph.to({ c: 0 }, spring({ response: 0.16, damping: 1 }));
    morphTo(false, { response: 0.3, damping: 1 });
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
  morph.onUpdate(paintMorph);
  labelMotion.onUpdate(({ e }) => {
    label.style.opacity = String(Math.max(0, Math.min(1, e)));
    label.style.filter = e < 0.98 && e > 0.02 && mode === 'activity' && Fx.tier !== 'solid' ? `blur(${((1 - e) * 4).toFixed(2)}px)` : '';
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
    if (mode !== 'idle') return;
    toShape(restTarget(), { response: 0.3, damping: 0.55 }, { response: 0.3, damping: 0.55 });
    if (!MotionSettings.reduced) morph.to({ ls: 1.05 }, { response: 0.3, damping: 0.55 });
  });
  pill.addEventListener('pointerleave', () => {
    hovering = false;
    pressed = false;
    if (mode !== 'idle') return;
    toShape(restTarget(), { response: 0.35, damping: 0.6 }, { response: 0.35, damping: 0.6 });
    morph.to({ ls: 1 }, spring({ response: 0.35, damping: 0.6 }));
  });
  pill.addEventListener('pointerdown', () => {
    pressed = true;
    if (mode !== 'idle') return;
    toShape(restTarget(), { response: 0.14, damping: 1 }, { response: 0.14, damping: 1 });
    if (!MotionSettings.reduced) morph.to({ ls: 0.92 }, { response: 0.14, damping: 1 });
  });
  pill.addEventListener('pointerup', () => { pressed = false; });
  pill.addEventListener('click', () => {
    if (mode !== 'open') open();
  });
  closeButton.addEventListener('click', collapse);
  const runUndo = () => {
    const handler = toastHandler;
    toastHandler = null;
    collapse();
    if (handler) handler();
  };
  toastAction.addEventListener('click', runUndo);
  undoBadge.addEventListener('click', runUndo);
  root.addEventListener('pointerenter', () => {
    if (mode === 'toast' && toastDeadline) pauseToast();
  });
  root.addEventListener('pointerleave', () => {
    if (mode === 'toast' && !toastDeadline) armToast(Math.max(600, toastRemaining));
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
    toast,
    formatAmount,
    relayout() {
      measure();
      if (mode === 'idle') shape.set(restTarget());
      render(shape.values);
    },
  };
}
