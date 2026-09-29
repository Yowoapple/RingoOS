import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';
import { rubberband } from '../wm/geometry.js';
import { createOdometer } from './odometer.js';
import { Fx } from './fx-tier.js';
import { createGlass } from './glass.js';

const PRESS = { response: 0.14, damping: 1 };
const RELEASE = { response: 0.38, damping: 0.42 };
const TRAVEL = { response: 0.42, damping: 0.6 };
const LEAD = { response: 0.26, damping: 0.6 };
const TRAIL = { response: 0.46, damping: 0.72 };
const DRAG_THRESHOLD = 4;

function soft(config) {
  return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toPx(value) {
  const text = String(value).trim();
  const number = parseFloat(text);
  if (!Number.isFinite(number)) return 0;
  if (text.endsWith('rem')) return number * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
  return number;
}

function capture(el, id) {
  try { el.setPointerCapture(id); } catch (err) {}
}

export function createToggle(el, { checked = false, onChange } = {}) {
  const knob = el.querySelector('.tgl__knob');
  const motion = createMotion({ x: checked ? 1 : 0, s: 0, f: checked ? 1 : 0 }, { response: 0.4, damping: 0.7, restDelta: 0.001 });
  let state = checked;
  let drag = null;
  let geo = { track: 0, knob: 0, pad: 0 };

  function readGeo() {
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    geo = { track: el.clientWidth, knob: knob.offsetHeight, pad };
  }

  function measure() {
    readGeo();
    render(motion.values);
  }

  function render({ x, s, f }) {
    if (!geo.track || !geo.knob) readGeo();
    if (!geo.track || !geo.knob) return;
    const stretch = geo.knob * 0.32 * clamp(s, 0, 1.2);
    const width = geo.knob + stretch;
    const room = geo.track - geo.pad * 2 - width;
    const left = geo.pad + clamp(x, -0.15, 1.15) * room;
    knob.style.width = `${width}px`;
    knob.style.transform = `translate3d(${left - geo.pad}px, 0, 0)`;
    el.style.setProperty('--fill', clamp(f, 0, 1).toFixed(3));
  }

  function commit(next) {
    const changed = next !== state;
    state = next;
    el.setAttribute('aria-checked', String(state));
    motion.to({ x: state ? 1 : 0 }, soft(TRAVEL));
    motion.to({ f: state ? 1 : 0 }, soft({ response: 0.3, damping: 1 }));
    motion.to({ s: 0 }, soft(RELEASE));
    if (changed && onChange) onChange(state);
  }

  el.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, start: motion.get('x'), moved: false };
    capture(el, event.pointerId);
    if (!MotionSettings.reduced) motion.to({ s: 1 }, PRESS);
  });
  el.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
    drag.moved = true;
    const room = Math.max(1, geo.track - geo.pad * 2 - geo.knob * 1.32);
    const raw = drag.start + dx / room;
    const banded = raw < 0 ? -rubberband(-raw, 1, 0.3) : raw > 1 ? 1 + rubberband(raw - 1, 1, 0.3) : raw;
    motion.to({ x: banded }, { response: 0.1, damping: 1 });
    motion.to({ f: clamp(banded, 0, 1) }, { response: 0.1, damping: 1 });
  });
  const end = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    if (moved) {
      commit(motion.get('x') > 0.5);
      el.dataset.dragged = '1';
    } else {
      motion.to({ s: 0 }, soft(RELEASE));
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('click', () => {
    if (el.dataset.dragged) {
      delete el.dataset.dragged;
      return;
    }
    commit(!state);
  });

  motion.onUpdate(render);
  el.setAttribute('role', 'switch');
  el.setAttribute('aria-checked', String(state));
  new ResizeObserver(measure).observe(el);
  measure();

  return {
    get checked() { return state; },
    set(next) { if (next !== state) commit(next); },
  };
}

