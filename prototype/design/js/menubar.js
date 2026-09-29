import { createMotion } from '../../../src/motion/animator.js';
import { MotionSettings } from '../../../src/motion/presets.js';
import { createOdometer } from './odometer.js';

const LEAD = { response: 0.26, damping: 0.6 };
const TRAIL = { response: 0.46, damping: 0.72 };
const APPEAR = { response: 0.34, damping: 0.55 };
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function pad(n) {
  return String(n).padStart(2, '0');
}

function soft(config) {
  return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
}

function createPlatter(root) {
  const platter = root.querySelector('.menubar__platter');
  const motion = createMotion({ l: 0, r: 0, o: 0, s: 1, p: 1 }, { response: 0.3, damping: 0.8, restDelta: { l: 0.05, r: 0.05, o: 0.002, s: 0.0005, p: 0.0005 } });
  let target = null;

  function rectOf(el) {
    const host = root.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return { l: box.left - host.left, r: box.right - host.left };
  }

  motion.onUpdate(({ l, r, o, s, p }) => {
    const left = Math.min(l, r);
    const width = Math.max(0, Math.abs(r - l));
    const base = target ? target.offsetWidth : width;
    const stretch = base > 0 ? Math.max(0, width - base) / base : 0;
    const squash = MotionSettings.reduced ? 0 : Math.min(0.16, stretch * 0.22);
    platter.style.width = `${width}px`;
    platter.style.opacity = String(Math.max(0, Math.min(1, o)));
    platter.style.transform = `translate3d(${left}px, 0, 0) scale(${s * p}, ${s * p * (1 - squash)})`;
  });

  function moveTo(el) {
    target = el;
    const next = rectOf(el);
    if (motion.get('o') < 0.05) {
      motion.set({ l: next.l, r: next.r, s: MotionSettings.reduced ? 1 : 0.84 });
      motion.to({ o: 1 }, { response: 0.2, damping: 1 });
      motion.to({ s: 1 }, soft(APPEAR));
      return;
    }
    const forward = (next.l + next.r) / 2 >= (motion.get('l') + motion.get('r')) / 2;
    motion.to({ r: next.r }, soft(forward ? LEAD : TRAIL));
    motion.to({ l: next.l }, soft(forward ? TRAIL : LEAD));
  }

  function refresh() {
    if (!target || motion.get('o') < 0.05) return;
    const next = rectOf(target);
    motion.to({ l: next.l, r: next.r }, soft(LEAD));
  }

  function hide() {
    target = null;
    motion.to({ o: 0 }, { response: 0.22, damping: 1 });
    motion.to({ s: 0.9 }, { response: 0.26, damping: 1 });
  }

  function press(down) {
    if (MotionSettings.reduced) return;
    motion.to({ p: down ? 0.92 : 1 }, down ? { response: 0.14, damping: 1 } : { response: 0.38, damping: 0.42 });
  }

  root.addEventListener('pointerover', (event) => {
    const item = event.target.closest('[data-mb]');
    if (item && item !== target && root.contains(item)) moveTo(item);
  });
  root.addEventListener('pointerleave', hide);
  root.addEventListener('pointerdown', (event) => {
    if (event.target.closest('[data-mb]')) press(true);
  });
  window.addEventListener('pointerup', () => press(false));
  root.addEventListener('focusin', (event) => {
    const item = event.target.closest('[data-mb]');
    if (item && item.matches(':focus-visible')) moveTo(item);
  });
  root.addEventListener('focusout', hide);

  return { refresh };
}

function createAppTitle(el) {
  const motion = createMotion({ e: 1 }, { response: 0.3, damping: 1, restDelta: 0.002 });
  let shown = el.textContent;
  let wanted = shown;
  let direction = -1;
  let token = 0;

  motion.onUpdate(({ e }) => {
    const t = Math.max(0, Math.min(1, e));
    el.style.opacity = String(t);
    el.style.filter = t < 0.98 ? `blur(${((1 - t) * 5).toFixed(2)}px)` : '';
    el.style.transform = t < 0.999 ? `translate3d(0, ${direction * (1 - t) * 6}px, 0) scale(${0.94 + 0.06 * t})` : '';
  });

  return function set(title) {
    if (title === wanted) return;
    wanted = title;
    const mine = ++token;
    if (MotionSettings.reduced) {
      el.textContent = title;
      shown = title;
      return;
    }
    direction = -1;
    motion.to({ e: 0 }, { response: 0.16, damping: 1 }).then(() => {
      if (mine !== token) return;
      el.textContent = title;
      shown = title;
      direction = 1;
      motion.to({ e: 1 }, { response: 0.4, damping: 0.72 });
    });
  };
}

