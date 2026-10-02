import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';

const MOON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.6 5.6 0 1 0 7.3 7.3z" fill="currentColor"/></svg>';
const CROSS = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

const OPEN_W = { response: 0.36, damping: 0.56 };
const OPEN_H = { response: 0.5, damping: 0.54 };
const CLOSE_W = { response: 0.3, damping: 0.86 };
const CLOSE_H = { response: 0.38, damping: 0.8 };
function link(i) {
  return { response: 0.14 + Math.min(i, 9) * 0.024, damping: 0.58 };
}
const SETTLE = { response: 0.46, damping: 0.55 };
const GROW = { response: 0.42, damping: 0.6 };
const DROP = { response: 0.5, damping: 0.5 };

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
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
  const head = panel.querySelector('.nc__head');
  const list = panel.querySelector('.nc__list');
  const empty = panel.querySelector('.nc__empty');
  const scroll = panel.querySelector('.nc__scroll');
  const foot = panel.querySelector('.nc__foot');
  const dnd = panel.querySelector('.nc__dnd');
  const quietNote = panel.querySelector('.nc__quiet');
  const countEl = panel.querySelector('.nc__count');
  const clearButton = panel.querySelector('.nc__clear');

  const shape = createMotion({ w: 0, h: 0, H: 0 }, { response: 0.42, damping: 0.6, restDelta: { w: 0.0005, h: 0.0005, H: 0.2 } });
  const rows = new Map();
  const pieceOf = new WeakMap();
  let pieces = [];
  let open = false;
  let fresh = new Set();
  let box = { w: 0, h: 0, bl: 0, bt: 0, bw: 0, bh: 0, r: 18, br: 10 };
  let clearing = false;

  function piece(el) {
    let p = pieceOf.get(el);
    if (p) return p;
    p = {
      el,
      top: 0,
      width: 0,
      leaving: false,
      m: createMotion({ r: 0, dy: 0, s: 1 }, { response: 0.4, damping: 0.6, restDelta: { r: 0.0005, dy: 0.1, s: 0.0005 } }),
      mx: createMotion({ x: 0 }, { response: 0.4, damping: 0.6, restDelta: 0.0005 }),
    };
    const paint = () => paintPiece(p, p.m.get('r'), p.m.get('dy'), p.mx.get('x'), p.m.get('s'));
    p.m.onUpdate(() => {
      paint();
      queueDraw();
    });
    p.mx.onUpdate(paint);
    pieceOf.set(el, p);
    return p;
  }

  function paintPiece(p, r, dy, x, s) {
    const raw = r * p.top;
    const y = (raw > 0 ? 18 * Math.tanh(raw / 18) : raw) + dy;
    if (Math.abs(y) < 0.05 && Math.abs(x) < 0.0005 && Math.abs(s - 1) < 0.0005 && r > -0.0005) {
      p.el.style.transform = '';
      p.el.style.opacity = '';
      return;
    }
    const vy = p.m.velocity('r') * p.top + p.m.velocity('dy');
    const vx = p.mx.velocity('x') * (p.width || 300);
    const ky = MotionSettings.reduced ? 0 : clamp(Math.abs(vy) / 4200, 0, 0.1);
    const kx = MotionSettings.reduced ? 0 : clamp(Math.abs(vx) / 3200, 0, 0.18);
    const squeeze = r < 0 ? clamp(1 + r, 0.08, 1) : 1 + 0.07 * Math.tanh(r * 6);
    const sx = s * (1 + kx) * (1 - ky * 0.55) * (r < 0 ? 0.9 + 0.1 * squeeze : 1);
    const sy = s * (1 + ky) * (1 - kx * 0.55) * squeeze;
    p.el.style.transform = `translate3d(${(x * (p.width || 300)).toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
    const reveal = clamp(1.3 + r * 1.3, 0, 1);
    const gone = x > 0.55 ? clamp(1 - (x - 0.55) / 0.55, 0, 1) : 1;
    p.el.style.opacity = String(reveal * gone);
  }

  function layoutTop(el) {
    let y = 0;
    let node = el;
    while (node && node !== panel) {
      y += node.offsetTop;
      node = node.offsetParent;
    }
    return el !== scroll && scroll.contains(el) ? y - scroll.scrollTop : y;
  }

  function collect() {
    const next = [head];
    if (!quietNote.hidden) next.push(quietNote);
    Array.from(list.children).forEach((el) => next.push(el));
    if (!empty.hidden) next.push(empty);
    next.push(foot);
    pieces = next.map(piece);
    pieces.forEach((p) => {
      p.el.style.transformOrigin = '50% 0';
      p.inScroll = scroll.contains(p.el);
      p.top = Math.max(8, layoutTop(p.el));
      p.width = p.el.offsetWidth;
      p.height = p.el.offsetHeight;
    });
    scrollBottom = layoutTop(scroll) + scroll.clientHeight;
    footPad = Math.max(0, panel.offsetHeight - layoutTop(foot) - foot.offsetHeight);
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
  }

  function pieceBottom(p) {
    const r = p.m.get('r');
    const raw = r * p.top;
    const y = (raw > 0 ? 18 * Math.tanh(raw / 18) : raw) + p.m.get('dy');
    const squeeze = r < 0 ? clamp(1 + r, 0.08, 1) : 1 + 0.07 * Math.tanh(r * 6);
    return p.top + y + p.height * squeeze * p.m.get('s');
  }

  function contentBottom() {
    if (!pieces.length) return null;
    const cap = scrollBottom;
    let bottom = 0;
    pieces.forEach((p) => {
      const b = pieceBottom(p);
      bottom = Math.max(bottom, p.inScroll ? Math.min(b, cap + (b - p.top - p.height)) : b);
    });
    return bottom + footPad;
  }

  let scrollBottom = 0;
  let footPad = 0;
  let drawQueued = false;

  function queueDraw() {
    if (drawQueued) return;
    drawQueued = true;
    queueMicrotask(() => {
      drawQueued = false;
      paintShape(shape.values);
    });
  }

  function paintShape({ w, h, H }) {
    const tw = clamp(w, 0, 1);
    const th = clamp(h, 0, 1);
    const left = box.bl * (1 - tw);
    const right = (box.w - box.bl - box.bw) * (1 - tw);
    const top = box.bt * (1 - th);
    const hug = MotionSettings.reduced ? null : contentBottom();
    const bottom = Math.max(box.bt + box.bh, hug === null ? box.bt + box.bh + (Math.max(1, H) - box.bt - box.bh) * th : hug);
    const full = Math.max(box.h, bottom);
    const r = box.br + (box.r - box.br) * Math.min(tw, th);
    const shapeClip = `inset(${top.toFixed(2)}px ${right.toFixed(2)}px ${(full - bottom).toFixed(2)}px ${left.toFixed(2)}px round ${r.toFixed(2)}px)`;
    fill.style.height = `${full}px`;
    glass.style.height = `${full}px`;
    fill.style.clipPath = shapeClip;
    glass.style.clipPath = shapeClip;
    body.style.clipPath = `inset(${top.toFixed(2)}px ${right.toFixed(2)}px ${(box.h - bottom).toFixed(2)}px ${left.toFixed(2)}px round ${r.toFixed(2)}px)`;
    shadow.style.transform = `translate3d(${left.toFixed(2)}px, ${top.toFixed(2)}px, 0)`;
    shadow.style.width = `${Math.max(0, box.w - left - right)}px`;
    shadow.style.height = `${Math.max(0, bottom - top)}px`;
    shadow.style.borderRadius = `${r}px`;
    const ow = Math.max(0, w - 1);
    const oh = Math.max(0, h - 1);
    const sx = (1 + ow * 0.14) * (1 - oh * 0.06);
    const sy = (1 + oh * 0.12) * (1 - ow * 0.05);
    panel.style.transformOrigin = `${(box.bl + box.bw / 2).toFixed(1)}px ${(box.bt + box.bh / 2).toFixed(1)}px`;
    panel.style.transform = Math.abs(sx - 1) > 0.0005 || Math.abs(sy - 1) > 0.0005 ? `scale(${sx.toFixed(4)}, ${sy.toFixed(4)})` : '';
    glass.style.opacity = open && tw > 0.9 && th > 0.9 ? '1' : '0';
    panel.style.visibility = tw > 0.002 || th > 0.002 || open ? 'visible' : 'hidden';
  }

  function drive({ h }) {
    if (pieces.length && !MotionSettings.reduced && !clearing) {
      const lead = h < 1 ? h - 1 : (h - 1) * 0.35;
      const target = open ? lead : Math.min(0, lead);
      const last = pieces.length - 1;
      pieces.forEach((p, i) => {
        if (Math.abs(p.m.get('r') - target) > 0.0005 || Math.abs(p.m.velocity('r')) > 0.001) p.m.to({ r: target }, link(last - i));
      });
    }
  }
  shape.onUpdate((values) => {
    drive(values);
    paintShape(values);
  });

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
    const main = el.querySelector('.nc-item__main');
    main.addEventListener('click', (event) => {
      if (el.dataset.dragged) {
        event.preventDefault();
        delete el.dataset.dragged;
        return;
      }
      notifier.activate(item.id);
      hide({ focus: false });
    });
    el.querySelector('.nc-item__x').addEventListener('click', (event) => {
      event.stopPropagation();
      dismiss(item.id);
    });
    swipe(el, item.id);
    rows.set(item.id, { el, item });
    return el;
  }

  function swipe(el, id) {
    let start = null;
    let dragging = false;
    let last = { x: 0, t: 0, v: 0 };
    el.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('.nc-item__x')) return;
      start = { x: event.clientX, y: event.clientY };
      dragging = false;
      last = { x: event.clientX, t: performance.now(), v: 0 };
    });
    el.addEventListener('pointermove', (event) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!dragging) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
        dragging = true;
        try { el.setPointerCapture(event.pointerId); } catch (err) { dragging = true; }
      }
      const now = performance.now();
      const dt = Math.max(1, now - last.t);
      last = { x: event.clientX, t: now, v: ((event.clientX - last.x) / dt) * 1000 };
      const p = piece(el);
      const width = p.width || el.offsetWidth;
      const moved = dx > 0 ? dx : dx * 0.3;
      p.mx.set({ x: moved / width });
    });
    const release = () => {
      if (!start) return;
      start = null;
      if (!dragging) return;
      dragging = false;
      el.dataset.dragged = '1';
      window.setTimeout(() => delete el.dataset.dragged, 0);
      const p = piece(el);
      const width = p.width || el.offsetWidth;
      if (p.mx.get('x') > 0.35 || last.v > 700) dismiss(id, last.v / width);
      else p.mx.to({ x: 0 }, { response: 0.4, damping: 0.55, velocity: { x: last.v / width } });
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
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

  function layout() {
    const now = new Date();
    const history = notifier.history;
    const ids = new Set(history.map((item) => item.id));
    rows.forEach((entry, id) => {
      if (!ids.has(id)) {
        entry.el.remove();
        rows.delete(id);
      }
    });
    const nodes = [];
    let lastGroup = null;
    history.forEach((item) => {
      const group = groupOf(item, now);
      if (group !== lastGroup) {
        nodes.push(list.querySelector(`.nc__group[data-group="${group}"]`) || header(group));
        lastGroup = group;
      }
      const entry = rows.get(item.id);
      nodes.push(entry ? entry.el : buildRow(item));
    });
    Array.from(list.querySelectorAll('.nc__group')).forEach((el) => {
      if (!nodes.includes(el)) el.remove();
    });
    nodes.forEach((node, i) => {
      if (list.children[i] !== node) list.insertBefore(node, list.children[i] || null);
    });
    refreshMeta();
  }

  function settleHeight() {
    box.h = panel.offsetHeight;
    box.w = panel.offsetWidth;
    if (MotionSettings.reduced) shape.set({ H: box.h });
    else shape.to({ H: box.h }, GROW);
  }

  function flip(mutate) {
    const before = new Map(pieces.map((p) => [p.el, layoutTop(p.el)]));
    mutate();
    collect();
    pieces.forEach((p) => {
      const old = before.get(p.el);
      if (old === undefined) {
        if (MotionSettings.reduced) return;
        p.m.set({ r: 0, dy: -26, s: 0.86 });
        p.mx.set({ x: 0 });
        p.m.to({ dy: 0, s: 1 }, DROP);
        return;
      }
      const delta = old - p.top;
      if (Math.abs(delta) < 0.5 || MotionSettings.reduced) return;
      p.m.set({ dy: p.m.get('dy') + delta });
      p.m.to({ dy: 0 }, SETTLE);
    });
    settleHeight();
  }

  function dismiss(id, velocity = 0) {
    const entry = rows.get(id);
    if (!entry || clearing) return Promise.resolve();
    const p = piece(entry.el);
    if (p.leaving) return Promise.resolve();
    p.leaving = true;
    const focusNext = entry.el.contains(document.activeElement);
    const finish = () => {
      flip(() => {
        notifier.remove(id);
        layout();
      });
      if (focusNext) (list.querySelector('.nc-item__main') || dnd).focus({ preventScroll: true });
    };
    if (MotionSettings.reduced) {
      finish();
      return Promise.resolve();
    }
    return p.mx.to({ x: 1.3 }, { response: 0.3, damping: 0.92, velocity: { x: Math.max(1.4, velocity) } }).then(finish);
  }

  async function clearAll() {
    if (clearing || !rows.size) return;
    clearing = true;
    const leaving = pieces.filter((p) => p.el.parentNode === list);
    if (!MotionSettings.reduced) {
      await Promise.all(leaving.map((p, i) => p.mx.to({ x: 1.3 }, { response: 0.26 + Math.min(i, 10) * 0.035, damping: 0.9, velocity: { x: 1.2 } })));
    }
    clearing = false;
    flip(() => {
      notifier.clear();
      layout();
    });
    dnd.focus({ preventScroll: true });
  }

  function show({ keyboard = false } = {}) {
    if (open) return;
    open = true;
    fresh = new Set(notifier.history.filter((item) => !item.read).map((item) => item.id));
    panel.classList.add('is-open');
    bell.setAttribute('aria-expanded', 'true');
    panel.style.transform = '';
    layout();
    scroll.scrollTop = 0;
    place();
    pieces.forEach((p) => {
      p.m.set({ r: 0, dy: 0, s: 1 });
      p.mx.set({ x: 0 });
    });
    collect();
    if (MotionSettings.reduced) {
      shape.set({ w: 1, h: 1, H: box.h });
    } else {
      if (shape.get('h') < 0.05) {
        shape.set({ w: 0, h: 0, H: box.h });
        pieces.forEach((p) => p.m.set({ r: -1 }));
      } else {
        shape.set({ H: box.h });
      }
      shape.to({ w: 1 }, OPEN_W);
      shape.to({ h: 1 }, OPEN_H);
    }
    notifier.markAllRead();
    window.setTimeout(() => {
      if (!open) return;
      (keyboard ? panel.querySelector('.nc-item__main') || dnd : panel).focus({ preventScroll: true });
    }, MotionSettings.reduced ? 0 : 80);
  }

  function hide({ focus = true } = {}) {
    if (!open) return;
    open = false;
    bell.setAttribute('aria-expanded', 'false');
    glass.style.opacity = '0';
    if (MotionSettings.reduced) {
      shape.set({ w: 0, h: 0 });
      panel.classList.remove('is-open');
    } else {
      shape.to({ w: 0 }, CLOSE_W);
      shape.to({ h: 0 }, CLOSE_H).then((done) => {
        if (done && !open) panel.classList.remove('is-open');
      });
    }
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
      const focusables = Array.from(panel.querySelectorAll('button')).filter((el) => !el.hidden && el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
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
    if (!open) return;
    place();
    collect();
    shape.set({ H: box.h });
  });

  scroll.addEventListener('scroll', () => {
    if (open) pieces.forEach((p) => { p.top = Math.max(8, layoutTop(p.el)); });
  }, { passive: true });

  notifier.subscribe(({ type }) => {
    if (!open || clearing) return;
    if (type === 'add' || type === 'sync') {
      notifier.history.forEach((item) => {
        if (!rows.has(item.id) && !item.read) fresh.add(item.id);
      });
      flip(() => layout());
      notifier.markAllRead();
      return;
    }
    if (type === 'prefs') {
      flip(() => refreshMeta());
      return;
    }
    refreshMeta();
  });

  window.setInterval(() => {
    if (open) refreshMeta();
  }, 30000);

  paintShape({ w: 0, h: 0, H: 0 });

  return {
    show,
    hide,
    toggle,
    get open() { return open; },
  };
}
