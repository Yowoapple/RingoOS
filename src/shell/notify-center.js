import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';
import { Fx } from '../ui/fx-tier.js';

const MOON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.6 5.6 0 1 0 7.3 7.3z" fill="currentColor"/></svg>';
const CROSS = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const MAX_STAGGER = 8;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function soft(config) {
  return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
}

function toPx(value, el) {
  const text = String(value || '').trim();
  const n = parseFloat(text);
  if (!Number.isFinite(n)) return 0;
  if (text.endsWith('rem')) return n * parseFloat(getComputedStyle(document.documentElement).fontSize);
  if (text.endsWith('em')) return n * parseFloat(getComputedStyle(el).fontSize);
  return n;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function timeLabel(at, now = new Date()) {
  const date = new Date(at);
  const minutes = Math.floor((now.getTime() - at) / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;
  if (sameDay(date, now)) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function createNotifyCenter({ host, bell, notifier, renderIcon, appTitle }) {
  const panel = document.createElement('div');
  panel.className = 'nc';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '通知中心');
  panel.id = 'notify-center';
  panel.tabIndex = -1;
  panel.innerHTML = `
    <span class="nc__shadow" aria-hidden="true"></span>
    <span class="nc__glass" aria-hidden="true"></span>
    <span class="nc__fill" aria-hidden="true"></span>
    <div class="nc__body">
      <header class="nc__head">
        <h2 class="nc__title">通知</h2>
        <button type="button" class="nc__dnd" aria-pressed="false">${MOON}<span class="nc__dnd-text">勿擾</span></button>
      </header>
      <p class="nc__quiet" hidden></p>
      <div class="nc__scroll">
        <div class="nc__list"></div>
        <div class="nc__empty" hidden>
          <p class="nc__empty-title">沒有新通知</p>
          <p class="nc__empty-note">代辦提醒、天氣特報和預算變化會出現在這裡</p>
        </div>
      </div>
      <footer class="nc__foot">
        <span class="nc__count mono"></span>
        <button type="button" class="nc__clear">全部清除</button>
      </footer>
    </div>`;
  host.appendChild(panel);
  bell.setAttribute('aria-controls', panel.id);
  bell.setAttribute('aria-expanded', 'false');

  const shadow = panel.querySelector('.nc__shadow');
  const glass = panel.querySelector('.nc__glass');
  const fill = panel.querySelector('.nc__fill');
  const body = panel.querySelector('.nc__body');
  const list = panel.querySelector('.nc__list');
  const empty = panel.querySelector('.nc__empty');
  const scroll = panel.querySelector('.nc__scroll');
  const dnd = panel.querySelector('.nc__dnd');
  const quietNote = panel.querySelector('.nc__quiet');
  const countEl = panel.querySelector('.nc__count');
  const clearButton = panel.querySelector('.nc__clear');

  const shape = createMotion({ o: 0 }, { response: 0.42, damping: 0.66, restDelta: 0.0005 });
  const rows = new Map();
  let open = false;
  let fresh = new Set();
  let box = { w: 0, h: 0, bl: 0, bt: 0, bw: 0, bh: 0, r: 18, br: 10 };
  let timers = [];
  let clearing = false;

  function later(fn, ms) {
    if (MotionSettings.reduced) fn();
    else timers.push(window.setTimeout(fn, ms));
  }

  function place() {
    const rect = bell.getBoundingClientRect();
    const margin = 12;
    const width = panel.offsetWidth;
    const left = clamp(rect.right + 8 - width, margin, window.innerWidth - margin - width);
    const top = rect.bottom + 6;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    box = {
      w: width,
      h: panel.offsetHeight,
      bl: rect.left - left,
      bt: rect.top - top,
      bw: rect.width,
      bh: rect.height,
      r: toPx(getComputedStyle(panel).getPropertyValue('--nc-r'), panel) || 18,
      br: Math.min(rect.height / 2, parseFloat(getComputedStyle(bell).borderTopLeftRadius) || 10),
    };
    glass.style.clipPath = `inset(0 round ${box.r}px)`;
  }

  function paint({ o }) {
    const t = clamp(o, 0, 1);
    const k = 1 - t;
    const top = box.bt * k;
    const left = box.bl * k;
    const right = (box.w - box.bl - box.bw) * k;
    const bottom = (box.h - box.bt - box.bh) * k;
    const r = box.br + (box.r - box.br) * t;
    const clip = `inset(${top}px ${right}px ${bottom}px ${left}px round ${r}px)`;
    fill.style.clipPath = clip;
    body.style.clipPath = clip;
    shadow.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    shadow.style.width = `${Math.max(0, box.w - left - right)}px`;
    shadow.style.height = `${Math.max(0, box.h - top - bottom)}px`;
    shadow.style.borderRadius = `${r}px`;
    const over = Math.max(0, o - 1);
    panel.style.transformOrigin = `${box.bl + box.bw / 2}px ${box.bt + box.bh / 2}px`;
    panel.style.transform = over > 0.0005 ? `scale(${1 + over * 0.08})` : '';
    glass.style.opacity = open && o > 0.97 ? '1' : '0';
    panel.style.visibility = o > 0.002 || open ? 'visible' : 'hidden';
  }
  shape.onUpdate(paint);

  function rowMotion(el) {
    const motion = createMotion({ e: 0, x: 0, h: 1 }, { response: 0.3, damping: 0.78, restDelta: { e: 0.002, x: 0.002, h: 0.002 } });
    let natural = 0;
    motion.onUpdate(({ e, x, h }) => {
      const t = clamp(e, 0, 1);
      el.style.opacity = String(clamp(Math.min(t, 1 - Math.abs(x)), 0, 1));
      const y = (1 - t) * 8;
      el.style.transform = t > 0.999 && Math.abs(x) < 0.002 ? '' : `translate3d(${(x * el.offsetWidth * 0.6).toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${0.96 + 0.04 * t})`;
      el.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 5).toFixed(2)}px)` : '';
      if (h > 0.999) {
        el.style.height = '';
        el.style.marginBottom = '';
      } else {
        if (!natural) natural = el.scrollHeight;
        el.style.height = `${Math.max(0, h) * natural}px`;
        el.style.marginBottom = `${(Math.max(0, h) - 1) * 0.35}rem`;
      }
    });
    return {
      motion,
      measure() {
        natural = 0;
      },
    };
  }

  function buildRow(item) {
    const el = document.createElement('article');
    el.className = 'nc-item';
    el.dataset.id = item.id;
    el.innerHTML = `
      <button type="button" class="nc-item__main">
        <span class="nc-item__icon" aria-hidden="true">${renderIcon(item.app)}</span>
        <span class="nc-item__text">
          <span class="nc-item__top"><span class="nc-item__app"></span><span class="nc-item__time mono"></span></span>
          <span class="nc-item__title"></span>
          <span class="nc-item__body"></span>
        </span>
      </button>
      <span class="nc-item__dot" aria-hidden="true"></span>
      <button type="button" class="nc-item__x" aria-label="移除這則通知">${CROSS}</button>`;
    el.querySelector('.nc-item__app').textContent = appTitle(item.app);
    el.querySelector('.nc-item__title').textContent = item.title;
    const bodyEl = el.querySelector('.nc-item__body');
    bodyEl.textContent = item.body;
    bodyEl.hidden = !item.body;
    el.querySelector('.nc-item__main').addEventListener('click', () => {
      notifier.activate(item.id);
      hide({ focus: false });
    });
    el.querySelector('.nc-item__x').addEventListener('click', (event) => {
      event.stopPropagation();
      dismiss(item.id);
    });
    const entry = { el, item, ...rowMotion(el) };
    rows.set(item.id, entry);
    return entry;
  }

  function groupOf(item, now) {
    return sameDay(new Date(item.at), now) ? 'today' : 'earlier';
  }

  function header(group) {
    const el = document.createElement('h3');
    el.className = 'nc__group mono';
    el.dataset.group = group;
    el.textContent = group === 'today' ? '今天' : '稍早';
    return el;
  }

  function refreshMeta() {
    const now = new Date();
    rows.forEach(({ el, item }) => {
      el.querySelector('.nc-item__time').textContent = timeLabel(item.at, now);
      el.classList.toggle('is-unread', fresh.has(item.id));
    });
    const total = notifier.history.length;
    countEl.textContent = total ? `${total} 則` : '';
    clearButton.hidden = !total;
    empty.hidden = total > 0;
    const prefs = notifier.prefs;
    dnd.setAttribute('aria-pressed', String(!!prefs.dnd.on));
    dnd.classList.toggle('is-on', !!prefs.dnd.on);
    const scheduled = !prefs.dnd.on && notifier.quiet;
    quietNote.hidden = !(prefs.dnd.on || scheduled);
    quietNote.textContent = prefs.dnd.on ? '勿擾中：通知會安靜收進這裡，不跳出來' : `勿擾時段 ${prefs.dnd.from}–${prefs.dnd.to}：通知會安靜收進這裡`;
  }

  function layout({ animate = false } = {}) {
    const now = new Date();
    const history = notifier.history;
    const ids = new Set(history.map((item) => item.id));
    rows.forEach((entry, id) => {
      if (!ids.has(id) && !entry.leaving) {
        entry.el.remove();
        rows.delete(id);
      }
    });
    const nodes = [];
    let lastGroup = null;
    const added = [];
    history.forEach((item) => {
      const group = groupOf(item, now);
      if (group !== lastGroup) {
        nodes.push(list.querySelector(`.nc__group[data-group="${group}"]`) || header(group));
        lastGroup = group;
      }
      let entry = rows.get(item.id);
      if (!entry) {
        entry = buildRow(item);
        added.push(entry);
      }
      nodes.push(entry.el);
    });
    Array.from(list.querySelectorAll('.nc__group')).forEach((el) => {
      if (!nodes.includes(el)) el.remove();
    });
    nodes.forEach((node, i) => {
      if (list.children[i] !== node) list.insertBefore(node, list.children[i] || null);
    });
    added.forEach((entry, i) => {
      if (!animate || MotionSettings.reduced) {
        entry.motion.set({ e: 1, h: 1 });
        return;
      }
      entry.motion.set({ e: 0, h: 0 });
      entry.measure();
      entry.motion.to({ h: 1 }, soft({ response: 0.42, damping: 0.74 }));
      later(() => entry.motion.to({ e: 1 }, soft({ response: 0.36, damping: 0.74 })), 50 + Math.min(i, MAX_STAGGER) * 28);
    });
    refreshMeta();
  }

  function intro() {
    const entries = Array.from(list.querySelectorAll('.nc-item')).map((el) => rows.get(el.dataset.id)).filter(Boolean);
    const heads = Array.from(panel.querySelectorAll('.nc__head, .nc__quiet:not([hidden]), .nc__group, .nc__empty:not([hidden]), .nc__foot'));
    if (MotionSettings.reduced) {
      entries.forEach((entry) => entry.motion.set({ e: 1, h: 1, x: 0 }));
      return;
    }
    entries.forEach((entry, i) => {
      entry.motion.set({ e: 0, h: 1, x: 0 });
      later(() => entry.motion.to({ e: 1 }, { response: 0.32, damping: 0.76 }), 70 + Math.min(i, MAX_STAGGER) * 30);
    });
    heads.forEach((el, i) => {
      const motion = createMotion({ e: 0 }, { response: 0.32, damping: 0.78, restDelta: 0.002 });
      motion.onUpdate(({ e }) => {
        const t = clamp(e, 0, 1);
        el.style.opacity = t > 0.999 ? '' : String(t);
        el.style.transform = t > 0.999 ? '' : `translate3d(0, ${((1 - t) * 6).toFixed(2)}px, 0)`;
        el.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 4).toFixed(2)}px)` : '';
      });
      later(() => motion.to({ e: 1 }), 40 + i * 26);
    });
  }

  function dismiss(id) {
    const entry = rows.get(id);
    if (!entry || entry.leaving) return Promise.resolve();
    entry.leaving = true;
    const focusNext = entry.el.contains(document.activeElement);
    const finish = () => {
      entry.el.remove();
      rows.delete(id);
      notifier.remove(id);
      if (focusNext) {
        const next = list.querySelector('.nc-item .nc-item__main') || dnd;
        next.focus({ preventScroll: true });
      }
    };
    if (MotionSettings.reduced) {
      finish();
      return Promise.resolve();
    }
    entry.measure();
    return entry.motion.to({ x: 1 }, { response: 0.28, damping: 1 }).then(() => entry.motion.to({ h: 0 }, { response: 0.36, damping: 0.84 })).then(finish);
  }

  async function clearAll() {
    if (clearing) return;
    clearing = true;
    const entries = Array.from(rows.values());
    await Promise.all(entries.map((entry, i) => new Promise((resolve) => {
      entry.leaving = true;
      if (MotionSettings.reduced) {
        resolve();
        return;
      }
      window.setTimeout(() => entry.motion.to({ x: 1 }, { response: 0.26, damping: 1 }).then(resolve), Math.min(i, MAX_STAGGER) * 30);
    })));
    rows.forEach((entry) => entry.el.remove());
    rows.clear();
    list.textContent = '';
    clearing = false;
    notifier.clear();
    refreshMeta();
    if (!MotionSettings.reduced) {
      const motion = createMotion({ e: 0 }, { response: 0.4, damping: 0.72, restDelta: 0.002 });
      motion.onUpdate(({ e }) => {
        const t = clamp(e, 0, 1);
        empty.style.opacity = t > 0.999 ? '' : String(t);
        empty.style.transform = t > 0.999 ? '' : `translate3d(0, ${((1 - t) * 10).toFixed(2)}px, 0)`;
        empty.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 5).toFixed(2)}px)` : '';
      });
      motion.to({ e: 1 });
    }
    dnd.focus({ preventScroll: true });
  }

  function show({ keyboard = false } = {}) {
    if (open) return;
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
    open = true;
    fresh = new Set(notifier.history.filter((item) => !item.read).map((item) => item.id));
    panel.classList.add('is-open');
    bell.setAttribute('aria-expanded', 'true');
    layout();
    scroll.scrollTop = 0;
    place();
    shape.set({ o: shape.get('o') });
    shape.to({ o: 1 }, soft({ response: 0.42, damping: 0.66 }));
    intro();
    notifier.markAllRead();
    later(() => {
      const first = keyboard ? panel.querySelector('.nc-item__main') || dnd : panel;
      first.focus({ preventScroll: true });
    }, 80);
  }

  function hide({ focus = true } = {}) {
    if (!open) return;
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
    open = false;
    bell.setAttribute('aria-expanded', 'false');
    glass.style.opacity = '0';
    rows.forEach((entry) => {
      if (!entry.leaving) entry.motion.to({ e: 0 }, soft({ response: 0.14, damping: 1 }));
    });
    later(() => shape.to({ o: 0 }, soft({ response: 0.34, damping: 0.8 })).then(() => {
      if (!open) panel.classList.remove('is-open');
    }), 50);
    if (focus) bell.focus({ preventScroll: true });
  }

  function toggle(options) {
    if (open) hide();
    else show(options);
  }

  dnd.addEventListener('click', () => {
    notifier.setPrefs({ dnd: { on: !notifier.prefs.dnd.on } });
  });
  clearButton.addEventListener('click', clearAll);

  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      hide();
      return;
    }
    if (event.key === 'Tab') {
      const focusables = Array.from(panel.querySelectorAll('button:not([hidden])')).filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && document.activeElement.closest('.nc-item')) {
      event.preventDefault();
      dismiss(document.activeElement.closest('.nc-item').dataset.id);
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (!open) return;
    if (panel.contains(event.target) || bell.contains(event.target)) return;
    hide({ focus: false });
  }, true);

  window.addEventListener('resize', () => {
    if (open) {
      place();
      paint({ o: shape.get('o') });
    }
  });

  notifier.subscribe(({ type }) => {
    if (clearing) return;
    if (!open) return;
    if (type === 'add' || type === 'sync') {
      notifier.history.forEach((item) => {
        if (!rows.has(item.id) && !item.read) fresh.add(item.id);
      });
      layout({ animate: true });
      notifier.markAllRead();
      window.requestAnimationFrame(() => {
        if (!open) return;
        box.h = panel.offsetHeight;
        paint({ o: shape.get('o') });
      });
      return;
    }
    refreshMeta();
  });

  new ResizeObserver(() => {
    if (!open || shape.get('o') < 0.97) return;
    box.h = panel.offsetHeight;
    box.w = panel.offsetWidth;
    paint({ o: shape.get('o') });
  }).observe(panel);

  window.setInterval(() => {
    if (open) refreshMeta();
  }, 30000);

  paint({ o: 0 });

  return {
    show,
    hide,
    toggle,
    get open() { return open; },
  };
}
