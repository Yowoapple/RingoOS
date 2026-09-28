import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';

const LAYOUTS = {
  desktop: { size: 54, gap: 10, pad: 10, magnify: 1.55, range: 170 },
  phone: { size: 58, gap: 20, pad: 14, magnify: 1, range: 0 },
};

export function createDock({ root, apps, store, renderIcon, onActivate }) {
  const bg = document.createElement('div');
  bg.className = 'dock__bg';
  const itemsEl = document.createElement('div');
  itemsEl.className = 'dock__items';
  const label = document.createElement('div');
  label.className = 'dock__label';
  label.setAttribute('aria-hidden', 'true');
  root.append(bg, itemsEl, label);

  let layout = LAYOUTS.desktop;
  let mode = 'launcher';
  let pointerX = null;
  let anchor = { x: 0, y: 0 };
  let autoHide = false;
  let hovering = false;
  let edgePeek = false;
  let holdUntil = 0;
  let holdTimer = null;
  const hideMotion = createMotion({ h: 0 }, { response: 0.32, damping: 1, restDelta: 0.001 });

  function hideDistance() {
    return layout.size + layout.pad * 2 + 24;
  }

  function hideOffset() {
    return hideMotion.get('h') * hideDistance();
  }

  function updateHidden() {
    const shown = !autoHide || hovering || edgePeek || performance.now() < holdUntil;
    hideMotion.to({ h: shown ? 0 : 1 }, shown ? { response: 0.28, damping: 0.9 } : { response: 0.36, damping: 1 });
  }

  hideMotion.onUpdate(({ h }) => {
    root.style.transform = h > 0.0005 ? `translate3d(0, ${h * hideDistance()}px, 0)` : '';
  });

  window.addEventListener('pointermove', (event) => {
    if (!autoHide) return;
    const nearEdge = window.innerHeight - event.clientY < 6;
    const inDockZone = window.innerHeight - event.clientY < layout.size + layout.pad * 2 + 30;
    const next = nearEdge || (edgePeek && inDockZone);
    if (next !== edgePeek) {
      edgePeek = next;
      updateHidden();
    }
  });
  const badges = new Map();
  const initial = {};
  const items = apps.map((app) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dock__item';
    button.dataset.appId = app.id;
    button.setAttribute('aria-label', app.title);
    button.innerHTML = `<span class="dock__icon">${renderIcon(app)}</span><span class="dock__badge" hidden></span><span class="dock__dot"></span>`;
    itemsEl.appendChild(button);
    initial[`${app.id}.p`] = 1;
    initial[`${app.id}.m`] = 1;
    initial[`${app.id}.y`] = 0;
    initial[`${app.id}.s`] = 1;
    return { app, button, dot: button.querySelector('.dock__dot'), badge: button.querySelector('.dock__badge') };
  });

  const motion = createMotion(initial, { response: 0.25, damping: 0.9, restDelta: 0.0005 });

  function presenceTarget(id) {
    if (mode === 'launcher') return 1;
    const record = store.get(id);
    return record && record.state === 'open' ? 0 : 1;
  }

  function computeSlots(values, magnified = true) {
    const { size, gap, pad } = layout;
    const slots = items.map((item) => {
      const id = item.app.id;
      const p = Math.max(0, values[`${id}.p`]);
      const m = magnified ? values[`${id}.m`] : 1;
      return { item, p, m, span: (size * m + gap) * p };
    });
    const visibleSpan = slots.reduce((sum, slot) => sum + slot.span, 0);
    const totalP = slots.reduce((sum, slot) => sum + slot.p, 0);
    const inner = Math.max(0, visibleSpan - gap * Math.min(1, totalP));
    const width = inner + pad * 2;
    let cursor = -inner / 2;
    slots.forEach((slot) => {
      slot.cx = cursor + (size * slot.m * slot.p) / 2;
      cursor += slot.span;
    });
    return { slots, width };
  }

  function render(values) {
    const { size, pad } = layout;
    const { slots, width } = computeSlots(values);
    bg.style.width = `${width}px`;
    bg.style.opacity = width > pad * 2 + 1 ? '1' : '0';
    slots.forEach(({ item, p, m, cx }) => {
      const id = item.app.id;
      const y = values[`${id}.y`];
      const s = values[`${id}.s`];
      item.button.style.transform = `translate3d(${cx - size / 2}px, ${y}px, 0) scale(${Math.max(0, m * p * s)})`;
      item.button.style.opacity = String(Math.min(1, Math.max(0, p)));
      item.button.style.pointerEvents = p > 0.5 ? '' : 'none';
    });
  }

  motion.onUpdate(render);

  function measure() {
    const rect = root.getBoundingClientRect();
    anchor = { x: rect.left, y: rect.bottom - layout.pad - hideOffset() };
  }

  function magnifyTargets() {
    const targets = {};
    const rest = computeSlots(motion.values, false);
    rest.slots.forEach(({ item, cx }) => {
      let m = 1;
      if (pointerX !== null && layout.range > 0) {
        const distance = Math.abs(pointerX - (anchor.x + cx));
        if (distance < layout.range) {
          const falloff = (Math.cos((distance / layout.range) * Math.PI) + 1) / 2;
          m = 1 + falloff * (layout.magnify - 1);
        }
      }
      targets[`${item.app.id}.m`] = m;
    });
    motion.to(targets, MotionSettings.spring('dock'));
  }

  function syncState() {
    const targets = {};
    items.forEach(({ app, dot }) => {
      targets[`${app.id}.p`] = presenceTarget(app.id);
      dot.classList.toggle('is-on', mode === 'launcher' ? store.isRunning(app.id) : store.get(app.id)?.state === 'minimized');
    });
    motion.to(targets, MotionSettings.spring('dock'));
  }

  root.addEventListener('pointermove', (event) => {
    if (!hovering) {
      hovering = true;
      updateHidden();
    }
    if (event.pointerType === 'touch') return;
    pointerX = event.clientX;
    magnifyTargets();
  });
  root.addEventListener('pointerleave', () => {
    hovering = false;
    updateHidden();
    pointerX = null;
    magnifyTargets();
    label.classList.remove('is-visible');
  });

  items.forEach(({ app, button }) => {
    button.addEventListener('pointerdown', () => motion.to({ [`${app.id}.s`]: 0.86 }, { response: 0.18, damping: 1 }));
    const release = () => motion.to({ [`${app.id}.s`]: 1 }, { response: 0.3, damping: 0.6 });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('click', () => onActivate(app.id));
    button.addEventListener('pointerenter', () => {
      if (layout === LAYOUTS.phone) return;
      label.textContent = app.title;
      const rect = getIconRect(app.id);
      const rootTop = anchor.y - layout.size - layout.pad;
      label.style.transform = `translate3d(${rect.x + rect.size / 2 - anchor.x}px, ${rect.y - rootTop - 10}px, 0) translate(-50%, -100%)`;
      label.classList.add('is-visible');
    });
    button.addEventListener('pointerleave', () => label.classList.remove('is-visible'));
  });

  function getIconRect(id) {
    const values = motion.values;
    const { slots } = computeSlots(values);
    const slot = slots.find((entry) => entry.item.app.id === id);
    const scale = slot ? slot.m * values[`${id}.s`] : 1;
    const size = layout.size * scale;
    const cx = slot ? slot.cx : 0;
    return {
      x: anchor.x + cx - size / 2,
      y: anchor.y + hideOffset() + values[`${id}.y`] - size,
      size,
    };
  }

  const STATE_EVENTS = new Set(['open', 'close', 'minimize', 'restore']);
  store.subscribe(({ type }) => {
    if (STATE_EVENTS.has(type)) syncState();
  });

  const api = {
    get mode() { return mode; },
    getIconRect,
    measure,
    setMode(next) {
      mode = next === 'minimized' ? 'minimized' : 'launcher';
      root.dataset.mode = mode;
      syncState();
    },
    setLayout(name) {
      layout = LAYOUTS[name] || LAYOUTS.desktop;
      root.dataset.layout = name;
      root.style.setProperty('--dock-size', `${layout.size}px`);
      root.style.setProperty('--dock-pad', `${layout.pad}px`);
      pointerX = null;
      measure();
      magnifyTargets();
      render(motion.values);
    },
    bounce(id) {
      if (MotionSettings.reduced) return;
      motion.to({ [`${id}.y`]: 0 }, { response: 0.42, damping: 0.32, velocity: { [`${id}.y`]: -560 } });
    },
    setBadge(id, count) {
      badges.set(id, count);
      const item = items.find((entry) => entry.app.id === id);
      if (!item) return;
      item.badge.hidden = !(count > 0);
      item.badge.textContent = count > 99 ? '99+' : String(count);
    },
    reveal(id) {
      if (mode === 'minimized') motion.to({ [`${id}.p`]: 1 }, MotionSettings.spring('dock'));
    },
    get autoHide() { return autoHide; },
    setAutoHide(value) {
      autoHide = !!value;
      root.classList.toggle('dock--autohide', autoHide);
      updateHidden();
    },
    peek(ms = 900) {
      if (!autoHide) return;
      holdUntil = Math.max(holdUntil, performance.now() + ms);
      updateHidden();
      window.clearTimeout(holdTimer);
      holdTimer = window.setTimeout(updateHidden, holdUntil - performance.now() + 20);
    },
  };

  api.setLayout('desktop');
  api.setMode('launcher');
  return api;
}
