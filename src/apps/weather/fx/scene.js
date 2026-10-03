import { MotionSettings } from '../../../motion/presets.js';
import { Fx } from '../../../ui/fx-tier.js';
import { canAnimate, effectFor, shouldRun } from './plan.js';
import { onFxPrefs, readFxPrefs } from './prefs.js';
import { createRain } from './rain.js';
import { createSnow } from './snow.js';
import { createCloud, createFog, createNight, createSun } from './sky.js';

const MAX_PIXELS = 2400000;
const FADE = 0.45;

const FACTORY = {
  rain: (env) => createRain(env),
  storm: (env) => createRain(env, { storm: true }),
  snow: (env) => createSnow(env),
  sun: (env) => createSun(env),
  night: (env) => createNight(env),
  cloud: (env) => createCloud(env),
  fog: (env) => createFog(env),
};

export function createWeatherFx({ win, store, appId = 'weather', tempTarget = null }) {
  const frame = win.querySelector('.wm-window__frame');
  const canvas = document.createElement('canvas');
  canvas.className = 'wx-fx';
  canvas.setAttribute('aria-hidden', 'true');
  frame.prepend(canvas);
  const ctx = canvas.getContext('2d');

  let prefs = readFxPrefs();
  let effect = null;
  let layers = [];
  let size = { w: 0, h: 0, dpr: 1 };
  let raf = 0;
  let last = 0;
  let covered = false;
  let coverTimer = 0;
  const pointer = { x: 0, y: 0, active: false };

  function phone() {
    return window.innerWidth < 768;
  }

  function env(base = effect) {
    const tier = Fx.tier;
    return {
      w: size.w,
      h: size.h,
      width: size.w,
      height: size.h,
      level: prefs.level,
      tier,
      dark: document.documentElement.dataset.theme === 'dark',
      intensity: base ? base.intensity : 1,
      slope: base ? base.slope : 0,
      lightning: prefs.lightning,
      animate: canAnimate({ tier, phone: phone(), reduced: MotionSettings.reduced }),
      pointer,
      tempRect,
    };
  }

  function tempRect() {
    if (!tempTarget) return null;
    const a = tempTarget.getBoundingClientRect();
    const b = frame.getBoundingClientRect();
    if (!a.width || !b.width) return null;
    const scale = b.width / Math.max(1, frame.clientWidth);
    return { left: (a.left - b.left) / scale, top: (a.top - b.top) / scale, width: a.width / scale, height: a.height / scale };
  }

  function resize() {
    const w = frame.clientWidth;
    const h = frame.clientHeight;
    if (!w || !h) return false;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (w * h * dpr * dpr > MAX_PIXELS) dpr = Math.sqrt(MAX_PIXELS / (w * h));
    if (w === size.w && h === size.h && dpr === size.dpr) return true;
    size = { w, h, dpr };
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    layers.forEach((layer) => layer.fx.configure(env(layer.spec)));
    return true;
  }

  function isOpen() {
    const record = store.get(appId);
    return !!record && record.state === 'open';
  }

  function checkCovered() {
    const mine = win.getBoundingClientRect();
    const myZ = Number(win.style.zIndex) || 0;
    covered = Array.from(document.querySelectorAll('.wm-window')).some((other) => {
      if (other === win || other.style.display === 'none') return false;
      const id = other.dataset.appId;
      const record = id && store.get(id);
      if (!record || record.state !== 'open') return false;
      if ((Number(other.style.zIndex) || 0) <= myZ) return false;
      const r = other.getBoundingClientRect();
      return r.left <= mine.left && r.top <= mine.top && r.right >= mine.right && r.bottom >= mine.bottom;
    });
  }

  function clear() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function paint(dt) {
    clear();
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    const animate = canAnimate({ tier: Fx.tier, phone: phone(), reduced: MotionSettings.reduced });
    const k = 1 - Math.exp(-dt / FADE);
    layers.forEach((layer) => {
      layer.alpha += (layer.target - layer.alpha) * (animate ? k : 1);
      if (!animate && layer.fx.staticSkip) return;
      if (animate) layer.fx.update(dt);
      if (layer.alpha > 0.004) layer.fx.draw(ctx, Math.min(1, layer.alpha));
    });
    layers = layers.filter((layer) => layer.target > 0 || layer.alpha > 0.01);
  }

  function frameStep(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    paint(dt);
    schedule();
  }

  function runnable() {
    return shouldRun({
      enabled: prefs.enabled,
      reduced: MotionSettings.reduced,
      visible: document.visibilityState === 'visible',
      open: isOpen(),
      sized: resize(),
      covered,
      effect,
    });
  }

  function schedule() {
    if (raf) return;
    if (!runnable()) {
      last = 0;
      if (!prefs.enabled || MotionSettings.reduced || !effect) {
        layers = [];
        clear();
      }
      return;
    }
    if (!canAnimate({ tier: Fx.tier, phone: phone(), reduced: MotionSettings.reduced })) {
      last = 0;
      paint(0);
      return;
    }
    raf = requestAnimationFrame(frameStep);
  }

  function refresh() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    schedule();
  }

  let lastInput = null;

  function set(weather) {
    lastInput = weather;
    const next = effectFor(weather);
    const sameKind = next && effect && next.kind === effect.kind;
    effect = next;
    resize();
    if (!next) {
      layers.forEach((layer) => { layer.target = 0; });
      refresh();
      return;
    }
    const current = layers.find((layer) => layer.target > 0 && layer.kind === next.kind);
    if (sameKind && current) {
      current.spec = next;
      current.fx.configure(env(next));
    } else {
      layers.forEach((layer) => { layer.target = 0; });
      const reuse = layers.find((layer) => layer.kind === next.kind);
      if (reuse) {
        reuse.target = 1;
        reuse.spec = next;
        reuse.fx.configure(env(next));
      } else {
        layers.push({ kind: next.kind, spec: next, fx: FACTORY[next.kind](env(next)), alpha: 0, target: 1 });
      }
    }
    refresh();
  }

  function reconfigure() {
    if (effect && !layers.some((layer) => layer.target > 0)) {
      set(lastInput);
      return;
    }
    layers.forEach((layer) => layer.fx.configure(env(layer.spec)));
    refresh();
  }

  new ResizeObserver(() => {
    resize();
    if (!raf) schedule();
  }).observe(frame);
  store.subscribe(({ id }) => {
    if (id === appId) window.setTimeout(refresh, 0);
    else if (isOpen()) {
      checkCovered();
      refresh();
    }
  });
  document.addEventListener('visibilitychange', refresh);
  onFxPrefs((next) => {
    prefs = next;
    reconfigure();
  });
  MotionSettings.subscribe(reconfigure);
  if (typeof Fx.subscribe === 'function') Fx.subscribe(reconfigure);
  new MutationObserver(reconfigure).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('resize', reconfigure);
  coverTimer = window.setInterval(() => {
    if (!isOpen() || document.visibilityState !== 'visible') return;
    const was = covered;
    checkCovered();
    if (was !== covered) refresh();
  }, 1000);

  win.addEventListener('pointermove', (event) => {
    const b = frame.getBoundingClientRect();
    const scale = b.width / Math.max(1, frame.clientWidth);
    pointer.x = (event.clientX - b.left) / scale;
    pointer.y = (event.clientY - b.top) / scale;
    pointer.active = true;
  }, { passive: true });
  win.addEventListener('pointerleave', () => { pointer.active = false; });

  return {
    set,
    refresh,
    get running() { return !!raf; },
    step(dt = 1 / 60) {
      if (!resize()) return;
      paint(dt);
    },
    get layers() { return layers.map((layer) => ({ kind: layer.kind, alpha: layer.alpha, target: layer.target })); },
    destroy() {
      window.clearInterval(coverTimer);
      if (raf) cancelAnimationFrame(raf);
      canvas.remove();
    },
  };
}
