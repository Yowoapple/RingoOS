import { createMotion } from '../../../src/motion/animator.js';
import { MotionSettings } from '../../../src/motion/presets.js';
import { createSegmented } from './segmented.js';
import { createToggle, createSlider, createSelect, createField } from './controls.js';
import { Fx } from './fx-tier.js';
import { createGlass } from './glass.js';

const LEAD = { response: 0.26, damping: 0.6 };
const TRAIL = { response: 0.46, damping: 0.72 };
const PAGE_IN = { response: 0.42, damping: 0.72 };
const PAGE_OUT = { response: 0.2, damping: 1 };
const NARROW_REM = 30;
const FX_NAMES = { full: '完整', lite: '精簡', solid: '實色' };

function soft(config) {
  return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rem() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 20.8;
}

function createVerticalPlatter(host, platter) {
  const motion = createMotion({ t: 0, b: 0, o: 0 }, { response: 0.3, damping: 0.8, restDelta: { t: 0.05, b: 0.05, o: 0.002 } });
  motion.onUpdate(({ t, b, o }) => {
    const top = Math.min(t, b);
    const height = Math.abs(b - t);
    const base = host.dataset.itemHeight ? Number(host.dataset.itemHeight) : height;
    const squash = MotionSettings.reduced ? 0 : clamp((height - base) / Math.max(1, base) * 0.08, 0, 0.1);
    platter.style.transform = `translate3d(0, ${top}px, 0) scaleX(${1 - squash})`;
    platter.style.height = `${height}px`;
    platter.style.opacity = String(clamp(o, 0, 1));
  });
  return {
    to(el, immediate) {
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      host.dataset.itemHeight = String(el.offsetHeight);
      if (immediate || motion.get('o') < 0.05) {
        motion.set({ t: top, b: bottom });
        motion.to({ o: 1 }, { response: 0.2, damping: 1 });
        return;
      }
      const down = top >= motion.get('t');
      motion.to({ b: bottom }, soft(down ? LEAD : TRAIL));
      motion.to({ t: top }, soft(down ? TRAIL : LEAD));
    },
  };
}

function createAccentPicker(root, { value, onChange }) {
  const ring = root.querySelector('.acc__ring');
  const dots = Array.from(root.querySelectorAll('.acc__dot'));
  const motion = createMotion({ l: 0, r: 0, o: 0 }, { response: 0.3, damping: 0.8, restDelta: { l: 0.05, r: 0.05, o: 0.002 } });
  let current = value;

  motion.onUpdate(({ l, r, o }) => {
    const left = Math.min(l, r);
    const width = Math.abs(r - l);
    ring.style.transform = `translate3d(${left}px, 0, 0)`;
    ring.style.width = `${width}px`;
    ring.style.opacity = String(clamp(o, 0, 1));
  });

  function place(immediate) {
    const dot = dots.find((el) => el.dataset.value === current) || dots[0];
    const inset = 0.2 * rem();
    const left = dot.offsetLeft - inset;
    const right = dot.offsetLeft + dot.offsetWidth + inset;
    dots.forEach((el) => el.setAttribute('aria-checked', String(el === dot)));
    if (immediate || motion.get('o') < 0.05) {
      motion.set({ l: left, r: right });
      motion.to({ o: 1 }, { response: 0.2, damping: 1 });
      return;
    }
    const forward = left >= motion.get('l');
    motion.to({ r: right }, soft(forward ? LEAD : TRAIL));
    motion.to({ l: left }, soft(forward ? TRAIL : LEAD));
  }

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      if (dot.dataset.value === current) return;
      current = dot.dataset.value;
      place(false);
      onChange(current);
    });
  });
  new ResizeObserver(() => place(true)).observe(root);

  return {
    set(next) {
      if (next === current) return;
      current = next;
      place(false);
    },
  };
}

