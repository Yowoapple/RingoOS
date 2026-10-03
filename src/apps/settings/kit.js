import { createMotion } from '../../motion/animator.js';
import { MotionSettings } from '../../motion/presets.js';
import { createSegmented } from '../../ui/segmented.js';
import { createToggle, createSlider, createSelect, createField } from '../../ui/controls.js';
import { Fx } from '../../ui/fx-tier.js';
import { pressable } from '../../ui/motion-kit.js';

const CHEVRON = '<svg class="sel__chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 4.8L6 7.3l2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function soft(config) {
  return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
}

export function money(n) {
  return `NT$ ${Math.round(n || 0).toLocaleString('en-US')}`;
}

export function h(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

export function text(tag, className, value) {
  const node = h(tag, className);
  node.textContent = value;
  return node;
}

export function row({ label, hint = '', control = null, stack = false, keywords = '' }) {
  const el = h('div', `st-row${stack ? ' st-row--stack' : ''}`);
  const copy = h('div', 'st-row__text');
  const labelEl = text('span', 'st-row__label', label);
  const hintEl = text('span', 'st-row__hint', hint);
  copy.append(labelEl, hintEl);
  el.append(copy);
  if (control) el.append(control);
  el.dataset.search = `${label} ${hint} ${keywords}`.toLowerCase();
  el.dataset.label = label;
  return { el, labelEl, hintEl };
}

export function group(children, { title = '', className = '' } = {}) {
  const el = h('section', `st-group${className ? ` ${className}` : ''}`);
  if (title) el.append(text('h4', 'st-group__title', title));
  children.forEach((child) => el.append(child.el || child));
  return el;
}

export function toggle(checked, onChange, label) {
  const el = h('button', 'tgl', '<span class="tgl__knob"></span>');
  el.type = 'button';
  if (label) el.setAttribute('aria-label', label);
  const api = createToggle(el, { checked, onChange });
  return { el, api };
}

export function select({ options, value, onChange, menuHost, label }) {
  const el = h('div', 'sel', `<button type="button" class="sel__btn"><span class="sel__value"></span>${CHEVRON}</button>`);
  if (label) el.querySelector('.sel__btn').setAttribute('aria-label', label);
  const api = createSelect(el, { options, value, onChange, menuHost });
  return { el, api };
}

export function slider({ min, max, step, value, format, onInput, label }) {
  const el = h('div', 'sld', '<span class="sld__track"><span class="sld__fill"></span></span><span class="sld__thumb"></span><span class="sld__bubble"><span class="odo-host"></span></span>');
  el.tabIndex = 0;
  if (label) el.setAttribute('aria-label', label);
  const api = createSlider(el, { min, max, step, value, format, onInput });
  return { el, api };
}

export function segmented(labels, index, onChange, { label = '', className = '' } = {}) {
  const el = h('div', `seg st-seg${className ? ` ${className}` : ''}`);
  el.setAttribute('role', 'tablist');
  if (label) el.setAttribute('aria-label', label);
  el.style.setProperty('--n', String(labels.length));
  el.style.setProperty('--chars', String(Math.max(...labels.map((name) => name.length))));
  el.innerHTML = '<span class="seg__platter" aria-hidden="true"><span class="seg__blob"></span></span><span class="seg__lens" aria-hidden="true"></span>';
  labels.forEach((name, i) => {
    const button = h('button', 'seg__btn');
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(i === index));
    button.textContent = name;
    el.append(button);
  });
  const api = createSegmented(el, { onChange });
  return { el, api };
}

export function field({ prefix = '', value = '', placeholder = '', inputmode = 'text', validate, onCommit, label = '', mono = false }) {
  const el = h('label', 'fld st-fld');
  el.innerHTML = `<span class="fld__box">${prefix ? `<span class="fld__prefix mono"></span>` : ''}<input class="fld__input${mono ? ' mono' : ''}" autocomplete="off"><span class="fld__ring" aria-hidden="true"></span></span><span class="fld__msg" aria-live="polite"><span></span></span>`;
  if (prefix) el.querySelector('.fld__prefix').textContent = prefix;
  const input = el.querySelector('input');
  input.value = value;
  input.placeholder = placeholder;
  input.inputMode = inputmode;
  if (label) input.setAttribute('aria-label', label);
  const api = createField(el, { validate, onCommit });
  return { el, input, api };
}

