import { Animator } from '../motion/animator.js';

const KEY = 'yoworingo.fx';
const ORDER = ['full', 'lite', 'solid'];
const SLOW_FRAME = 25;
const SLOW_SHARE = 0.25;
const WINDOW_MS = 2000;
const MIN_FRAMES = 40;
const CHECK_EVERY = 400;

const listeners = new Set();
let choice = 'auto';
let learned = null;
let detected = 'full';

function read() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    if (['auto', ...ORDER].includes(saved.choice)) choice = saved.choice;
    if (ORDER.includes(saved.learned)) learned = saved.learned;
  } catch (err) {}
}

function write() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ choice, learned }));
  } catch (err) {}
}

function query(text) {
  return !!window.matchMedia && window.matchMedia(text).matches;
}

function detect() {
  if (query('(prefers-reduced-transparency: reduce)')) return 'solid';
  const memory = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  const smallTouch = query('(pointer: coarse)') && Math.min(window.screen.width, window.screen.height) < 820;
  if ((memory && memory <= 4) || (cores && cores <= 4) || smallTouch) return 'lite';
  return 'full';
}

function lower(a, b) {
  return ORDER[Math.max(ORDER.indexOf(a), ORDER.indexOf(b))];
}

function autoTier() {
  return learned ? lower(detected, learned) : detected;
}

function emit() {
  const tier = Fx.tier;
  document.documentElement.dataset.fx = tier;
  listeners.forEach((listener) => listener(tier));
}

function monitor() {
  let frames = [];
  let last = 0;
  let running = false;

  function frame(now) {
    if (!running) return;
    if (last) frames.push({ t: now, d: now - last });
    last = now;
    frames = frames.filter((entry) => now - entry.t <= WINDOW_MS);
    if (frames.length >= MIN_FRAMES) {
      const slow = frames.filter((entry) => entry.d > SLOW_FRAME).length;
      if (slow / frames.length > SLOW_SHARE) downgrade();
    }
    if (Animator.activeCount > 0 && document.visibilityState === 'visible') {
      window.requestAnimationFrame(frame);
    } else {
      running = false;
      last = 0;
    }
  }

  function downgrade() {
    frames = [];
    const current = autoTier();
    const next = ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(current) + 1)];
    if (next === current) return;
    learned = next;
    write();
    if (choice === 'auto') emit();
  }

  window.setInterval(() => {
    if (running || choice !== 'auto' || document.visibilityState !== 'visible') return;
    if (Animator.activeCount === 0) return;
    running = true;
    last = 0;
    window.requestAnimationFrame(frame);
  }, CHECK_EVERY);
}

export const Fx = {
  get choice() { return choice; },
  get auto() { return autoTier(); },
  get tier() { return choice === 'auto' ? autoTier() : choice; },
  blur(px) {
    return Fx.tier === 'solid' ? 0 : px;
  },
  set(next) {
    if (!['auto', ...ORDER].includes(next)) return;
    choice = next;
    if (next === 'auto') learned = null;
    write();
    emit();
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  boot() {
    read();
    detected = detect();
    emit();
    monitor();
  },
};
