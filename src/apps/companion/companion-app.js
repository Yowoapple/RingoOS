import { createMotion } from '../../motion/animator.js';
import { MotionSettings } from '../../motion/presets.js';
import { Data } from '../../core/data-model.js';
import { Fx } from '../../ui/fx-tier.js';
import { createOdometer, formatAmount } from '../../ui/odometer.js';
import { Persona } from '../reminder/persona.js';
import { DEX, dexProgress } from './dex.js';
import { ACHIEVEMENTS, loggedDays, runsOf, streaks } from './achievements.js';
import { TITLES, TREAT_CAP, levelOf, stateOf } from './pet-model.js';
import { stateLine } from './pet-lines.js';
import { festivalLine } from './festivals.js';

const BASE = '/characters/coffeebean/';
const PAGES = [
  { id: 'she', label: '她' },
  { id: 'dex', label: '圖鑑' },
  { id: 'cal', label: '月曆' },
  { id: 'ach', label: '成就' },
];
const NAV_ICONS = {
  she: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.8 14c.6-2.8 2.7-4.3 5.2-4.3s4.6 1.5 5.2 4.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  dex: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.2" y="2.2" width="4.8" height="4.8" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="2.2" width="4.8" height="4.8" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="2.2" y="9" width="4.8" height="4.8" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="9" width="4.8" height="4.8" rx="1.4" fill="currentColor"/></svg>',
  cal: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.2" y="3" width="11.6" height="10.8" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.4 6.6h11.2M5.4 1.8v2.4M10.6 1.8v2.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="10.2" r="1.3" fill="currentColor"/></svg>',
  ach: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="6.4" r="4.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.6 9.9 4.6 14.4 8 12.8l3.4 1.6-1-4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
};
const BADGES = {
  pen: 'M8 16.5 15.6 8.9a1.6 1.6 0 0 1 2.3 0l.2.2a1.6 1.6 0 0 1 0 2.3L10.5 19H8z',
  calendar: 'M7 9.5h12M8.5 7v-1.5M17.5 7v-1.5M7.5 8h11a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z',
  flame: 'M13 6c.6 2.8 4.2 4.6 4.2 8.4A4.2 4.2 0 0 1 13 18.6a4.2 4.2 0 0 1-4.2-4.2c0-1.8.9-3 1.8-3.8.2 1.4.9 2.2 1.8 2.6C12 11 11.6 8.4 13 6z',
  note: 'M8.5 7.5h9M8.5 11h9M8.5 14.5h5.5M7.5 5.5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1z',
  moon: 'M16.8 15.2a5.4 5.4 0 0 1-6.9-6.9 5.6 5.6 0 1 0 6.9 6.9z',
  coin: 'M13 6.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM13 9.5v7M11 11.2c0-.9.9-1.4 2-1.4s2 .5 2 1.3-.9 1.2-2 1.4-2 .6-2 1.4.9 1.4 2 1.4 2-.5 2-1.4',
  shield: 'M13 5.8l5.6 2v4.3c0 3.4-2.4 5.8-5.6 7.1-3.2-1.3-5.6-3.7-5.6-7.1V7.8zM10.4 12.6l1.8 1.8 3.4-3.4',
  repeat: 'M8 11.5a4.5 4.5 0 0 1 7.6-3.2L17 9.7M17 6.5v3.2h-3.2M18 14.5a4.5 4.5 0 0 1-7.6 3.2L9 16.3M9 19.5v-3.2h3.2',
  search: 'M12 7a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM15.3 15.3l3.2 3.2',
  heart: 'M13 18.6s-5.6-3.3-5.6-7.3A3.1 3.1 0 0 1 13 9.5a3.1 3.1 0 0 1 5.6 1.8c0 4-5.6 7.3-5.6 7.3z',
  hand: 'M10 13V7.8a1.2 1.2 0 0 1 2.4 0V12m0-5.2a1.2 1.2 0 0 1 2.4 0V12m0-4.2a1.2 1.2 0 0 1 2.4 0V14c0 3-2 5-4.8 5h-.6c-1.5 0-2.7-.7-3.6-1.9L7 14.8a1.2 1.2 0 0 1 1.8-1.5L10 14.6',
  cake: 'M7.5 13.5h11v5h-11zM7.5 15.5c1.8 0 1.8-1.2 3.6-1.2s1.8 1.2 3.7 1.2 1.8-1.2 3.7-1.2M13 13.5v-3M13 8.2c.6.5.9 1 .9 1.4a.9.9 0 0 1-1.8 0c0-.4.3-.9.9-1.4z',
  book: 'M13 8.5c-1.6-1.3-3.4-1.8-5.5-1.8v10.6c2.1 0 3.9.5 5.5 1.8 1.6-1.3 3.4-1.8 5.5-1.8V6.7c-2.1 0-3.9.5-5.5 1.8zM13 8.5v10.6',
  gift: 'M7.5 11h11v2.4h-11zM8.5 13.4h9v5.6h-9zM13 11v8M13 11c-1.8 0-3.6-.6-3.6-2s1.6-1.8 2.6-.8c.6.6 1 1.6 1 2.8.1-1.2.4-2.2 1-2.8 1-1 2.6-.6 2.6.8s-1.8 2-3.6 2',
};
const WEEK = ['一', '二', '三', '四', '五', '六', '日'];
const WEEK_FULL = ['日', '一', '二', '三', '四', '五', '六'];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function rem() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 20.8;
}

