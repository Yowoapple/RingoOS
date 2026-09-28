import { Storage } from '../core/storage/storage.js';

export let Dock = null;

const AUTOHIDE_KEY = 'yoworingo.dock-autohide';

const MAGNIFY_RANGE = 140;
const MAGNIFY_MAX_SCALE = 1.6;
const COLLAPSE_DURATION = 380;
const EXPAND_DURATION = 460;

const ICON_DEFS = {
  'daily-entry': {
    gradient: ['#6d9dff', '#3d7bfa'],
    glyph: '<path d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M14 4v4h4"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="15.5" x2="13" y2="15.5"/>',
  },
  'life-reminder': {
    gradient: ['#ffb15c', '#f0913f'],
    glyph: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-7z"/>',
  },
  overview: {
    gradient: ['#3fce8f', '#1f9d63'],
    glyph: '<line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="7"/><line x1="18" y1="20" x2="18" y2="14"/>',
  },
  weather: {
    gradient: ['#5ec8f0', '#2f9fd9'],
    glyph: '<path d="M17.5 18a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6-1.6A4.5 4.5 0 0 0 7.5 18h10z"/>',
  },
  calculator: {
    gradient: ['#9a8dfb', '#6f5cf0'],
    glyph: '<rect x="6" y="3.5" width="12" height="17" rx="2"/><line x1="8.5" y1="7" x2="15.5" y2="7"/><line x1="8.5" y1="11" x2="8.5" y2="11"/><line x1="12" y1="11" x2="12" y2="11"/><line x1="15.5" y1="11" x2="15.5" y2="11"/><line x1="8.5" y1="14.2" x2="8.5" y2="14.2"/><line x1="12" y1="14.2" x2="12" y2="14.2"/><line x1="15.5" y1="14.2" x2="15.5" y2="14.2"/><line x1="8.5" y1="17.4" x2="8.5" y2="17.4"/><line x1="12" y1="17.4" x2="12" y2="17.4"/><line x1="15.5" y1="17.4" x2="15.5" y2="17.4"/>',
  },
  calendar: {
    gradient: ['#ff9a6c', '#f0682f'],
    glyph: '<rect x="4.5" y="5" width="15" height="14.5" rx="2.5"/><line x1="4.5" y1="9.3" x2="19.5" y2="9.3"/><line x1="8" y1="3.2" x2="8" y2="6.5"/><line x1="16" y1="3.2" x2="16" y2="6.5"/><line x1="8.3" y1="13" x2="8.3" y2="13"/><line x1="12" y1="13" x2="12" y2="13"/><line x1="15.7" y1="13" x2="15.7" y2="13"/><line x1="8.3" y1="16.3" x2="8.3" y2="16.3"/><line x1="12" y1="16.3" x2="12" y2="16.3"/>',
  },
  radio: {
    gradient: ['#ff8fb3', '#f0518f'],
    glyph: '<circle cx="12" cy="14" r="6.5"/><circle cx="12" cy="14" r="1.2" fill="white" stroke="none"/><path d="M8.5 4.5 12 7.5l3.5-3"/>',
  },
  settings: {
    gradient: ['#b9bec7', '#868d99'],
    glyph: '<circle cx="12" cy="12" r="6.4"/><circle cx="12" cy="12" r="2.1"/><line x1="12" y1="5.4" x2="12" y2="3.2" stroke-width="2.3"/><line x1="15.88" y1="6.66" x2="17.17" y2="4.88" stroke-width="2.3"/><line x1="18.28" y1="9.96" x2="20.37" y2="9.28" stroke-width="2.3"/><line x1="18.28" y1="14.04" x2="20.37" y2="14.72" stroke-width="2.3"/><line x1="15.88" y1="17.34" x2="17.17" y2="19.12" stroke-width="2.3"/><line x1="12" y1="18.6" x2="12" y2="20.8" stroke-width="2.3"/><line x1="8.12" y1="17.34" x2="6.83" y2="19.12" stroke-width="2.3"/><line x1="5.72" y1="14.04" x2="3.63" y2="14.72" stroke-width="2.3"/><line x1="5.72" y1="9.96" x2="3.63" y2="9.28" stroke-width="2.3"/><line x1="8.12" y1="6.66" x2="6.83" y2="4.88" stroke-width="2.3"/>',
  },
};