export function createSlider(el, { min = 0, max = 1, step = 0.01, value = 0, format = (v) => String(v), onInput } = {}) {
  const track = el.querySelector('.sld__track');
  const fill = el.querySelector('.sld__fill');
  const thumb = el.querySelector('.sld__thumb');
  const bubble = el.querySelector('.sld__bubble');
  const host = bubble.querySelector('.odo-host');
  const span = max - min;
  const decimals = Math.max(0, (String(step).split('.')[1] || '').length);
  const toUnit = (v) => (v - min) / span;
  const snap = (v) => clamp(Math.round((v - min) / step) * step + min, min, max);
  let current = snap(value);
  const odometer = createOdometer(host, { value: Math.round(current / step), format: (units) => format(Number((units * step).toFixed(decimals))) });
  const motion = createMotion({ p: toUnit(current), g: 0 }, { response: 0.3, damping: 0.8, restDelta: { p: 0.0005, g: 0.002 } });
  let drag = null;

  function render({ p, g }) {
    const width = track.clientWidth;
    const shown = clamp(p, -0.06, 1.06);
    const x = shown * width;
    fill.style.transform = `scaleX(${clamp(shown, 0, 1)})`;
    thumb.style.transform = `translate3d(${x}px, 0, 0) translate(-50%, -50%) scale(${1 + 0.28 * clamp(g, 0, 1.2)})`;
    const lift = clamp(g, 0, 1.1);
    bubble.style.opacity = String(clamp(g, 0, 1));
    bubble.style.transform = `translate3d(${x}px, ${(1 - lift) * 6}px, 0) translate(-50%, 0) scale(${0.7 + 0.3 * lift})`;
  }

  function setValue(next, { animate = true, emit = true } = {}) {
    const snapped = snap(next);
    const changed = snapped !== current;
    current = snapped;
    el.setAttribute('aria-valuenow', String(current));
    el.setAttribute('aria-valuetext', format(current));
    odometer.set(Math.round(current / step));
    if (animate) motion.to({ p: toUnit(current) }, soft({ response: 0.34, damping: 0.72 }));
    else motion.set({ p: toUnit(current) });
    if (changed && emit && onInput) onInput(current);
  }

  function unitAt(clientX) {
    const rect = track.getBoundingClientRect();
    return (clientX - rect.left) / Math.max(1, rect.width);
  }

  el.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    drag = { id: event.pointerId };
    capture(el, event.pointerId);
    el.focus({ preventScroll: true });
    motion.to({ g: 1 }, soft({ response: 0.28, damping: 0.6 }));
    const unit = unitAt(event.clientX);
    setValue(min + clamp(unit, 0, 1) * span);
  });
  el.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const unit = unitAt(event.clientX);
    const banded = unit < 0 ? -rubberband(-unit, 1, 0.12) : unit > 1 ? 1 + rubberband(unit - 1, 1, 0.12) : unit;
    const snapped = snap(min + clamp(unit, 0, 1) * span);
    if (snapped !== current) {
      current = snapped;
      el.setAttribute('aria-valuenow', String(current));
      el.setAttribute('aria-valuetext', format(current));
      odometer.set(Math.round(current / step));
      if (onInput) onInput(current);
    }
    motion.to({ p: banded }, { response: 0.08, damping: 1 });
  });
  const end = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    motion.to({ p: toUnit(current) }, soft({ response: 0.4, damping: 0.62 }));
    motion.to({ g: 0 }, soft({ response: 0.36, damping: 0.7 }));
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('keydown', (event) => {
    const deltas = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: step * 10, PageDown: -step * 10 };
    if (event.key === 'Home') setValue(min);
    else if (event.key === 'End') setValue(max);
    else if (deltas[event.key] !== undefined) setValue(current + deltas[event.key]);
    else return;
    event.preventDefault();
  });

  motion.onUpdate(render);
  el.setAttribute('role', 'slider');
  el.setAttribute('aria-valuemin', String(min));
  el.setAttribute('aria-valuemax', String(max));
  setValue(current, { animate: false, emit: false });
  new ResizeObserver(() => render(motion.values)).observe(track);

  return {
    get value() { return current; },
    set: (next) => setValue(next, { emit: false }),
  };
}

