import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';
import {
  clamp,
  clampPosition,
  detachFromSnap,
  fitFrame,
  lerp,
  morphState,
  glideDistance,
  resizeFrame,
  rubberbandPosition,
  snapFrame,
  snapZoneAt,
} from './geometry.js';

const EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const DRAG_THRESHOLD = 4;
const PHONE_BREAKPOINT = 768;
const WINDOW_RADIUS = { desktop: 12, phone: 0 };
const ICON_RADIUS_RATIO = 0.225;
const VELOCITY_WINDOW = 90;

function capture(el, pointerId) {
  try {
    el.setPointerCapture(pointerId);
  } catch (err) {}
}

function createVelocityTracker() {
  let samples = [];
  return {
    reset() { samples = []; },
    add(x, y) {
      const t = performance.now();
      samples.push({ t, x, y });
      samples = samples.filter((s) => t - s.t <= VELOCITY_WINDOW);
    },
    get() {
      if (samples.length < 2) return { x: 0, y: 0 };
      const last = samples[samples.length - 1];
      if (performance.now() - last.t > 60) return { x: 0, y: 0 };
      const first = samples[0];
      const dt = (last.t - first.t) / 1000;
      if (dt <= 0) return { x: 0, y: 0 };
      return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
    },
  };
}

export function createWindowManager({ root, areaEl, backdropEl, apps, store, dock, renderIcon }) {
  let area = { left: 0, top: 0, w: 0, h: 0 };
  let layout = 'desktop';
  const windows = new Map();
  const backdrop = createMotion({ b: 0 }, { response: 0.3, damping: 1 });
  const preview = document.createElement('div');
  preview.className = 'wm-snap-preview';
  areaEl.appendChild(preview);
  const previewMotion = createMotion({ x: 0, y: 0, w: 0, h: 0, o: 0 }, { response: 0.28, damping: 0.9 });
  let previewZone = null;

  previewMotion.onUpdate((v) => {
    preview.style.transform = `translate3d(${v.x}px, ${v.y}px, 0)`;
    preview.style.width = `${Math.max(0, v.w)}px`;
    preview.style.height = `${Math.max(0, v.h)}px`;
    preview.style.opacity = String(clamp(v.o, 0, 1));
  });

  backdrop.onUpdate(({ b }) => {
    if (!backdropEl) return;
    backdropEl.style.transform = b > 0.001 ? `scale(${1 - 0.03 * b})` : '';
    backdropEl.style.filter = b > 0.001 ? `blur(${(8 * b).toFixed(2)}px)` : '';
  });

  function measureArea() {
    const rect = areaEl.getBoundingClientRect();
    area = { left: rect.left, top: rect.top, w: rect.width, h: rect.height };
  }

  function iconInArea(win) {
    const rect = dock.getIconRect(win.app.id);
    return { x: rect.x - area.left, y: rect.y - area.top, size: Math.max(8, rect.size) };
  }

  function windowRadius() {
    return WINDOW_RADIUS[layout];
  }

  function buildWindow(app) {
    const el = document.createElement('section');
    el.className = 'wm-window';
    el.dataset.appId = app.id;
    el.setAttribute('aria-label', app.title);
    el.innerHTML = `
      <div class="wm-window__shadow"></div>
      <div class="wm-window__frame">
        <div class="wm-window__chrome">
          <header class="wm-titlebar">
            <div class="wm-titlebar__controls">
              <button type="button" class="wm-control wm-control--close" data-wm-control="close" aria-label="關閉"></button>
              <button type="button" class="wm-control wm-control--minimize" data-wm-control="minimize" aria-label="縮小"></button>
              <button type="button" class="wm-control wm-control--zoom" data-wm-control="zoom" aria-label="最大化"></button>
            </div>
            <div class="wm-titlebar__title">${app.title}</div>
          </header>
          <div class="wm-window__body">${app.render()}</div>
        </div>
        <div class="wm-window__icon">${renderIcon(app)}</div>
        <div class="wm-homebar" data-wm-homebar><span></span></div>
      </div>
      ${EDGES.map((edge) => `<div class="wm-handle wm-handle--${edge}" data-wm-edge="${edge}"></div>`).join('')}
    `;
    areaEl.appendChild(el);

    const record = store.register({ id: app.id, title: app.title, frame: app.frame, min: app.min });
    const win = {
      app,
      el,
      record,
      frameEl: el.querySelector('.wm-window__frame'),
      shadowEl: el.querySelector('.wm-window__shadow'),
      chromeEl: el.querySelector('.wm-window__chrome'),
      iconEl: el.querySelector('.wm-window__icon'),
      titlebar: el.querySelector('.wm-titlebar'),
      homebar: el.querySelector('[data-wm-homebar]'),
      morph: createMotion({ p: 0, ox: 0, oy: 0, fade: 1 }, { response: 0.42, damping: 0.86, restDelta: 0.0002 }),
      frame: createMotion({ x: 0, y: 0, w: app.frame.w, h: app.frame.h }, { response: 0.4, damping: 0.9, restDelta: 0.05 }),
      pulse: createMotion({ s: 1 }, { response: 0.3, damping: 1, restDelta: 0.0001 }),
      applied: { w: -1, h: -1, rest: null },
      visible: false,
    };
    win.morph.onUpdate(() => render(win));
    win.frame.onUpdate(() => render(win));
    win.pulse.onUpdate(() => render(win));
    windows.set(app.id, win);
    bindWindow(win);
    return win;
  }

  function render(win) {
    if (!win.visible) return;
    const f = win.frame.values;
    const m = win.morph.values;
    const pulse = win.pulse.get('s');
    const w = Math.max(1, Math.round(f.w));
    const h = Math.max(1, Math.round(f.h));
    if (w !== win.applied.w || h !== win.applied.h) {
      win.el.style.width = `${w}px`;
      win.el.style.height = `${h}px`;
      const side = Math.min(w, h);
      win.iconEl.style.width = `${side}px`;
      win.iconEl.style.height = `${side}px`;
      win.iconEl.style.setProperty('--icon-side', `${side}px`);
      win.applied.w = w;
      win.applied.h = h;
    }
    const atRest = Math.abs(m.p - 1) < 0.0001 && Math.abs(m.ox) < 0.01 && Math.abs(m.oy) < 0.01;
    win.el.style.opacity = String(clamp(m.fade, 0, 1));
    if (atRest) {
      const tx = f.x + (w * (1 - pulse)) / 2;
      const ty = f.y + (h * (1 - pulse)) / 2;
      win.el.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${pulse})`;
      if (win.applied.rest !== true) {
        win.frameEl.style.clipPath = '';
        win.frameEl.style.borderRadius = '';
        win.shadowEl.style.inset = '';
        win.shadowEl.style.borderRadius = '';
        win.shadowEl.style.opacity = '';
        win.chromeEl.style.opacity = '';
        win.iconEl.style.opacity = '0';
        win.el.classList.remove('is-morphing');
        win.applied.rest = true;
      }
      return;
    }
    const icon = iconInArea(win);
    const state = morphState(m.p, icon, { x: f.x, y: f.y, w, h }, { icon: icon.size * ICON_RADIUS_RATIO, window: windowRadius() });
    const scale = state.scale * pulse;
    win.el.style.transform = `translate3d(${state.tx + m.ox}px, ${state.ty + m.oy}px, 0) scale(${scale})`;
    const clip = `inset(${state.insetY}px ${state.insetX}px round ${state.radius}px)`;
    win.frameEl.style.clipPath = clip;
    win.frameEl.style.borderRadius = `${state.radius}px`;
    win.shadowEl.style.inset = `${state.insetY}px ${state.insetX}px`;
    win.shadowEl.style.borderRadius = `${state.radius}px`;
    win.shadowEl.style.opacity = String(state.contentOpacity);
    win.chromeEl.style.opacity = String(state.contentOpacity);
    win.iconEl.style.opacity = String(state.iconOpacity);
    win.el.classList.add('is-morphing');
    win.applied.rest = false;
  }

  function applyOrder() {
    const order = store.order();
    windows.forEach((win) => {
      win.el.style.zIndex = String(10 + order.indexOf(win.app.id));
      win.el.classList.toggle('is-focused', store.focusedId === win.app.id);
    });
  }

  function show(win) {
    if (win.visible) return;
    win.visible = true;
    win.applied.rest = null;
    win.el.style.display = 'block';
  }

  function hide(win) {
    win.visible = false;
    win.el.style.display = 'none';
    win.morph.set({ p: 0, ox: 0, oy: 0, fade: 1 });
  }

  function defaultFrame(win) {
    if (layout === 'phone') return { x: 0, y: 0, w: area.w, h: area.h };
    const base = win.record.frame;
    if (Number.isFinite(base.x) && Number.isFinite(base.y)) {
      return fitFrame({ x: base.x, y: base.y, w: base.w, h: base.h }, win.record.min, area);
    }
    const cascade = store.all().filter((r) => r.state === 'open').length * 28;
    const x = (area.w - base.w) / 2 + cascade;
    const y = Math.max(0, (area.h - base.h) / 2 - 40) + cascade;
    return fitFrame({ x, y, w: base.w, h: base.h }, win.record.min, area);
  }

  function pulseFocus(win) {
    if (MotionSettings.reduced) return;
    win.pulse.set({ s: 0.985 });
    win.pulse.to({ s: 1 }, MotionSettings.spring('focus'));
  }

  function pulseBackdrop() {
    if (!MotionSettings.backdrop || !backdropEl) return;
    backdrop.to({ b: 1 }, { response: 0.24, damping: 1 }).then((done) => {
      if (done) backdrop.to({ b: 0 }, { response: 0.5, damping: 1 });
    });
  }

  function open(id) {
    const win = windows.get(id);
    const record = store.get(id);
    if (record.state === 'open') {
      if (store.focusedId !== id) {
        store.focus(id);
        pulseFocus(win);
      }
      return;
    }
    if (layout === 'phone') {
      store.all().filter((r) => r.state === 'open' && r.id !== id).forEach((r) => {
        store.minimize(r.id);
        hide(windows.get(r.id));
      });
    }
    const wasClosed = record.state === 'closed';
    let frame;
    if (layout === 'phone') frame = { x: 0, y: 0, w: area.w, h: area.h };
    else if (wasClosed) frame = defaultFrame(win);
    else if (record.snap) frame = snapFrame(record.snap, area);
    else frame = fitFrame(record.frame, record.min, area);
    if (record.snap && layout !== 'phone') store.setSnap(id, record.snap, frame);
    else store.setFrame(id, frame);
    if (!win.visible || wasClosed || layout === 'phone') win.frame.set(frame);
    else win.frame.to(frame, MotionSettings.spring('snap'));
    const interrupting = win.visible && win.morph.isAnimating;
    show(win);
    store.open(id);
    if (MotionSettings.reduced) {
      win.morph.set({ p: 1, ox: 0, oy: 0 });
      if (!interrupting) win.morph.set({ fade: 0 });
      win.morph.to({ fade: 1 }, MotionSettings.spring('open'));
    } else {
      if (!interrupting) win.morph.set({ p: 0, ox: 0, oy: 0, fade: 1 });
      win.morph.to({ p: 1, ox: 0, oy: 0, fade: 1 }, MotionSettings.spring('open'));
      pulseBackdrop();
    }
    if (wasClosed) dock.bounce(id);
  }

  function sendToDock(win, action, velocity) {
    const id = win.app.id;
    if (action === 'close') store.close(id);
    else store.minimize(id);
    const finish = (done) => { if (done) hide(win); };
    if (MotionSettings.reduced) {
      win.morph.to({ fade: 0 }, MotionSettings.spring('close')).then(finish);
      return;
    }
    const config = { ...MotionSettings.spring('close') };
    if (velocity) config.velocity = velocity;
    win.morph.to({ p: 0, ox: 0, oy: 0 }, config).then(finish);
  }

  function toggleZoom(win) {
    const id = win.app.id;
    const record = store.get(id);
    if (layout === 'phone') return;
    if (record.snap) {
      const restore = store.clearSnap(id) || defaultFrame(win);
      const target = fitFrame(restore, record.min, area);
      store.setFrame(id, target);
      win.frame.to(target, MotionSettings.spring('snap'));
    } else {
      const target = snapFrame('max', area);
      store.setSnap(id, 'max', target);
      win.frame.to(target, MotionSettings.spring('snap'));
    }
  }

  function toAreaPoint(event) {
    return { x: event.clientX - area.left, y: event.clientY - area.top };
  }

  function showPreview(zone, win) {
    if (zone === previewZone) return;
    previewZone = zone;
    if (!zone) {
      previewMotion.to({ o: 0 }, { response: 0.2, damping: 1 });
      return;
    }
    const target = snapFrame(zone, area, 0);
    const inset = 6;
    if (previewMotion.get('o') < 0.05) {
      const f = win.frame.values;
      previewMotion.set({ x: f.x, y: f.y, w: f.w, h: f.h });
    }
    previewMotion.to({ x: target.x + inset, y: target.y + inset, w: target.w - inset * 2, h: target.h - inset * 2, o: 1 });
  }

  function bindDrag(win) {
    const id = win.app.id;
    const tracker = createVelocityTracker();
    let pointerId = null;
    let dragging = false;
    let start = null;
    let grab = null;

    win.titlebar.addEventListener('dblclick', (event) => {
      if (event.target.closest('[data-wm-control]')) return;
      toggleZoom(win);
    });

    win.titlebar.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || layout === 'phone' || event.target.closest('[data-wm-control]')) return;
      pointerId = event.pointerId;
      dragging = false;
      start = toAreaPoint(event);
      const f = win.frame.values;
      grab = { x: start.x - f.x, y: start.y - f.y };
      tracker.reset();
      capture(win.titlebar, pointerId);
    });

    win.titlebar.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      const point = toAreaPoint(event);
      if (!dragging) {
        if (Math.hypot(point.x - start.x, point.y - start.y) < DRAG_THRESHOLD) return;
        dragging = true;
        win.el.classList.add('is-dragging');
        const record = store.get(id);
        if (record.snap) {
          const current = win.frame.values;
          const restore = store.clearSnap(id) || defaultFrame(win);
          const detached = detachFromSnap(point, grab.x, current, restore);
          grab.x = point.x - detached.x;
          store.setFrame(id, { w: detached.w, h: detached.h });
          win.frame.to({ w: detached.w, h: detached.h }, MotionSettings.spring('snap'));
        }
      }
      const size = { w: store.get(id).frame.w, h: store.get(id).frame.h };
      const raw = { x: point.x - grab.x, y: point.y - grab.y };
      const pos = rubberbandPosition(raw.x, raw.y, size, area);
      tracker.add(raw.x, raw.y);
      win.frame.set({ x: pos.x, y: pos.y });
      showPreview(snapZoneAt(point, area), win);
    });

    const end = (event) => {
      if (event.pointerId !== pointerId) return;
      try { win.titlebar.releasePointerCapture(pointerId); } catch (err) {}
      pointerId = null;
      if (!dragging) return;
      dragging = false;
      win.el.classList.remove('is-dragging');
      const zone = previewZone;
      showPreview(null, win);
      const velocity = MotionSettings.reduced ? { x: 0, y: 0 } : tracker.get();
      if (zone) {
        const target = snapFrame(zone, area);
        store.setSnap(id, zone, target);
        win.frame.to(target, { ...MotionSettings.spring('snap'), velocity: { x: velocity.x, y: velocity.y } });
        return;
      }
      const current = win.frame.values;
      const size = { w: store.get(id).frame.w, h: store.get(id).frame.h };
      const glide = MotionSettings.spring('drag').response;
      const target = clampPosition(current.x + glideDistance(velocity.x, glide), current.y + glideDistance(velocity.y, glide), size, area);
      store.setFrame(id, target);
      win.frame.to(target, { ...MotionSettings.spring('drag'), velocity: { x: velocity.x, y: velocity.y } });
    };
    win.titlebar.addEventListener('pointerup', end);
    win.titlebar.addEventListener('pointercancel', end);
  }

  function bindResize(win) {
    const id = win.app.id;
    win.el.querySelectorAll('[data-wm-edge]').forEach((handle) => {
      const edge = handle.dataset.wmEdge;
      let pointerId = null;
      let start = null;
      let origin = null;
      handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || layout === 'phone') return;
        event.stopPropagation();
        pointerId = event.pointerId;
        capture(handle, pointerId);
        if (store.get(id).snap) store.clearSnap(id);
        start = { ...win.frame.values };
        origin = toAreaPoint(event);
        win.el.classList.add('is-resizing');
        focusWindow(id);
      });
      handle.addEventListener('pointermove', (event) => {
        if (event.pointerId !== pointerId) return;
        const point = toAreaPoint(event);
        const next = resizeFrame(start, edge, point.x - origin.x, point.y - origin.y, store.get(id).min, area);
        store.setFrame(id, next);
        win.frame.set(next);
      });
      const end = (event) => {
        if (event.pointerId !== pointerId) return;
        try { handle.releasePointerCapture(pointerId); } catch (err) {}
        pointerId = null;
        win.el.classList.remove('is-resizing');
      };
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
  }

  function bindHomeGesture(win) {
    const id = win.app.id;
    const tracker = createVelocityTracker();
    let pointerId = null;
    let start = null;
    let moved = false;

    win.homebar.addEventListener('pointerdown', (event) => {
      if (layout !== 'phone') return;
      pointerId = event.pointerId;
      start = { x: event.clientX, y: event.clientY };
      moved = false;
      tracker.reset();
      capture(win.homebar, pointerId);
    });

    win.homebar.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointerId) return;
      const dy = start.y - event.clientY;
      const dx = event.clientX - start.x;
      if (!moved && Math.abs(dy) < DRAG_THRESHOLD) return;
      moved = true;
      tracker.add(event.clientX, event.clientY);
      const f = win.frame.values;
      const icon = iconInArea(win);
      const t = clamp(dy / (area.h * 0.7), 0, 1);
      const cardScale = lerp(1, 0.42, t);
      const startScale = icon.size / Math.min(f.w, f.h);
      const p = clamp(1 - Math.log(cardScale) / Math.log(startScale), 0, 1);
      const center = { x: f.x + f.w / 2 + dx * 0.9, y: f.y + f.h / 2 - dy * 0.62 };
      const base = morphState(p, icon, { x: f.x, y: f.y, w: f.w, h: f.h }, { icon: 0, window: 0 });
      const baseCenter = { x: base.tx + (f.w / 2) * base.scale, y: base.ty + (f.h / 2) * base.scale };
      win.morph.set({ p, ox: center.x - baseCenter.x, oy: center.y - baseCenter.y });
    });

    const end = (event) => {
      if (event.pointerId !== pointerId) return;
      try { win.homebar.releasePointerCapture(pointerId); } catch (err) {}
      pointerId = null;
      const velocity = tracker.get();
      const p = win.morph.get('p');
      const commit = !moved || p < 0.8 || velocity.y < -500;
      if (commit) sendToDock(win, 'minimize');
      else win.morph.to({ p: 1, ox: 0, oy: 0 }, MotionSettings.spring('open'));
    };
    win.homebar.addEventListener('pointerup', end);
    win.homebar.addEventListener('pointercancel', end);
  }

  function focusWindow(id) {
    const record = store.get(id);
    if (record.state !== 'open' || store.focusedId === id) return;
    store.focus(id);
    pulseFocus(windows.get(id));
  }

  function bindWindow(win) {
    const id = win.app.id;
    win.el.addEventListener('pointerdown', () => focusWindow(id), true);
    win.el.querySelectorAll('[data-wm-control]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const action = button.dataset.wmControl;
        if (action === 'close') sendToDock(win, 'close');
        else if (action === 'minimize') sendToDock(win, 'minimize');
        else toggleZoom(win);
      });
    });
    bindDrag(win);
    bindResize(win);
    bindHomeGesture(win);
  }

  function applyLayout() {
    const next = window.innerWidth < PHONE_BREAKPOINT ? 'phone' : 'desktop';
    const changed = next !== layout;
    layout = next;
    root.classList.toggle('wm--phone', layout === 'phone');
    dock.setLayout(layout);
    measureArea();
    dock.measure();
    const openRecords = store.all().filter((r) => r.state === 'open');
    if (layout === 'phone') {
      const keep = store.focusedId;
      openRecords.forEach((r) => {
        const win = windows.get(r.id);
        if (r.id !== keep) {
          store.minimize(r.id);
          hide(win);
          return;
        }
        const full = { x: 0, y: 0, w: area.w, h: area.h };
        if (r.snap) store.clearSnap(r.id);
        store.setFrame(r.id, full);
        win.frame.set(full);
      });
      return;
    }
    openRecords.forEach((r) => {
      const win = windows.get(r.id);
      const target = r.snap ? snapFrame(r.snap, area) : fitFrame(changed ? defaultFrameFrom(r) : r.frame, r.min, area);
      if (r.snap) store.setSnap(r.id, r.snap, target);
      else store.setFrame(r.id, target);
      if (changed) win.frame.set(target);
      else win.frame.to(target, MotionSettings.spring('snap'));
    });
  }

  function defaultFrameFrom(record) {
    const app = windows.get(record.id).app;
    return { x: (area.w - app.frame.w) / 2, y: Math.max(0, (area.h - app.frame.h) / 2 - 40), w: app.frame.w, h: app.frame.h };
  }

  apps.forEach((app) => {
    const win = buildWindow({ ...app, frame: { x: null, y: null, w: app.frame.w, h: app.frame.h } });
    win.el.style.display = 'none';
  });

  store.subscribe(applyOrder);
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    measureArea();
    dock.measure();
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(applyLayout, 80);
  });
  applyLayout();

  return {
    open,
    close(id) { sendToDock(windows.get(id), 'close'); },
    minimize(id) { sendToDock(windows.get(id), 'minimize'); },
    toggleZoom(id) { toggleZoom(windows.get(id)); },
    focus: focusWindow,
    get layout() { return layout; },
    get area() { return { ...area }; },
    windowMotion(id) {
      const win = windows.get(id);
      return { morph: win.morph, frame: win.frame, pulse: win.pulse, el: win.el };
    },
    relayout: applyLayout,
  };
}