function buildIconSvg(iconKey) {
  const def = ICON_DEFS[iconKey];
  if (!def) return '';
  const gradId = `dock-grad-${iconKey}-${Math.random().toString(36).slice(2, 7)}`;
  return `
    <svg viewBox="0 0 24 24" width="100%" height="100%">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${def.gradient[0]}"/>
          <stop offset="100%" stop-color="${def.gradient[1]}"/>
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="7" fill="url(#${gradId})"/>
      <g fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.95">
        ${def.glyph}
      </g>
    </svg>`;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutBack(t) {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function isAutoHideEnabled() {
  try { return Storage.get(AUTOHIDE_KEY, null) === 'true'; } catch (err) { return false; }
}
function setAutoHide(enabled) {
  try { Storage.set(AUTOHIDE_KEY, enabled ? 'true' : 'false'); } catch (err) {}
  window.dispatchEvent(new CustomEvent('yoworingo:dock-autohide-change'));
}

function getRestingIconRect(iconEl) {
  const prevTransform = iconEl.style.transform;
  iconEl.style.transform = 'scale(1)';
  const rect = iconEl.getBoundingClientRect();
  iconEl.style.transform = prevTransform;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function createMorphController(windowEl, contentEl, overlayEl) {
  let progress = 1;
  let rafId = null;
  let animStartTime = null;
  let animStartProgress = progress;
  let direction = null;
  let iconEl = null;
  let fullRect = null;
  let duration = 400;
  let onComplete = null;

  function applyFrame(p) {
    const iconRect = getRestingIconRect(iconEl);
    const left = lerp(iconRect.left, fullRect.left, p);
    const top = lerp(iconRect.top, fullRect.top, p);
    const width = lerp(iconRect.width, fullRect.width, p);
    const height = lerp(iconRect.height, fullRect.height, p);

    windowEl.style.left = `${left}px`;
    windowEl.style.top = `${top}px`;
    windowEl.style.width = `${width}px`;
    windowEl.style.height = `${height}px`;

    const contentOpacity = clamp01((p - 0.5) / 0.5);
    const overlayOpacity = clamp01((0.5 - p) / 0.5);
    contentEl.style.opacity = String(contentOpacity);
    overlayEl.style.opacity = String(overlayOpacity);
  }

  function tick(now) {
    if (animStartTime === null) animStartTime = now;
    const elapsed = now - animStartTime;
    const t = Math.min(1, elapsed / duration);
    const easedT = direction === 'expand' ? easeOutBack(t) : easeInOutCubic(t);
    const target = direction === 'expand' ? 1 : 0;

    progress = animStartProgress + (target - animStartProgress) * easedT;
    applyFrame(progress);

    if (t < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      progress = target;
      applyFrame(progress);
      rafId = null;
      animStartTime = null;
      const cb = onComplete;
      onComplete = null;
      if (cb) cb();
    }
  }

  function play(dir, rects, dur, completeCb) {
    direction = dir;
    iconEl = rects.iconEl;
    fullRect = rects.fullRect;
    duration = dur;
    onComplete = completeCb;
    animStartProgress = progress;
    animStartTime = null;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  function isAnimating() {
    return rafId !== null;
  }

  function getProgress() {
    return progress;
  }

  function setProgress(p, rects) {
    progress = p;
    if (rects) {
      iconEl = rects.iconEl;
      fullRect = rects.fullRect;
      applyFrame(p);
    }
  }

  return { play, isAnimating, getProgress, setProgress };
}

function initDock() {
  const dock = document.getElementById('dock');
  const tooltip = document.getElementById('dock-tooltip');
  const desktop = document.querySelector('.desktop');
  const windowFlow = document.querySelector('.window-flow');
  if (!dock || !tooltip || !desktop || !windowFlow) return;

  const minimizedWindows = new Map();
  const badgeCounts = {};

  function applyBadgeToEl(badgeEl, count) {
    if (!badgeEl) return;
    if (count > 0) {
      badgeEl.hidden = false;
      badgeEl.textContent = count > 99 ? '99+' : String(count);
    } else {
      badgeEl.hidden = true;
    }
  }

  function setBadge(windowId, count) {
    badgeCounts[windowId] = count;
    const entry = minimizedWindows.get(windowId);
    if (entry) applyBadgeToEl(entry.badgeEl, count);
  }

  function updateMagnification(mouseX) {
    const icons = dock.querySelectorAll('.dock__icon');
    icons.forEach((iconEl) => {
      const rect = iconEl.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const distance = Math.abs(mouseX - center);

      let scale = 1;
      if (mouseX !== null && distance < MAGNIFY_RANGE) {
        const t = distance / MAGNIFY_RANGE;
        const falloff = (Math.cos(t * Math.PI) + 1) / 2;
        scale = 1 + falloff * (MAGNIFY_MAX_SCALE - 1);
      }
      iconEl.style.transform = `scale(${scale})`;
    });
  }

  dock.addEventListener('pointermove', (event) => {
    window.requestAnimationFrame(() => updateMagnification(event.clientX));
  });
  dock.addEventListener('pointerleave', () => {
    window.requestAnimationFrame(() => updateMagnification(null));
  });

  function showTooltip(iconEl, label) {
    const rect = iconEl.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    tooltip.textContent = label;
    tooltip.style.display = 'block';
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.top = `${dockRect.top - dockRect.height * 0.75 - tooltip.offsetHeight}px`;
  }
  function hideTooltip() {
    tooltip.style.display = 'none';
  }

  function rectFrom(domRect) {
    return { left: domRect.left, top: domRect.top, width: domRect.width, height: domRect.height };
  }

  function minimizeWindow(windowEl) {
    const windowId = windowEl.dataset.windowId;
    const iconKey = windowEl.dataset.windowIcon;
    if (!windowId || minimizedWindows.has(windowId)) return;

    const contentEl = windowEl.querySelector('.window__content');
    const overlayEl = windowEl.querySelector('[data-window-icon-overlay]');
    overlayEl.innerHTML = buildIconSvg(iconKey);

    const fullRect = rectFrom(windowEl.getBoundingClientRect());

    const iconWrap = document.createElement('div');
    iconWrap.className = 'dock__icon-wrap';
    iconWrap.innerHTML = `
      <button type="button" class="dock__icon" data-window-id="${windowId}">${buildIconSvg(iconKey)}<span class="dock__badge" data-dock-badge hidden>0</span></button>
      <span class="dock__light"></span>
    `;
    dock.appendChild(iconWrap);
    const iconEl = iconWrap.querySelector('.dock__icon');
    const badgeEl = iconWrap.querySelector('[data-dock-badge]');
    applyBadgeToEl(badgeEl, badgeCounts[windowId] || 0);

    windowEl.style.position = 'fixed';
    windowEl.style.left = `${fullRect.left}px`;
    windowEl.style.top = `${fullRect.top}px`;
    windowEl.style.width = `${fullRect.width}px`;
    windowEl.style.height = `${fullRect.height}px`;
    windowEl.style.minWidth = '0px';

    windowEl.dataset.dockAnimating = 'true';

    const controller = createMorphController(windowEl, contentEl, overlayEl);
    controller.setProgress(1);

    minimizedWindows.set(windowId, { windowEl, iconEl, badgeEl, contentEl, overlayEl, controller, fullRect });

    controller.play('collapse', { iconEl, fullRect }, COLLAPSE_DURATION, () => {
      windowEl.style.display = 'none';
      delete windowEl.dataset.dockAnimating;
      window.dispatchEvent(new CustomEvent('yoworingo:layout-changed'));
    });

    iconEl.addEventListener('pointerenter', () => showTooltip(iconEl, windowEl.querySelector('.window__title').textContent));
    iconEl.addEventListener('pointerleave', hideTooltip);
    iconEl.addEventListener('click', () => restoreWindow(windowId));
  }

  function restoreWindow(windowId) {
    const entry = minimizedWindows.get(windowId);
    if (!entry) return;
    const { windowEl, iconEl, contentEl, overlayEl, controller, fullRect } = entry;

    hideTooltip();
    windowEl.style.display = '';
    windowEl.dataset.dockAnimating = 'true';

    controller.play('expand', { iconEl, fullRect }, EXPAND_DURATION, () => {
      const flowRect = windowFlow.getBoundingClientRect();
      windowEl.style.position = 'absolute';
      windowEl.style.left = `${fullRect.left - flowRect.left}px`;
      windowEl.style.top = `${fullRect.top - flowRect.top}px`;
      windowEl.style.width = `${fullRect.width}px`;
      windowEl.style.height = '';
      windowEl.style.minWidth = '';

      contentEl.style.opacity = '';
      overlayEl.style.opacity = '';

      windowEl.dataset.userPositioned = 'true';
      delete windowEl.dataset.dockAnimating;
      window.dispatchEvent(new CustomEvent('yoworingo:layout-changed'));

      iconEl.closest('.dock__icon-wrap').remove();
      minimizedWindows.delete(windowId);
    });
  }

  function minimizeInstant(windowEl) {
    const windowId = windowEl.dataset.windowId;
    const iconKey = windowEl.dataset.windowIcon;
    if (!windowId || minimizedWindows.has(windowId)) return;

    const contentEl = windowEl.querySelector('.window__content');
    const overlayEl = windowEl.querySelector('[data-window-icon-overlay]');
    overlayEl.innerHTML = buildIconSvg(iconKey);

    const fullRect = rectFrom(windowEl.getBoundingClientRect());

    const iconWrap = document.createElement('div');
    iconWrap.className = 'dock__icon-wrap';
    iconWrap.innerHTML = `
      <button type="button" class="dock__icon" data-window-id="${windowId}">${buildIconSvg(iconKey)}<span class="dock__badge" data-dock-badge hidden>0</span></button>
      <span class="dock__light"></span>
    `;
    dock.appendChild(iconWrap);
    const iconEl = iconWrap.querySelector('.dock__icon');
    const badgeEl = iconWrap.querySelector('[data-dock-badge]');
    applyBadgeToEl(badgeEl, badgeCounts[windowId] || 0);

    const controller = createMorphController(windowEl, contentEl, overlayEl);
    controller.setProgress(0);
    contentEl.style.opacity = '0';
    overlayEl.style.opacity = '1';
    windowEl.style.display = 'none';

    minimizedWindows.set(windowId, { windowEl, iconEl, badgeEl, contentEl, overlayEl, controller, fullRect });

    iconEl.addEventListener('pointerenter', () => showTooltip(iconEl, windowEl.querySelector('.window__title').textContent));
    iconEl.addEventListener('pointerleave', hideTooltip);
    iconEl.addEventListener('click', () => restoreWindow(windowId));
  }

  document.querySelectorAll('[data-dot-action="minimize"]').forEach((dot) => {
    dot.addEventListener('click', (event) => {
      const windowEl = event.target.closest('.window');
      if (windowEl) minimizeWindow(windowEl);
    });
  });

  function closeWindow(windowId) {
    const entry = minimizedWindows.get(windowId);
    if (entry) {
      hideTooltip();
      entry.iconEl.closest('.dock__icon-wrap').remove();
      minimizedWindows.delete(windowId);
    }
    const windowEl = entry ? entry.windowEl : document.querySelector(`.window[data-window-id="${windowId}"]`);
    if (windowEl) windowEl.style.display = 'none';
    window.dispatchEvent(new CustomEvent('yoworingo:layout-changed'));
  }

  document.querySelectorAll('[data-dot-action="close"]').forEach((dot) => {
    dot.addEventListener('click', (event) => {
      const windowEl = event.target.closest('.window');
      if (windowEl && windowEl.dataset.windowId) closeWindow(windowEl.dataset.windowId);
    });
  });

  function isDocked(windowId) {
    return minimizedWindows.has(windowId);
  }

  function syncAutoHide() {
    dock.classList.toggle('dock--autohide', isAutoHideEnabled());
  }
  window.addEventListener('yoworingo:dock-autohide-change', syncAutoHide);
  syncAutoHide();

  window.addEventListener('pointermove', (event) => {
    if (!dock.classList.contains('dock--autohide')) return;
    const nearBottomEdge = window.innerHeight - event.clientY < 6;
    dock.classList.toggle('is-peeking', nearBottomEdge);
  });

  Dock = { isAutoHideEnabled, setAutoHide, minimizeInstant, restoreWindow, isDocked, closeWindow, setBadge };
}

export function boot() {
  try {
    initDock();
  } catch (err) {
    console.error('Life Ledger：Dock 初始化失敗（不影響其他功能）', err);
  }
}