export function createSelect(el, { options, value, onChange, menuHost }) {
  const button = el.querySelector('.sel__btn');
  const valueEl = el.querySelector('.sel__value');
  const menu = document.createElement('div');
  menu.className = 'sel__menu';
  menu.setAttribute('role', 'listbox');
  menu.innerHTML = '<span class="sel__shadow" aria-hidden="true"></span><span class="sel__glass" aria-hidden="true"></span><span class="sel__fill" aria-hidden="true"></span><span class="sel__platter" aria-hidden="true"></span><div class="sel__list"></div>';
  (menuHost || document.body).appendChild(menu);
  const shadow = menu.querySelector('.sel__shadow');
  const glass = menu.querySelector('.sel__glass');
  const fillEl = menu.querySelector('.sel__fill');
  const platter = menu.querySelector('.sel__platter');
  const list = menu.querySelector('.sel__list');
  const listId = `sel-${Math.random().toString(36).slice(2, 8)}`;
  list.id = listId;
  list.tabIndex = -1;
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-controls', listId);
  button.setAttribute('aria-expanded', 'false');

  let current = value;
  let open = false;
  let viaKeyboard = false;
  let active = -1;
  let box = { w: 0, h: 0, bw: 0, bh: 0, r: 0, br: 0 };
  const items = options.map((option) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'sel__item';
    item.setAttribute('role', 'option');
    item.dataset.value = option.value;
    item.innerHTML = '<span class="sel__label"></span><svg class="sel__check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    item.querySelector('.sel__label').textContent = option.label;
    item.tabIndex = -1;
    list.appendChild(item);
    const motion = createMotion({ e: 0 }, { response: 0.3, damping: 0.78, restDelta: 0.002 });
    motion.onUpdate(({ e }) => {
      const t = clamp(e, 0, 1);
      item.style.opacity = String(t);
      item.style.transform = t > 0.999 ? '' : `translate3d(0, ${(1 - t) * -5}px, 0) scale(${0.94 + 0.06 * t})`;
      item.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 4).toFixed(2)}px)` : '';
    });
    return { option, item, motion };
  });
  const shape = createMotion({ o: 0 }, { response: 0.4, damping: 0.7, restDelta: 0.0005 });
  const edges = createMotion({ t: 0, b: 0, v: 0 }, { response: 0.3, damping: 0.8, restDelta: { t: 0.05, b: 0.05, v: 0.002 } });
  const swap = createMotion({ e: 1 }, { response: 0.3, damping: 1, restDelta: 0.002 });
  let timers = [];
  let itemH = 0;
  const hoverGlass = createGlass(platter, {
    variable: '--lens-hover',
    band: 4,
    strength: 3.5,
    measure: () => ({ w: platter.offsetWidth, h: itemH, r: parseFloat(getComputedStyle(platter).borderTopLeftRadius) || 8 }),
  });

  function labelOf(v) {
    const found = options.find((option) => option.value === v);
    return found ? found.label : '';
  }

  function later(fn, ms) {
    if (MotionSettings.reduced) fn();
    else timers.push(window.setTimeout(fn, ms));
  }

  function place() {
    const rect = button.getBoundingClientRect();
    menu.style.minWidth = `${rect.width}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.top}px`;
    box = {
      w: menu.offsetWidth,
      h: menu.offsetHeight,
      bw: rect.width,
      bh: rect.height,
      r: toPx(getComputedStyle(menu).getPropertyValue('--sel-r')) || 14,
      br: parseFloat(getComputedStyle(button).borderTopLeftRadius) || 10,
    };
    const room = window.innerHeight - rect.top - 12;
    const shift = Math.min(0, room - box.h);
    menu.style.top = `${rect.top + shift}px`;
    box.shift = shift;
    const glassClip = `inset(0 round ${box.r}px)`;
    glass.style.clipPath = glassClip;
    itemH = items[0].item.offsetHeight;
    hoverGlass.refresh();
  }

  function paintShape({ o }) {
    const t = clamp(o, 0, 1);
    const buttonTop = -box.shift;
    const top = buttonTop * (1 - t);
    const right = (box.w - box.bw) * (1 - t);
    const bottom = (box.h - buttonTop - box.bh) * (1 - t);
    const r = box.br + (box.r - box.br) * t;
    const clip = `inset(${top}px ${right}px ${bottom}px 0 round ${r}px)`;
    fillEl.style.clipPath = clip;
    list.style.clipPath = clip;
    platter.style.visibility = open && o > 0.97 ? '' : 'hidden';
    shadow.style.transform = `translate3d(0, ${top}px, 0)`;
    shadow.style.width = `${Math.max(0, box.w - right)}px`;
    shadow.style.height = `${Math.max(0, box.h - top - bottom)}px`;
    shadow.style.borderRadius = `${r}px`;
    const over = Math.max(0, o - 1);
    menu.style.transformOrigin = `${box.bw / 2}px ${buttonTop + box.bh / 2}px`;
    menu.style.transform = over > 0.0005 ? `scale(${1 + over * 0.12})` : '';
    glass.style.opacity = open && o > 0.97 ? '1' : '0';
    menu.style.visibility = o > 0.002 || open ? 'visible' : 'hidden';
  }

  function paintPlatter({ t, b, v }) {
    platter.style.transform = `translate3d(0, ${Math.min(t, b)}px, 0)`;
    platter.style.height = `${Math.max(0, Math.abs(b - t))}px`;
    platter.style.opacity = String(clamp(v, 0, 1));
  }

  function highlight(index, immediate = false) {
    if (index < 0 || index >= items.length) return;
    active = index;
    items.forEach((entry, i) => entry.item.classList.toggle('is-active', i === index));
    const el2 = items[index].item;
    const top = list.offsetTop + el2.offsetTop;
    const bottom = top + el2.offsetHeight;
    if (immediate || edges.get('v') < 0.05) {
      edges.set({ t: top, b: bottom });
      edges.to({ v: 1 }, { response: 0.2, damping: 1 });
      return;
    }
    const down = top >= edges.get('t');
    edges.to({ b: bottom }, soft(down ? LEAD : TRAIL));
    edges.to({ t: top }, soft(down ? TRAIL : LEAD));
  }

  function show() {
    if (open) return;
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
    open = true;
    menu.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    el.classList.add('is-open');
    place();
    const index = Math.max(0, items.findIndex((entry) => entry.option.value === current));
    items.forEach((entry) => {
      entry.item.setAttribute('aria-selected', String(entry.option.value === current));
      entry.motion.set({ e: 0 });
    });
    shape.set({ o: shape.get('o') });
    shape.to({ o: 1 }, soft({ response: 0.42, damping: 0.66 }));
    items.forEach((entry, i) => later(() => entry.motion.to({ e: 1 }, soft({ response: 0.3, damping: 0.78 })), 40 + i * 24));
    edges.set({ v: 0 });
    later(() => {
      highlight(index, true);
      if (viaKeyboard) items[index].item.focus({ preventScroll: true });
      else list.focus({ preventScroll: true });
    }, 60);
  }

  function hide({ focus = true } = {}) {
    if (!open) return;
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
    open = false;
    button.setAttribute('aria-expanded', 'false');
    el.classList.remove('is-open');
    glass.style.opacity = '0';
    items.forEach((entry) => entry.motion.to({ e: 0 }, soft({ response: 0.14, damping: 1 })));
    edges.to({ v: 0 }, { response: 0.16, damping: 1 });
    later(() => shape.to({ o: 0 }, soft({ response: 0.34, damping: 0.78 })).then((done) => {
      if (done && !open) menu.classList.remove('is-open');
    }), 50);
    if (focus) button.focus({ preventScroll: true });
  }

  function choose(v) {
    const changed = v !== current;
    current = v;
    hide();
    if (!changed) return;
    if (MotionSettings.reduced) {
      valueEl.textContent = labelOf(v);
    } else {
      swap.to({ e: 0 }, { response: 0.14, damping: 1 }).then(() => {
        valueEl.textContent = labelOf(current);
        swap.to({ e: 1 }, { response: 0.36, damping: 0.72 });
      });
    }
    if (onChange) onChange(v);
  }

  swap.onUpdate(({ e }) => {
    const t = clamp(e, 0, 1);
    valueEl.style.opacity = String(t);
    valueEl.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 4).toFixed(2)}px)` : '';
    valueEl.style.transform = t < 0.999 ? `translate3d(0, ${(1 - t) * 4}px, 0)` : '';
  });
  shape.onUpdate(paintShape);
  edges.onUpdate(paintPlatter);

  button.addEventListener('click', (event) => {
    viaKeyboard = event.detail === 0;
    if (open) hide();
    else show();
  });
  button.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      viaKeyboard = true;
      show();
    }
  });
  items.forEach(({ item, option }, i) => {
    item.addEventListener('pointerenter', () => highlight(i));
    item.addEventListener('click', () => choose(option.value));
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') highlight(Math.min(items.length - 1, active + 1));
    else if (event.key === 'ArrowUp') highlight(Math.max(0, active - 1));
    else if (event.key === 'Escape') hide();
    else if (event.key === 'Tab') hide({ focus: false });
    else return;
    if (event.key !== 'Tab') event.preventDefault();
    if (active >= 0) items[active].item.focus({ preventScroll: true });
  });
  document.addEventListener('pointerdown', (event) => {
    if (open && !menu.contains(event.target) && !el.contains(event.target)) hide({ focus: false });
  });
  window.addEventListener('resize', () => { if (open) hide({ focus: false }); });

  valueEl.textContent = labelOf(current);
  paintShape({ o: 0 });

  return {
    get value() { return current; },
    set(v) {
      current = v;
      valueEl.textContent = labelOf(v);
    },
    setLabel(v, label) {
      const found = items.find((entry) => entry.option.value === v);
      if (!found) return;
      found.option.label = label;
      found.item.querySelector('.sel__label').textContent = label;
      if (v === current) valueEl.textContent = label;
    },
    close: () => hide({ focus: false }),
  };
}

