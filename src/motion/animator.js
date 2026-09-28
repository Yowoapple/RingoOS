import { createSpring } from './spring.js';

const active = new Set();
let rafId = null;
let lastTime = null;
let timeScale = 1;
let manual = false;

function tickAll(dt) {
  Array.from(active).forEach((motion) => motion.tick(dt));
}

function frame(now) {
  rafId = null;
  const dt = lastTime === null ? 1 / 60 : (now - lastTime) / 1000;
  lastTime = now;
  tickAll(dt * timeScale);
  if (active.size > 0 && !manual) rafId = requestAnimationFrame(frame);
  else lastTime = null;
}

function ensureRunning() {
  if (manual || rafId !== null || active.size === 0) return;
  lastTime = null;
  rafId = requestAnimationFrame(frame);
}

function finishAll() {
  Array.from(active).forEach((motion) => motion.finish());
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') finishAll();
  });
}

export function createMotion(initial, defaults = {}) {
  const springs = new Map();
  const updateListeners = new Set();
  let pending = [];

  function restDeltaFor(key) {
    const option = defaults.restDelta;
    return option !== null && typeof option === 'object' ? option[key] : option;
  }

  function makeSpring(key, value) {
    return createSpring({ value, response: defaults.response, damping: defaults.damping, restDelta: restDeltaFor(key) });
  }

  Object.entries(initial).forEach(([key, value]) => {
    springs.set(key, makeSpring(key, value));
  });

  function snapshot() {
    const out = {};
    springs.forEach((spring, key) => { out[key] = spring.value; });
    return out;
  }

  function emit() {
    const values = snapshot();
    updateListeners.forEach((listener) => listener(values));
  }

  function resolvePending(finished) {
    const list = pending;
    pending = [];
    list.forEach((resolve) => resolve(finished));
  }

  function allSettled() {
    for (const spring of springs.values()) if (!spring.settled) return false;
    return true;
  }

  const motion = {
    get values() { return snapshot(); },
    get isAnimating() { return active.has(motion); },
    get(key) { return springs.get(key).value; },
    velocity(key) { return springs.get(key).velocity; },
    onUpdate(listener) {
      updateListeners.add(listener);
      return () => updateListeners.delete(listener);
    },
    to(targets, config = {}) {
      resolvePending(false);
      Object.entries(targets).forEach(([key, target]) => {
        let spring = springs.get(key);
        if (!spring) {
          spring = makeSpring(key, target);
          springs.set(key, spring);
        }
        spring.setParams({ response: config.response ?? spring.response, damping: config.damping ?? spring.damping });
        const velocity = config.velocity && config.velocity[key];
        spring.setTarget(target, velocity);
      });
      const promise = new Promise((resolve) => pending.push(resolve));
      if (allSettled()) {
        emit();
        resolvePending(true);
      } else {
        active.add(motion);
        ensureRunning();
      }
      return promise;
    },
    set(values) {
      resolvePending(false);
      Object.entries(values).forEach(([key, value]) => {
        const spring = springs.get(key);
        if (spring) spring.snap(value);
        else springs.set(key, makeSpring(key, value));
      });
      if (allSettled()) active.delete(motion);
      emit();
    },
    tick(dt) {
      let done = true;
      springs.forEach((spring) => { if (!spring.step(dt)) done = false; });
      emit();
      if (done) {
        active.delete(motion);
        resolvePending(true);
      }
    },
    finish() {
      springs.forEach((spring) => spring.finish());
      active.delete(motion);
      emit();
      resolvePending(true);
    },
    stop() {
      springs.forEach((spring) => spring.snap(spring.value));
      active.delete(motion);
      resolvePending(false);
    },
  };

  return motion;
}

export const Animator = {
  get activeCount() { return active.size; },
  get timeScale() { return timeScale; },
  setTimeScale(value) {
    timeScale = Math.max(0.01, value);
  },
  setManual(value) {
    manual = !!value;
    if (manual && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (!manual) ensureRunning();
  },
  step(ms) {
    tickAll((ms / 1000) * timeScale);
  },
  finishAll,
};