function soft(config) {
  return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
}

function blur(t, px) {
  return t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * px).toFixed(2)}px)` : '';
}

function voice() {
  return Persona.isEnabled() ? Persona.getType() : 'neutral';
}

function keyOf(date) {
  return Data.toDateKey(date);
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function daysBetween(a, b) {
  return Math.round((parseKey(b) - parseKey(a)) / 86400000);
}

function badgeSvg(kind) {
  return `<svg class="pal-badge" viewBox="0 0 26 26" aria-hidden="true"><circle class="pal-badge__rim" cx="13" cy="13" r="12.2"/><circle class="pal-badge__disc" cx="13" cy="13" r="10.4"/><path class="pal-badge__glyph" d="${BADGES[kind] || BADGES.pen}"/></svg>`;
}

const RING = '<svg viewBox="0 0 44 44" aria-hidden="true"><circle class="pal-ring__track" cx="22" cy="22" r="19"/><circle class="pal-ring__fill" cx="22" cy="22" r="19" pathLength="1" transform="rotate(-90 22 22)"/></svg>';

export function createCompanionApp({ root, companion, dialogs }) {
  const win = () => root.closest('.wm-window');
  const rises = new WeakMap();
  let current = 'she';
  let narrow = false;
  let wide = false;
  let opened = false;

  root.classList.add('pal');
  root.innerHTML = `
    <aside class="pal__rail">
      <nav class="pal__nav" aria-label="夥伴"><span class="pal__platter" aria-hidden="true"></span></nav>
      <div class="pal__mini" aria-hidden="true"><img class="pal__mini-img" alt=""><span class="pal__mini-name"></span></div>
    </aside>
    <div class="pal__main"><div class="pal__scroll"></div></div>`;
  const nav = root.querySelector('.pal__nav');
  const platterEl = root.querySelector('.pal__platter');
  const scroll = root.querySelector('.pal__scroll');
  const miniImg = root.querySelector('.pal__mini-img');
  const miniName = root.querySelector('.pal__mini-name');

  const navButtons = new Map();
  PAGES.forEach((page) => {
    const button = el('button', 'pal__navbtn', `${NAV_ICONS[page.id]}<span class="pal__navlabel"></span><b class="pal__navbadge mono" hidden></b>`);
    button.type = 'button';
    button.dataset.page = page.id;
    button.querySelector('.pal__navlabel').textContent = page.label;
    button.addEventListener('click', () => go(page.id));
    navButtons.set(page.id, button);
    nav.append(button);
  });

  function rise(node, delay = 0, distance = 14) {
    let entry = rises.get(node);
    if (!entry) {
      const motion = createMotion({ e: 1, y: 0 }, { response: 0.42, damping: 0.7, restDelta: { e: 0.002, y: 0.05 } });
      motion.onUpdate(({ e, y }) => {
        const t = clamp(e, 0, 1);
        const still = t > 0.999 && Math.abs(y) < 0.05;
        node.style.opacity = still ? '' : String(t);
        node.style.transform = still ? '' : `translate3d(0, ${y.toFixed(2)}px, 0)`;
        node.style.filter = blur(t, 5);
      });
      entry = { motion, timer: 0 };
      rises.set(node, entry);
    }
    window.clearTimeout(entry.timer);
    if (MotionSettings.reduced) {
      entry.motion.set({ e: 1, y: 0 });
      return;
    }
    entry.motion.set({ e: 0, y: distance });
    entry.timer = window.setTimeout(() => {
      entry.motion.to({ e: 1 }, { response: 0.3, damping: 1 });
      entry.motion.to({ y: 0 }, { response: 0.48, damping: 0.62 });
    }, delay);
  }

  function pop(node, from = 0.9, velocity = 2.4) {
    if (!node || MotionSettings.reduced) return;
    const motion = createMotion({ s: from }, { response: 0.38, damping: 0.42, restDelta: 0.0005 });
    motion.onUpdate(({ s }) => {
      node.style.transform = Math.abs(s - 1) < 0.0005 ? '' : `scale(${s.toFixed(4)})`;
    });
    motion.to({ s: 1 }, { response: 0.38, damping: 0.42, velocity: { s: velocity } });
  }

  function shake(node) {
    if (MotionSettings.reduced) return;
    const motion = createMotion({ x: 0 }, { response: 0.3, damping: 0.3, restDelta: 0.05 });
    motion.onUpdate(({ x }) => {
      node.style.transform = Math.abs(x) < 0.05 ? '' : `translate3d(${x.toFixed(2)}px, 0, 0)`;
    });
    motion.to({ x: 0 }, { velocity: { x: 520 } });
  }

  const platter = createMotion({ x: 0, y: 0, w: 0, h: 0, o: 0 }, { response: 0.3, damping: 0.8, restDelta: { x: 0.05, y: 0.05, w: 0.05, h: 0.05, o: 0.002 } });
  platter.onUpdate(({ x, y, w, h, o }) => {
    platterEl.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    platterEl.style.width = `${Math.max(0, w).toFixed(2)}px`;
    platterEl.style.height = `${Math.max(0, h).toFixed(2)}px`;
    platterEl.style.opacity = String(clamp(o, 0, 1));
  });
  const LEAD = { response: 0.26, damping: 0.6 };
  const TRAIL = { response: 0.46, damping: 0.72 };
  let edges = { a: 0, b: 0 };
  const edgeMotion = createMotion({ a: 0, b: 0 }, { response: 0.3, damping: 0.7, restDelta: 0.05 });
  edgeMotion.onUpdate(({ a, b }) => {
    const lo = Math.min(a, b);
    const span = Math.abs(b - a);
    if (narrow) platter.set({ x: lo, w: span });
    else platter.set({ y: lo, h: span });
  });

  function placePlatter(immediate) {
    const button = navButtons.get(current);
    if (!button || !button.offsetWidth) return;
    const a = narrow ? button.offsetLeft : button.offsetTop;
    const b = a + (narrow ? button.offsetWidth : button.offsetHeight);
    if (narrow) platter.set({ y: button.offsetTop, h: button.offsetHeight });
    else platter.set({ x: button.offsetLeft, w: button.offsetWidth });
    if (immediate || platter.get('o') < 0.05) {
      edgeMotion.set({ a, b });
      platter.to({ o: 1 }, { response: 0.2, damping: 1 });
      edges = { a, b };
      return;
    }
    const forward = a >= edges.a;
    edgeMotion.to({ b }, soft(forward ? LEAD : TRAIL));
    edgeMotion.to({ a }, soft(forward ? TRAIL : LEAD));
    edges = { a, b };
  }

  const sections = new Map();
  PAGES.forEach((page) => {
    const section = el('section', `pal-page pal-page--${page.id}`);
    section.dataset.page = page.id;
    section.setAttribute('aria-label', page.label);
    section.hidden = true;
    scroll.append(section);
    sections.set(page.id, section);
  });

  const she = buildShe(sections.get('she'));
  const dex = buildDex(sections.get('dex'));
  const cal = buildCal(sections.get('cal'));
  const ach = buildAch(sections.get('ach'));
  const views = { she, dex, cal, ach };

  function enter(id) {
    const items = Array.from(sections.get(id).querySelectorAll(':scope > *'));
    items.forEach((node, i) => rise(node, Math.min(i, 6) * 45, 16 + Math.min(i, 5) * 6));
  }

  function go(id, { instant = false } = {}) {
    if (!sections.has(id)) return;
    const changed = id !== current || !opened;
    const leaving = current;
    current = id;
    navButtons.forEach((button, key) => {
      if (key === id) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    placePlatter(instant);
    sections.forEach((section, key) => { section.hidden = key !== id; });
    scroll.scrollTop = 0;
    const w = win();
    if (w) w.classList.remove('is-scrolled');
    views[id].show();
    if (changed && !instant && leaving !== id) enter(id);
  }

  scroll.addEventListener('scroll', () => {
    const w = win();
    if (w) w.classList.toggle('is-scrolled', scroll.scrollTop > 1);
  }, { passive: true });

  nav.addEventListener('keydown', (event) => {
    const keys = narrow ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const list = PAGES.map((p) => p.id);
    const index = list.indexOf(current);
    const next = list[clamp(index + (event.key === keys[1] ? 1 : -1), 0, list.length - 1)];
    go(next);
    navButtons.get(next).focus();
  });

  function buildShe(section) {
    section.innerHTML = `
      <div class="pal-hero">
        <button type="button" class="pal-hero__stage" aria-label="逗她一下"><span class="pal-hero__halo" aria-hidden="true"></span><img class="pal-hero__img" alt="" draggable="false"></button>
        <div class="pal-hero__id">
          <p class="pal-hero__fest" hidden></p>
          <h2 class="pal-hero__name"><button type="button" class="pal-name" aria-label="改名字"></button></h2>
          <div class="pal-level"><span class="pal-level__lv mono">Lv</span><span class="pal-level__num mono"></span><span class="pal-level__title"></span></div>
          <div class="pal-bar" aria-hidden="true"><i></i></div>
          <p class="pal-level__next"></p>
        </div>
      </div>
      <p class="pal-say"></p>
      <div class="pal-stats"></div>
      <div class="pal-facts"></div>`;
    const stage = section.querySelector('.pal-hero__stage');
    const img = section.querySelector('.pal-hero__img');
    const festEl = section.querySelector('.pal-hero__fest');
    const nameWrap = section.querySelector('.pal-hero__name');
    const nameBtn = section.querySelector('.pal-name');
    const lvNum = section.querySelector('.pal-level__num');
    const lvTitle = section.querySelector('.pal-level__title');
    const bar = section.querySelector('.pal-bar i');
    const nextEl = section.querySelector('.pal-level__next');
    const sayEl = section.querySelector('.pal-say');
    const statsEl = section.querySelector('.pal-stats');
    const factsEl = section.querySelector('.pal-facts');

    const rings = [['full', '飽足'], ['mood', '心情'], ['bond', '親密'], ['treats', '點心']].map(([key, label]) => {
      const node = el('div', `pal-ring pal-ring--${key}`, `<span class="pal-ring__dial">${RING}<b class="mono"></b></span><span class="pal-ring__label"></span>`);
      node.querySelector('.pal-ring__label').textContent = label;
      statsEl.append(node);
      const fill = node.querySelector('.pal-ring__fill');
      const motion = createMotion({ v: 0 }, { response: 0.7, damping: 0.72, restDelta: 0.001 });
      motion.onUpdate(({ v }) => { fill.style.strokeDashoffset = String(1 - clamp(v, 0, 1)); });
      const odo = createOdometer(node.querySelector('b'), { value: 0, format: (v) => String(Math.round(v)) });
      return { key, motion, odo };
    });

    const facts = [['days', '認識', '天'], ['best', '最長連續記帳', '天'], ['pats', '摸頭', '次'], ['feeds', '點心', '次']].map(([key, label, unit]) => {
      const node = el('div', 'pal-fact', '<span class="pal-fact__label"></span><span class="pal-fact__value"><b class="mono"></b><small></small></span>');
      node.querySelector('.pal-fact__label').textContent = label;
      node.querySelector('small').textContent = unit;
      factsEl.append(node);
      return { key, odo: createOdometer(node.querySelector('b'), { value: 0, format: (v) => formatAmount(Math.round(v)) }) };
    });

    const lvOdo = createOdometer(lvNum, { value: 1, format: (v) => String(Math.max(1, Math.round(v))) });
    const barMotion = createMotion({ p: 0 }, { response: 0.7, damping: 0.7, restDelta: 0.001 });
    barMotion.onUpdate(({ p }) => { bar.style.transform = `scaleX(${clamp(p, 0, 1.04).toFixed(4)})`; });

    let local = 0;
    let shown = '';
    function setSprite(file, { bounce = true } = {}) {
      if (!file || file === shown) return;
      shown = file;
      img.src = `${BASE}${file}`;
      miniImg.src = `${BASE}${file}`;
      if (bounce && current === 'she') pop(img, 0.94, 1.6);
    }
    companion.onSprite((file) => {
      if (local) return;
      setSprite(file);
    });
    stage.addEventListener('click', () => {
      const egg = companion.tease();
      pop(stage, 0.92, 2);
      if (companion.available) return;
      window.clearTimeout(local);
      setSprite(egg.file);
      local = window.setTimeout(() => {
        local = 0;
        setSprite(companion.sprite || 'trashtuber_idle.webp');
      }, egg.ms);
    });

    let editing = false;
    nameBtn.addEventListener('click', () => {
      if (editing) return;
      editing = true;
      const input = el('input', 'pal-name pal-name--edit');
      input.value = companion.name;
      input.maxLength = 12;
      input.setAttribute('aria-label', '她的名字');
      nameBtn.hidden = true;
      nameWrap.append(input);
      input.focus();
      input.select();
      const finish = (commit) => {
        if (!editing) return;
        editing = false;
        if (commit && input.value.trim()) companion.setName(input.value);
        input.remove();
        nameBtn.hidden = false;
        update();
        pop(nameBtn, 0.92, 1.8);
        nameBtn.focus({ preventScroll: true });
      };
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') finish(true);
        if (event.key === 'Escape') {
          event.stopPropagation();
          finish(false);
        }
      });
      input.addEventListener('blur', () => finish(true));
    });

    let lastLevel = 0;
    function update(animate = true) {
      const life = companion.life;
      const lv = levelOf(life.bond);
      if (!editing) nameBtn.textContent = life.name;
      miniName.textContent = life.name;
      lvOdo.set(lv.level);
      lvTitle.textContent = lv.title;
      nextEl.textContent = lv.next === null ? '已經是最親近的關係了' : `再 ${Math.ceil(lv.next - life.bond)} 點變成「${TITLES[lv.level]}」`;
      if (animate) barMotion.to({ p: lv.progress }, soft({ response: 0.7, damping: 0.7 }));
      else barMotion.set({ p: lv.progress });
      if (lastLevel && lv.level > lastLevel) pop(lvNum, 0.7, 4);
      lastLevel = lv.level;
      const fest = companion.festival();
      festEl.hidden = !fest;
      if (fest) festEl.textContent = fest.id === 'birthday' ? '今天是你的生日' : `今天是${fest.name}`;
      const line = fest ? festivalLine(fest.id, voice(), { name: life.name }) : stateLine(stateOf(life), voice(), { name: life.name, streak: life.streak.count, title: lv.title }, Math.floor(Date.now() / 600000));
      if (sayEl.textContent !== line) sayEl.textContent = line;
      const values = { full: [life.fullness / 100, life.fullness], mood: [life.mood / 100, life.mood], bond: [lv.progress, lv.level], treats: [life.treats / TREAT_CAP, life.treats] };
      rings.forEach(({ key, motion, odo }) => {
        const [ratio, number] = values[key];
        if (animate) motion.to({ v: ratio }, soft({ response: 0.7, damping: 0.72 }));
        else motion.set({ v: ratio });
        odo.set(number);
      });
      const stats = companion.stats();
      const today = keyOf(new Date());
      const numbers = { days: daysBetween(life.firstSeen, today) + 1, best: stats.streakBest, pats: life.totals.pats, feeds: life.totals.feeds };
      facts.forEach(({ key, odo }) => odo.set(numbers[key]));
    }

    return {
      show() {
        setSprite(companion.sprite || 'trashtuber_idle.webp', { bounce: false });
        update(false);
      },
      intro() {
        rings.forEach(({ motion }) => motion.set({ v: 0 }));
        barMotion.set({ p: 0 });
        facts.forEach(({ odo }) => odo.set(0, { from: 0 }));
        rings.forEach(({ odo }) => odo.set(0, { from: 0 }));
        update(true);
      },
      update,
    };
  }

  function buildDex(section) {
    section.innerHTML = `
      <header class="pal-head">
        <h2 class="pal-head__title">圖鑑</h2>
        <p class="pal-head__count"><b class="mono"></b><span class="mono"> / ${DEX.length}</span></p>
        <div class="pal-bar pal-head__bar" aria-hidden="true"><i></i></div>
        <p class="pal-head__lede">她做過的動作都會收進來。還沒看過的只看得到影子</p>
      </header>
      <div class="pal-dex" role="list"></div>`;
    const grid = section.querySelector('.pal-dex');
    const countOdo = createOdometer(section.querySelector('.pal-head__count b'), { value: 0, format: (v) => String(Math.round(v)) });
    const bar = section.querySelector('.pal-head__bar i');
    const barMotion = createMotion({ p: 0 }, { response: 0.7, damping: 0.7, restDelta: 0.001 });
    barMotion.onUpdate(({ p }) => { bar.style.transform = `scaleX(${clamp(p, 0, 1.04).toFixed(4)})`; });
    const images = new Map();
    const cards = new Map();
    let seenSig = '';
    let freshShown = new Set();

    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((list) => {
      list.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        paintThumb(entry.target.dataset.file);
      });
    }, { root: scroll, rootMargin: '120px' }) : null;

    function firstFrame(file) {
      return new Promise((resolve) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => resolve({ source: image, w: image.naturalWidth, h: image.naturalHeight, close() {} });
        image.onerror = () => resolve(null);
        image.src = `${BASE}${file}`;
      });
    }

    async function middleFrame(file) {
      const response = await fetch(`${BASE}${file}`);
      const decoder = new window.ImageDecoder({ data: response.body, type: 'image/webp' });
      await decoder.tracks.ready;
      await decoder.completed;
      const total = decoder.tracks.selectedTrack ? decoder.tracks.selectedTrack.frameCount : 1;
      const { image } = await decoder.decode({ frameIndex: Math.floor(Math.max(0, total - 1) * 0.45) });
      decoder.close();
      return { source: image, w: image.displayWidth, h: image.displayHeight, close: () => image.close() };
    }

    function flatten(frame) {
      if (!frame) return null;
      const scale = Math.min(1, 320 / Math.max(frame.w, frame.h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(frame.w * scale));
      canvas.height = Math.max(1, Math.round(frame.h * scale));
      canvas.getContext('2d').drawImage(frame.source, 0, 0, canvas.width, canvas.height);
      frame.close();
      return { source: canvas, w: canvas.width, h: canvas.height };
    }

    function load(file) {
      if (images.has(file)) return images.get(file);
      const promise = (typeof window.ImageDecoder === 'function' ? middleFrame(file).catch(() => firstFrame(file)) : firstFrame(file)).then(flatten);
      images.set(file, promise);
      return promise;
    }

    function paintThumb(file) {
      const card = cards.get(file);
      if (!card) return;
      load(file).then((frame) => {
        if (!frame) return;
        const canvas = card.querySelector('canvas');
        const size = Math.max(32, Math.round(canvas.clientWidth * (window.devicePixelRatio || 1))) || 160;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        const scale = Math.min(size / frame.w, size / frame.h);
        const w = frame.w * scale;
        const h = frame.h * scale;
        ctx.drawImage(frame.source, (size - w) / 2, (size - h) / 2, w, h);
        if (!card.classList.contains('is-seen')) {
          ctx.globalCompositeOperation = 'source-in';
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, size, size);
          ctx.globalCompositeOperation = 'source-over';
        }
        card.classList.add('is-painted');
      });
    }

    DEX.forEach((item, index) => {
      const card = el('button', 'pal-card', `<span class="pal-card__thumb"><canvas aria-hidden="true"></canvas><img alt="" draggable="false" hidden></span><span class="pal-card__no mono">${String(index + 1).padStart(2, '0')}</span><span class="pal-card__name"></span><span class="pal-card__hint"></span><span class="pal-card__new mono" hidden>NEW</span>`);
      card.type = 'button';
      card.dataset.file = item.file;
      card.setAttribute('role', 'listitem');
      cards.set(item.file, card);
      grid.append(card);
      const live = card.querySelector('img');
      const startLive = () => {
        if (!card.classList.contains('is-seen')) return;
        live.src = `${BASE}${item.file}`;
        live.hidden = false;
      };
      const stopLive = () => {
        live.hidden = true;
        live.removeAttribute('src');
      };
      card.addEventListener('pointerenter', startLive);
      card.addEventListener('pointerleave', stopLive);
      card.addEventListener('focus', startLive);
      card.addEventListener('blur', stopLive);
      card.addEventListener('click', () => {
        if (!card.classList.contains('is-seen')) {
          shake(card);
          return;
        }
        const big = el('div', 'pal-dex-big', `<img alt="" draggable="false" src="${BASE}${item.file}">`);
        dialogs.present({
          source: card,
          frame: win(),
          title: item.name,
          text: item.hint,
          content: big,
          width: 17,
          actions: [{ label: '好', className: 'btn--primary', focus: true }],
        });
      });
    });

    function render(entering) {
      const life = companion.life;
      const seen = new Set(life.seen);
      const sig = DEX.map((item) => (seen.has(item.file) ? 1 : 0)).join('');
      if (entering) freshShown = new Set(life.fresh.filter((t) => t.startsWith('dex:')).map((t) => t.slice(4)));
      DEX.forEach((item) => {
        const card = cards.get(item.file);
        const on = seen.has(item.file);
        const was = card.classList.contains('is-seen');
        card.classList.toggle('is-seen', on);
        card.querySelector('.pal-card__name').textContent = on ? item.name : '？？？';
        card.querySelector('.pal-card__hint').textContent = item.hint;
        card.setAttribute('aria-label', on ? `${item.name}，${item.hint}` : `還沒看過，${item.hint}`);
        const isNew = on && freshShown.has(item.file);
        card.classList.toggle('is-new', isNew);
        card.querySelector('.pal-card__new').hidden = !isNew;
        if (on !== was && seenSig) {
          card.classList.remove('is-painted');
          paintThumb(item.file);
          if (on) pop(card, 0.86, 3);
        }
      });
      const progress = dexProgress(life.seen);
      countOdo.set(progress.found);
      barMotion.to({ p: progress.found / progress.total }, soft({ response: 0.7, damping: 0.7 }));
      if (sig !== seenSig) {
        seenSig = sig;
        cards.forEach((card, file) => {
          if (card.classList.contains('is-painted')) return;
          if (io) io.observe(card);
          else paintThumb(file);
        });
      }
    }

    return {
      show() {
        render(true);
        window.setTimeout(() => { if (current === 'dex') companion.clearFresh('dex:'); }, 1600);
      },
      update() {
        if (current === 'dex') render(false);
      },
    };
  }

  function buildCal(section) {
    section.innerHTML = `
      <header class="pal-streak">
        <p class="pal-streak__now"><b class="mono"></b><em class="pal-streak__unit">天</em></p>
        <p class="pal-streak__label"></p>
        <p class="pal-streak__more"><span>最長 <b class="mono" data-c="best"></b> 天</span><span>總共 <b class="mono" data-c="total"></b> 天</span></p>
      </header>
      <div class="pal-cal">
        <div class="pal-cal__month">
          <div class="pal-cal__nav">
            <button type="button" class="period-nav__btn" data-c="prev" aria-label="上個月"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg></button>
            <span class="pal-cal__title mono" data-c="title"></span>
            <button type="button" class="period-nav__btn" data-c="next" aria-label="下個月"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg></button>
            <button type="button" class="date-today" data-c="today" hidden>本月</button>
          </div>
          <div class="pal-cal__week" aria-hidden="true">${WEEK.map((d) => `<span>${d}</span>`).join('')}</div>
          <div class="pal-cal__grid" role="grid" aria-label="打卡月曆"></div>
          <p class="pal-cal__detail" aria-live="polite"></p>
        </div>
        <div class="pal-year">
          <p class="pal-year__title">這一年</p>
          <div class="pal-year__grid" aria-label="近一年的記帳熱度"></div>
          <p class="pal-year__legend"><span>少</span><i data-l="0"></i><i data-l="1"></i><i data-l="2"></i><i data-l="3"></i><span>多</span></p>
        </div>
      </div>`;
    const q = (name) => section.querySelector(`[data-c="${name}"]`);
    const grid = section.querySelector('.pal-cal__grid');
    const yearGrid = section.querySelector('.pal-year__grid');
    const detail = section.querySelector('.pal-cal__detail');
    const titleEl = q('title');
    const todayBtn = q('today');
    const labelEl = section.querySelector('.pal-streak__label');
    const nowOdo = createOdometer(section.querySelector('.pal-streak__now b'), { value: 0, format: (v) => String(Math.round(v)) });
    const bestOdo = createOdometer(q('best'), { value: 0, format: (v) => String(Math.round(v)) });
    const totalOdo = createOdometer(q('total'), { value: 0, format: (v) => String(Math.round(v)) });
    let month = keyOf(new Date()).slice(0, 7);
    let picked = null;
    let lastSig = '';

    const slide = createMotion({ x: 0, e: 1 }, { response: 0.42, damping: 0.74, restDelta: { x: 0.05, e: 0.002 } });
    slide.onUpdate(({ x, e }) => {
      const t = clamp(e, 0, 1);
      grid.style.transform = Math.abs(x) < 0.05 ? '' : `translate3d(${x.toFixed(2)}px, 0, 0)`;
      grid.style.opacity = t > 0.999 ? '' : String(t);
      grid.style.filter = blur(t, 4);
    });

    function counts() {
      const state = Data.getState();
      const map = new Map();
      loggedDays(state).forEach((key) => {
        const day = state.days[key];
        const expenses = day.expenses || [];
        map.set(key, { n: (day.income || []).length + expenses.length, spend: expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0) });
      });
      return map;
    }

    function monthKeys(monthKey) {
      const [y, m] = monthKey.split('-').map(Number);
      const first = new Date(y, m - 1, 1);
      const offset = (first.getDay() + 6) % 7;
      const start = new Date(y, m - 1, 1 - offset);
      return Array.from({ length: 42 }, (_, i) => keyOf(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
    }

    function describe(key, map) {
      const d = parseKey(key);
      const head = `${d.getMonth() + 1}/${d.getDate()} 週${WEEK_FULL[d.getDay()]}`;
      const info = map.get(key);
      if (!info) return `${head} · 沒有記帳`;
      const life = companion.life;
      const day = life.days[key];
      const goals = day && day.goals ? Object.keys(day.goals).length : 0;
      const spend = info.spend ? ` · 支出 −${formatAmount(info.spend)}` : '';
      return `${head} · 記了 ${info.n} 筆${spend}${goals ? ` · 完成 ${goals} 個小目標` : ''}`;
    }

    function renderMonth(map) {
      const today = keyOf(new Date());
      const keys = monthKeys(month);
      const runs = runsOf([...map.keys()]);
      grid.textContent = '';
      keys.forEach((key, i) => {
        const inMonth = key.startsWith(month);
        const info = map.get(key);
        const run = runs.get(key);
        const col = i % 7;
        const cell = el('button', 'pal-day', `<span class="mono">${Number(key.slice(8))}</span>`);
        cell.type = 'button';
        cell.dataset.key = key;
        cell.setAttribute('role', 'gridcell');
        if (!inMonth) cell.classList.add('is-out');
        if (info) {
          cell.classList.add('is-on');
          if (run.prev && col > 0) cell.classList.add('join-l');
          if (run.next && col < 6) cell.classList.add('join-r');
        }
        if (key === today) cell.classList.add('is-today');
        if (key > today) cell.classList.add('is-future');
        if (key === picked) cell.classList.add('is-picked');
        cell.setAttribute('aria-label', describe(key, map));
        grid.append(cell);
      });
      const [y, m] = month.split('-');
      titleEl.textContent = `${y}.${m}`;
      todayBtn.hidden = month === today.slice(0, 7);
      q('next').disabled = month >= today.slice(0, 7);
      detail.textContent = picked && picked.startsWith(month) ? describe(picked, map) : '點一天看那天記了什麼';
    }

    function renderYear(map) {
      const today = parseKey(keyOf(new Date()));
      const endOffset = (today.getDay() + 6) % 7;
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (6 - endOffset));
      const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 52 * 7 - 6);
      yearGrid.textContent = '';
      const todayKey = keyOf(today);
      for (let i = 0; i < 53 * 7; i += 1) {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const key = keyOf(date);
        const info = map.get(key);
        const level = !info ? 0 : info.n >= 4 ? 3 : info.n >= 2 ? 2 : 1;
        const cell = el('i', 'pal-heat');
        cell.dataset.l = String(level);
        cell.dataset.key = key;
        if (key > todayKey) cell.classList.add('is-future');
        if (key.slice(0, 7) === month) cell.classList.add('is-month');
        cell.title = describe(key, map);
        yearGrid.append(cell);
      }
    }

    function render({ direction = 0 } = {}) {
      const map = counts();
      const run = streaks([...map.keys()], keyOf(new Date()));
      nowOdo.set(run.current);
      labelEl.textContent = run.current ? '連續記帳中' : '今天記一筆，就開始新的連續';
      bestOdo.set(run.best);
      totalOdo.set(map.size);
      if (direction && !MotionSettings.reduced) {
        slide.to({ e: 0, x: -direction * 14 }, { response: 0.14, damping: 1 }).then((done) => {
          if (!done) return;
          renderMonth(map);
          if (wide) renderYear(map);
          slide.set({ x: direction * 22, e: 0 });
          slide.to({ x: 0, e: 1 }, { response: 0.42, damping: 0.72 });
        });
        return;
      }
      renderMonth(map);
      if (wide) renderYear(map);
    }

    function shiftMonth(delta) {
      const [y, m] = month.split('-').map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (next > keyOf(new Date()).slice(0, 7)) return;
      month = next;
      render({ direction: delta });
    }

    q('prev').addEventListener('click', () => shiftMonth(-1));
    q('next').addEventListener('click', () => shiftMonth(1));
    todayBtn.addEventListener('click', () => {
      const target = keyOf(new Date()).slice(0, 7);
      const direction = target > month ? 1 : -1;
      month = target;
      render({ direction });
    });
    grid.addEventListener('click', (event) => {
      const cell = event.target.closest('.pal-day');
      if (!cell || cell.classList.contains('is-future')) return;
      const key = cell.dataset.key;
      if (!key.startsWith(month)) {
        month = key.slice(0, 7);
        picked = key;
        render({ direction: key < month ? -1 : 1 });
        return;
      }
      picked = key;
      grid.querySelectorAll('.is-picked').forEach((c) => c.classList.remove('is-picked'));
      cell.classList.add('is-picked');
      detail.textContent = describe(key, counts());
      pop(cell, 0.86, 3);
      rise(detail, 0, 6);
    });
    yearGrid.addEventListener('click', (event) => {
      const cell = event.target.closest('.pal-heat');
      if (!cell || cell.classList.contains('is-future')) return;
      const key = cell.dataset.key;
      const target = key.slice(0, 7);
      picked = key;
      const direction = target > month ? 1 : target < month ? -1 : 0;
      month = target;
      render({ direction });
    });

    function signature() {
      const map = counts();
      return `${keyOf(new Date())}|${[...map.entries()].map(([k, v]) => `${k}:${v.n}`).join(',')}`;
    }

    return {
      show() {
        lastSig = signature();
        render();
      },
      update() {
        if (current !== 'cal') return;
        const sig = signature();
        if (sig === lastSig) return;
        lastSig = sig;
        render();
      },
      relayout() {
        if (current === 'cal') render();
      },
    };
  }

  function buildAch(section) {
    section.innerHTML = `
      <header class="pal-head">
        <h2 class="pal-head__title">成就</h2>
        <p class="pal-head__count"><b class="mono"></b><span class="mono"> / ${ACHIEVEMENTS.length}</span></p>
        <div class="pal-bar pal-head__bar" aria-hidden="true"><i></i></div>
        <p class="pal-head__lede">每解鎖一個，她會多一份點心</p>
      </header>
      <div class="pal-ach" role="list"></div>`;
    const grid = section.querySelector('.pal-ach');
    const countOdo = createOdometer(section.querySelector('.pal-head__count b'), { value: 0, format: (v) => String(Math.round(v)) });
    const bar = section.querySelector('.pal-head__bar i');
    const barMotion = createMotion({ p: 0 }, { response: 0.7, damping: 0.7, restDelta: 0.001 });
    barMotion.onUpdate(({ p }) => { bar.style.transform = `scaleX(${clamp(p, 0, 1.04).toFixed(4)})`; });
    const items = new Map();
    let freshShown = new Set();

    ACHIEVEMENTS.forEach((a) => {
      const node = el('div', 'pal-medal', `${badgeSvg(a.badge)}<div class="pal-medal__text"><p class="pal-medal__title"></p><p class="pal-medal__desc"></p><div class="pal-medal__meta"><span class="pal-medal__track" aria-hidden="true"><i></i></span><span class="pal-medal__num mono"></span></div></div><span class="pal-card__new mono" hidden>NEW</span>`);
      node.setAttribute('role', 'listitem');
      node.querySelector('.pal-medal__title').textContent = a.title;
      node.querySelector('.pal-medal__desc').textContent = a.desc;
      grid.append(node);
      items.set(a.id, node);
    });

    function render(entering) {
      const life = companion.life;
      const stats = companion.stats();
      if (entering) freshShown = new Set(life.fresh.filter((t) => t.startsWith('ach:')).map((t) => t.slice(4)));
      let done = 0;
      ACHIEVEMENTS.forEach((a) => {
        const node = items.get(a.id);
        const at = life.unlocked[a.id];
        const was = node.classList.contains('is-done');
        node.classList.toggle('is-done', !!at);
        if (at) done += 1;
        const [cur, goal] = a.progress(stats);
        const num = node.querySelector('.pal-medal__num');
        const track = node.querySelector('.pal-medal__track');
        if (at) {
          const d = new Date(at);
          num.textContent = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
          track.hidden = true;
        } else {
          num.textContent = goal > 1 ? `${formatAmount(cur)} / ${formatAmount(goal)}` : '還沒達成';
          track.hidden = goal <= 1;
          track.querySelector('i').style.transform = `scaleX(${clamp(cur / goal, 0, 1).toFixed(4)})`;
        }
        node.setAttribute('aria-label', `${a.title}，${a.desc}，${at ? '已解鎖' : num.textContent}`);
        const isNew = !!at && freshShown.has(a.id);
        node.classList.toggle('is-new', isNew);
        node.querySelector('.pal-card__new').hidden = !isNew;
        if (at && !was && !entering) pop(node, 0.86, 3);
      });
      countOdo.set(done);
      barMotion.to({ p: done / ACHIEVEMENTS.length }, soft({ response: 0.7, damping: 0.7 }));
    }

    return {
      show() {
        render(true);
        window.setTimeout(() => { if (current === 'ach') companion.clearFresh('ach:'); }, 1600);
      },
      update() {
        if (current === 'ach') render(false);
      },
    };
  }

  function syncBadges() {
    const fresh = companion.life.fresh;
    const counts = { dex: fresh.filter((t) => t.startsWith('dex:')).length, ach: fresh.filter((t) => t.startsWith('ach:')).length };
    ['dex', 'ach'].forEach((id) => {
      const badge = navButtons.get(id).querySelector('.pal__navbadge');
      const n = counts[id];
      const was = badge.hidden ? 0 : Number(badge.textContent) || 0;
      badge.hidden = !n;
      badge.textContent = String(n);
      if (n > was) pop(badge, 0.5, 6);
    });
  }

  companion.onChange(() => {
    syncBadges();
    if (current === 'she') she.update();
    dex.update();
    ach.update();
    cal.update();
  });
  Data.subscribe(() => {
    cal.update();
  });

  function measure() {
    const width = root.clientWidth;
    if (!width) return;
    const unit = rem();
    const nextNarrow = width < 34 * unit;
    const nextWide = width >= 50 * unit;
    const changed = nextNarrow !== narrow || nextWide !== wide;
    narrow = nextNarrow;
    wide = nextWide;
    root.classList.toggle('is-narrow', narrow);
    root.classList.toggle('is-wide', wide);
    const w = win();
    if (w) w.classList.toggle('is-pal-narrow', narrow);
    if (changed) {
      platter.set({ o: 0 });
      cal.relayout();
    }
    placePlatter(true);
  }

  new ResizeObserver(measure).observe(root);
  syncBadges();
  go('she', { instant: true });

  return {
    measure,
    show(id) {
      go(id || current);
    },
    intro() {
      measure();
      window.setTimeout(measure, 80);
      opened = true;
      if (current === 'she') she.intro();
      else views[current].show();
      enter(current);
    },
  };
}