export function createField(root, { validate, onCommit } = {}) {
  const input = root.querySelector('input');
  const ring = root.querySelector('.fld__ring');
  const box = root.querySelector('.fld__box');
  const msg = root.querySelector('.fld__msg');
  const msgText = msg.querySelector('span');
  const focus = createMotion({ e: 0 }, { response: 0.34, damping: 0.72, restDelta: 0.002 });
  const shake = createMotion({ x: 0 }, { response: 0.3, damping: 0.3, restDelta: 0.05 });
  const note = createMotion({ h: 0, e: 0 }, { response: 0.34, damping: 0.74, restDelta: { h: 0.05, e: 0.002 } });

  focus.onUpdate(({ e }) => {
    const t = clamp(e, 0, 1.05);
    const side = Math.max(0, 50 * (1 - t));
    ring.style.clipPath = `inset(0 ${side}% 0 ${side}% round var(--r-ctl))`;
    ring.style.opacity = e > 0.01 ? '1' : '0';
  });
  shake.onUpdate(({ x }) => {
    box.style.transform = Math.abs(x) < 0.05 ? '' : `translate3d(${x}px, 0, 0)`;
  });
  note.onUpdate(({ h, e }) => {
    msg.style.height = `${Math.max(0, h)}px`;
    const t = clamp(e, 0, 1);
    msgText.style.opacity = String(t);
    msgText.style.transform = `translate3d(0, ${(1 - t) * -4}px, 0)`;
    msgText.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 3).toFixed(2)}px)` : '';
  });

  function setError(text) {
    root.classList.toggle('is-invalid', !!text);
    input.setAttribute('aria-invalid', String(!!text));
    if (text) {
      msgText.textContent = text;
      note.to({ h: msgText.offsetHeight + 4 }, soft({ response: 0.34, damping: 0.74 }));
      note.to({ e: 1 }, soft({ response: 0.3, damping: 1 }));
      if (!MotionSettings.reduced) shake.to({ x: 0 }, { response: 0.3, damping: 0.3, velocity: { x: 520 } });
    } else {
      note.to({ e: 0 }, { response: 0.16, damping: 1 });
      note.to({ h: 0 }, soft({ response: 0.3, damping: 0.9 }));
    }
  }

  input.addEventListener('focus', () => focus.to({ e: 1 }, soft({ response: 0.34, damping: 0.72 })));
  input.addEventListener('blur', () => focus.to({ e: 0 }, soft({ response: 0.28, damping: 1 })));
  input.addEventListener('change', () => {
    const error = validate ? validate(input.value) : '';
    setError(error);
    if (!error && onCommit) onCommit(input.value);
  });
  input.addEventListener('input', () => {
    if (root.classList.contains('is-invalid') && validate && !validate(input.value)) setError('');
  });

  focus.set({ e: 0 });
  note.set({ h: 0, e: 0 });
  return { setError, input };
}
