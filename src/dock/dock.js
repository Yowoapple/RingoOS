import { createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';

const LAYOUTS = {
  desktop: { size: 54, gap: 10, pad: 10, magnify: 1.55, range: 170, divider: 12 },
  phone: { size: 58, gap: 22, pad: 14, magnify: 1, range: 0, columns: 4, rowGap: 18 },
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

  const layouts = { desktop: { ...LAYOUTS.desktop }, phone: { ...LAYOUTS.phone } };
  let layout = layouts.desktop;
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
    const bg = root.querySelector('.dock__bg');
    const tall = bg ? bg.offsetHeight : 0;
    return Math.max(layout.size + layout.pad * 2, tall) + 24;
  }

  function hideOffset() {
    return hideMotion.get('h') * hideDistance();
  }

  let suppressed = false;

  function updateHidden() {
    const shown = !suppressed && (!autoHide || hovering || edgePeek || performance.now() < holdUntil);
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
    let divider = null;
    if (app.divider) {
      divider = document.createElement('span');
      divider.className = 'dock__divider';
      divider.setAttribute('aria-hidden', 'true');
      itemsEl.appendChild(divider);
    }
    itemsEl.appendChild(button);
    initial[`${app.id}.p`] = 1;
    initial[`${app.id}.m`] = 1;
    initial[`${app.id}.y`] = 0;
    initial[`${app.id}.s`] = 1;
    return { app, button, divider, dot: button.querySelector('.dock__dot'), badge: button.querySelector('.dock__badge') };
  });

  const motion = createMotion(initial, { response: 0.25, damping: 0.9, restDelta: 0.0005 });

  function presenceTarget(id) {
    if (mode === 'launcher') return 1;
    const record = store.get(id);
    return record && record.state === 'open' ? 0 : 1;
  }

  function computeGrid(values) {
    const { size, gap, pad, columns, rowGap } = layout;
    const present = items.filter((item) => values[`${item.app.id}.p`] > 0.01);
    const rows = Math.max(1, Math.ceil(present.length / columns));
    const cols = Math.min(columns, Math.max(1, present.length));
    const slots = items.map((item) => {
      const index = present.indexOf(item);
      const p = Math.max(0, values[`${item.app.id}.p`]);
      if (index < 0) return { item, p, m: 1, cx: 0, cy: 0 };
      const col = index % columns;
      const row = Math.floor(index / columns);
      return {
        item,
        p,
        m: 1,
        cx: (col - (cols - 1) / 2) * (size + gap),
        cy: -(rows - 1 - row) * (size + rowGap),
      };
    });
    return {
      slots,
      width: cols * size + (cols - 1) * gap + pad * 2,
      height: rows * size + (rows - 1) * rowGap + pad * 2,
    };
  }

  function computeSlots(values, magnified = true) {
    if (layout.columns) return computeGrid(values);
    const { size, gap, pad } = layout;
    const dividerSpace = layout.divider || 0;
    let seen = 0;
    const slots = items.map((item) => {
      const id = item.app.id;
      const p = Math.max(0, values[`${id}.p`]);
      const m = magnified ? values[`${id}.m`] : 1;
      const lead = item.divider && seen > 0.01 ? dividerSpace * p * Math.min(1, seen) : 0;
      seen += p;
      return { item, p, m, lead, span: (size * m + gap) * p + lead };
    });
    const visibleSpan = slots.reduce((sum, slot) => sum + slot.span, 0);
    const totalP = slots.reduce((sum, slot) => sum + slot.p, 0);
    const inner = Math.max(0, visibleSpan - gap * Math.min(1, totalP));
    const width = inner + pad * 2;
    let cursor = -inner / 2;
    slots.forEach((slot) => {
      slot.dx = cursor + (slot.lead - gap) / 2;
      slot.cx = cursor + slot.lead + (size * slot.m * slot.p) / 2;
      slot.cy = 0;
      cursor += slot.span;
    });
    return { slots, width, height: size + pad * 2 };
  }

  function render(values) {
    const { size, pad } = layout;
    const { slots, width, height } = computeSlots(values);
    bg.style.width = `${width}px`;
    bg.style.height = `${height}px`;
    bg.style.opacity = width > pad * 2 + 1 ? '1' : '0';
    slots.forEach(({ item, p, m, cx, cy, lead, dx }) => {
      const id = item.app.id;
      if (item.divider) {
        const shown = lead > 0.5 ? Math.min(1, lead / (layout.divider || 1)) : 0;
        item.divider.style.transform = `translate3d(${dx || 0}px, 0, 0) scaleY(${shown})`;
        item.divider.style.opacity = String(shown);
      }
      const y = values[`${id}.y`] + cy;
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
      if (layout === layouts.phone) return;
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
    const cy = slot ? slot.cy : 0;
    return {
      x: anchor.x + cx - size / 2,
      y: anchor.y + hideOffset() + cy + values[`${id}.y`] - size,
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
      layout = layouts[name] || layouts.desktop;
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
    get magnify() { return layouts.desktop.magnify; },
    setMagnify(value) {
      layouts.desktop.magnify = Math.min(2.2, Math.max(1, value));
      magnifyTargets();
    },
    get autoHide() { return autoHide; },
    setAutoHide(value) {
      autoHide = !!value;
      root.classList.toggle('dock--autohide', autoHide);
      updateHidden();
    },
    setSuppressed(on) {
      if (suppressed === !!on) return;
      suppressed = !!on;
      root.classList.toggle('is-suppressed', suppressed);
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