export function button(label, className, onClick) {
  const el = h('button', `btn ${className}`);
  el.type = 'button';
  el.textContent = label;
  pressable(el);
  if (onClick) el.addEventListener('click', onClick);
  return el;
}

export function swapText(el, value) {
  if (el.dataset.target === value) return;
  el.dataset.target = value;
  if (MotionSettings.reduced || !el.isConnected || !el.offsetParent) {
    el.textContent = value;
    return;
  }
  let motion = el.__swap;
  if (!motion) {
    motion = createMotion({ e: 1 }, { response: 0.3, damping: 1, restDelta: 0.002 });
    motion.onUpdate(({ e }) => {
      const t = clamp(e, 0, 1);
      el.style.opacity = t > 0.999 ? '' : String(t);
      el.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 4).toFixed(2)}px)` : '';
      el.style.transform = t > 0.999 ? '' : `translate3d(0, ${((1 - t) * (el.__dir || 1) * 5).toFixed(2)}px, 0)`;
    });
    el.__swap = motion;
  }
  el.__dir = -1;
  motion.to({ e: 0 }, { response: 0.16, damping: 1 }).then(() => {
    el.textContent = el.dataset.target;
    el.__dir = 1;
    motion.to({ e: 1 }, { response: 0.4, damping: 0.7 });
  });
}

export function pulse(el) {
  if (MotionSettings.reduced) return;
  let motion = el.__pulse;
  if (!motion) {
    motion = createMotion({ s: 1 }, { response: 0.4, damping: 0.5, restDelta: 0.0005 });
    motion.onUpdate(({ s }) => {
      el.style.transform = Math.abs(s - 1) < 0.0005 ? '' : `scale(${s.toFixed(4)})`;
    });
    el.__pulse = motion;
  }
  motion.set({ s: 0.96 });
  motion.to({ s: 1 }, { response: 0.42, damping: 0.45, velocity: { s: 0.6 } });
}

export const ICONS = {
  sound: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.6 6.2h2.2L8 3.4v9.2L4.8 9.8H2.6z" fill="currentColor"/><path d="M10.4 5.6a3.4 3.4 0 0 1 0 4.8M12.2 3.8a6 6 0 0 1 0 8.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  appearance: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 2.4a5.6 5.6 0 0 1 0 11.2z" fill="currentColor"/></svg>',
  motion: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.8 10.5c1.6 0 1.9-5 3.6-5s2 5 3.6 5 1.9-5 3.6-5c.8 0 1.2.6 1.6 1.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  desktop: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.8" y="2.6" width="12.4" height="9" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="4.6" y="12.6" width="6.8" height="1.6" rx=".8" fill="currentColor"/></svg>',
  notify: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2a3.8 3.8 0 0 1 3.8 3.8v2.5l1.1 1.7a.6.6 0 0 1-.5.9H3.6a.6.6 0 0 1-.5-.9l1.1-1.7V6A3.8 3.8 0 0 1 8 2.2zM6.5 12.4h3a1.5 1.5 0 0 1-3 0z" fill="currentColor"/></svg>',
  data: '<svg viewBox="0 0 16 16" aria-hidden="true"><ellipse cx="8" cy="4" rx="5" ry="1.9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 4v8c0 1 2.2 1.9 5 1.9s5-.9 5-1.9V4M3 8c0 1 2.2 1.9 5 1.9S13 9 13 8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  categories: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1.4" fill="currentColor"/><rect x="9" y="2" width="5" height="5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="9" width="5" height="5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="9" width="5" height="5" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  budget: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2a6 6 0 1 0 6 6H8z" fill="currentColor"/><path d="M9.4 1.6a5.4 5.4 0 0 1 5 5H9.4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  reminder: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.2h10a1.4 1.4 0 0 1 1.4 1.4v5.6a1.4 1.4 0 0 1-1.4 1.4H7.2L4.4 13.8V11.6H3a1.4 1.4 0 0 1-1.4-1.4V4.6A1.4 1.4 0 0 1 3 3.2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  weather: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="10.4" cy="5.6" r="2.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.6 13h6.2a2.4 2.4 0 0 0 .3-4.8 3.4 3.4 0 0 0-6.5.8A2 2 0 0 0 4.6 13z" fill="currentColor"/></svg>',
  radio: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.8" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="1.8" fill="currentColor"/></svg>',
  about: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="5.6" width="10" height="4.8" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
};