function createClock(root) {
  const dateEl = root.querySelector('.mb-clock__date');
  const timeEl = root.querySelector('.mb-clock__time');
  const minutesNow = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  };
  const odometer = createOdometer(timeEl, { value: minutesNow(), format: (value) => `${pad(Math.floor(value / 60))}:${pad(value % 60)}` });

  function tick() {
    const now = new Date();
    dateEl.textContent = `${now.getMonth() + 1}/${now.getDate()} 週${WEEK[now.getDay()]}`;
    const minutes = minutesNow();
    if (minutes !== odometer.value) odometer.set(minutes);
  }

  tick();
  window.setInterval(tick, 5000);
}

function createRadio(wrap, onLayout) {
  const inner = wrap.querySelector('.mb-radio__inner');
  const button = wrap.querySelector('.mb-item');
  const motion = createMotion({ w: 0, e: 0 }, { response: 0.4, damping: 0.7, restDelta: { w: 0.05, e: 0.002 } });
  let playing = false;
  let timer = 0;

  motion.onUpdate(({ w, e }) => {
    wrap.style.width = `${Math.max(0, w)}px`;
    const t = Math.max(0, Math.min(1, e));
    inner.style.opacity = String(t);
    inner.style.filter = t < 0.98 ? `blur(${((1 - t) * 4).toFixed(2)}px)` : '';
    onLayout();
  });

  function natural() {
    return button.scrollWidth;
  }

  wrap.inert = true;

  return {
    get playing() { return playing; },
    set(on) {
      playing = !!on;
      window.clearTimeout(timer);
      wrap.classList.toggle('is-playing', playing);
      wrap.inert = !playing;
      if (MotionSettings.reduced) {
        motion.to({ w: playing ? natural() : 0, e: playing ? 1 : 0 }, MotionSettings.spring('focus'));
        return;
      }
      if (playing) {
        motion.to({ w: natural() }, { response: 0.44, damping: 0.62 });
        timer = window.setTimeout(() => motion.to({ e: 1 }, { response: 0.32, damping: 0.8 }), 90);
      } else {
        motion.to({ e: 0 }, { response: 0.16, damping: 1 });
        timer = window.setTimeout(() => motion.to({ w: 0 }, { response: 0.36, damping: 0.78 }), 70);
      }
    },
  };
}

function createBell(button) {
  const glyph = button.querySelector('svg');
  const badge = button.querySelector('.mb-badge');
  const host = badge.querySelector('.odo-host');
  let count = 0;
  const odometer = createOdometer(host, { value: 0, format: (value) => String(Math.round(value)) });
  const swing = createMotion({ a: 0 }, { response: 0.5, damping: 0.22, restDelta: 0.05 });
  const pop = createMotion({ s: 1 }, { response: 0.36, damping: 0.45, restDelta: 0.0005 });

  swing.onUpdate(({ a }) => {
    glyph.style.transform = Math.abs(a) < 0.05 ? '' : `rotate(${a}deg)`;
  });
  pop.onUpdate(({ s }) => {
    badge.style.transform = Math.abs(s - 1) < 0.0005 ? '' : `scale(${Math.max(0, s)})`;
  });

  function ring() {
    if (MotionSettings.reduced) return;
    swing.to({ a: 0 }, { response: 0.5, damping: 0.22, velocity: { a: 520 } });
  }

  function set(next) {
    const previous = count;
    count = Math.max(0, next);
    badge.hidden = count === 0;
    button.setAttribute('aria-label', count > 0 ? `日程提醒，${count} 件` : '日程提醒');
    if (count === 0) return;
    odometer.set(count, previous === 0 ? { from: count } : undefined);
    if (count > previous && !MotionSettings.reduced) {
      pop.set({ s: previous === 0 ? 0.3 : 0.7 });
      pop.to({ s: 1 }, { response: 0.36, damping: 0.45, velocity: { s: 3 } });
      ring();
    }
  }

  button.addEventListener('click', ring);
  return { set, ring, get count() { return count; } };
}

export function createMenubar({ root, store, titles, onOpen }) {
  const platter = createPlatter(root);
  const setTitle = createAppTitle(root.querySelector('.mb-app__text'));
  createClock(root);
  const radio = createRadio(root.querySelector('.mb-radio'), () => platter.refresh());
  const bell = createBell(root.querySelector('.mb-bell'));

  root.querySelectorAll('[data-open]').forEach((el) => {
    el.addEventListener('click', () => onOpen(el.dataset.open));
  });

  function syncTitle() {
    const id = store.focusedId;
    const record = id ? store.get(id) : null;
    setTitle(record && record.state === 'open' ? titles.get(id) : '桌面');
  }

  store.subscribe(({ type }) => {
    if (type !== 'frame') syncTitle();
  });
  syncTitle();

  return {
    setPlaying: radio.set,
    get playing() { return radio.playing; },
    setReminders: bell.set,
    get reminders() { return bell.count; },
  };
}