export function createSettings({ root, state, menuHost, dock, onChange }) {
  const win = root.closest('.wm-window');
  const nav = root.querySelector('.set__side');
  const navButtons = Array.from(nav.querySelectorAll('.set__nav'));
  const pagesEl = root.querySelector('.set__pages');
  const pages = Array.from(root.querySelectorAll('.set__page'));
  const ids = pages.map((page) => page.dataset.page);
  const platter = createVerticalPlatter(nav, nav.querySelector('.set__platter'));
  const pageMotions = new Map(pages.map((page) => {
    const motion = createMotion({ e: 1, dir: 1 }, { response: 0.4, damping: 0.72, restDelta: { e: 0.002, dir: 0.01 } });
    motion.onUpdate(({ e, dir }) => {
      const t = clamp(e, 0, 1.05);
      page.style.opacity = String(clamp(e, 0, 1));
      page.style.transform = Math.abs(e - 1) < 0.002 ? '' : `translate3d(0, ${(1 - t) * 14 * dir}px, 0)`;
      page.style.filter = e < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - clamp(e, 0, 1)) * 5).toFixed(2)}px)` : '';
    });
    return [page, motion];
  }));
  let index = 0;
  let narrow = false;
  let sideGlass = null;

  const tabs = createSegmented(root.querySelector('.set__tabs'), {
    onChange(i) { go(i, { fromTabs: true }); },
  });

  function go(next, { fromTabs = false } = {}) {
    if (next === index || next < 0 || next >= pages.length) return;
    const dir = next > index ? 1 : -1;
    const from = pages[index];
    const to = pages[next];
    index = next;
    navButtons.forEach((button, i) => {
      if (i === next) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    platter.to(navButtons[next], false);
    if (!fromTabs) tabs.select(next);
    const outMotion = pageMotions.get(from);
    from.classList.add('is-leaving');
    from.classList.remove('is-current');
    outMotion.set({ dir: -dir });
    outMotion.to({ e: 0 }, soft(PAGE_OUT)).then((done) => {
      if (!done) return;
      from.classList.remove('is-leaving');
      from.hidden = true;
      outMotion.set({ e: 1 });
    });
    to.hidden = false;
    to.classList.add('is-current');
    pagesEl.scrollTop = 0;
    win.classList.remove('is-scrolled');
    const inMotion = pageMotions.get(to);
    inMotion.set({ e: 0, dir });
    inMotion.to({ e: 1 }, soft(PAGE_IN));
  }

  navButtons.forEach((button, i) => button.addEventListener('click', () => go(i)));
  nav.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const next = clamp(index + (event.key === 'ArrowDown' ? 1 : -1), 0, pages.length - 1);
    go(next);
    navButtons[next].focus();
  });

  pagesEl.addEventListener('scroll', () => {
    win.classList.toggle('is-scrolled', pagesEl.scrollTop > 1);
  }, { passive: true });

  new ResizeObserver(() => {
    const next = root.clientWidth < NARROW_REM * rem();
    if (next !== narrow) {
      narrow = next;
      win.classList.toggle('is-narrow', narrow);
      root.classList.toggle('is-narrow', narrow);
      if (sideGlass) sideGlass.refresh();
    }
    if (!narrow && navButtons[index].offsetHeight) platter.to(navButtons[index], true);
  }).observe(root);

  const selects = {
    style: createSelect(root.querySelector('[data-select="style"]'), {
      options: [{ value: 'a', label: '混合玻璃' }, { value: 'c', label: '首爾單色' }],
      value: state.style,
      menuHost,
      onChange: (v) => onChange('style', v),
    }),
    fx: createSelect(root.querySelector('[data-select="fx"]'), {
      options: [{ value: 'auto', label: '自動' }, { value: 'full', label: '完整' }, { value: 'lite', label: '精簡' }, { value: 'solid', label: '實色' }],
      value: Fx.choice,
      menuHost,
      onChange: (v) => Fx.set(v),
    }),
    motion: createSelect(root.querySelector('[data-select="motion"]'), {
      options: [{ value: 'hyperos', label: '澎湃 OS' }, { value: 'ios', label: 'iOS' }],
      value: MotionSettings.presetName,
      menuHost,
      onChange: (v) => onChange('motion', v),
    }),
  };

  const theme = createSegmented(root.querySelector('[data-seg="theme"]'), {
    onChange: (i) => onChange('theme', i === 0 ? 'light' : 'dark'),
  });
  const accent = createAccentPicker(root.querySelector('.acc'), {
    value: state.accent,
    onChange: (v) => onChange('accent', v),
  });

  const toggles = {};
  root.querySelectorAll('[data-toggle]').forEach((el) => {
    const key = el.dataset.toggle;
    toggles[key] = createToggle(el, {
      checked: key === 'reduced' ? MotionSettings.reduced : key !== 'n-calendar',
      onChange: (on) => { if (key === 'reduced') onChange('reduced', on); },
    });
  });

  createSlider(root.querySelector('[data-slider="magnify"]'), {
    min: 1,
    max: 2,
    step: 0.05,
    value: dock.magnify,
    format: (v) => `${v.toFixed(2)}×`,
    onInput: (v) => dock.setMagnify(v),
  });

  createField(root.querySelector('[data-field="budget"]'), {
    validate(text) {
      const value = Number(String(text).replace(/[,\s]/g, ''));
      if (!String(text).trim()) return '請輸入每月預算';
      if (!Number.isFinite(value) || value <= 0) return '請輸入大於 0 的數字';
      if (value > 10000000) return '金額太大了，確認一下有沒有多打 0';
      return '';
    },
    onCommit: (text) => onChange('budget', Number(String(text).replace(/[,\s]/g, ''))),
  });

  const frame = win.querySelector('.wm-window__frame');
  sideGlass = createGlass(win, {
    variable: '--lens-side',
    observe: win,
    band: 7,
    strength: 6,
    measure: () => {
      if (narrow) return null;
      const radius = 0.9 * rem();
      return { w: nav.offsetWidth, h: frame.offsetHeight, r: [radius, 0, 0, radius] };
    },
  });

  function fxLabel() {
    selects.fx.setLabel('auto', `自動 · ${FX_NAMES[Fx.auto]}`);
  }

  Fx.subscribe(fxLabel);
  fxLabel();
  requestAnimationFrame(() => platter.to(navButtons[0], true));

  return {
    sync(next) {
      selects.style.set(next.style);
      selects.motion.set(MotionSettings.presetName);
      selects.fx.set(Fx.choice);
      theme.select(next.theme === 'light' ? 0 : 1);
      accent.set(next.accent);
      toggles.reduced.set(MotionSettings.reduced);
      fxLabel();
      tabs.measure();
      theme.measure();
    },
    refreshGlass() {
      if (sideGlass) sideGlass.refresh();
      tabs.refreshGlass();
      theme.refreshGlass();
    },
    setAccentHint(text) {
      const hint = root.querySelector('#set-accent-hint');
      if (hint) hint.textContent = text;
    },
    measure() {
      tabs.measure();
      theme.measure();
    },
  };
}
