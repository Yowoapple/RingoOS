import { Storage } from '../core/storage/storage.js';
import { MotionSettings } from '../motion/presets.js';
import { createWindowStore } from '../wm/store.js';
import { createWindowManager } from '../wm/window-manager.js';
import { sanitizeSession, serializeSession } from '../wm/session.js';
import { createDock } from '../dock/dock.js';
import { renderAppIcon } from './app-icons.js';
import { APPS, scaledApps } from './apps.js';

const SESSION_KEY = 'yoworingo.windows';
const MOTION_STYLE_KEY = 'yoworingo.motion-style';
const REDUCED_MOTION_KEY = 'yoworingo.reduced-motion';
const DOCK_MODE_KEY = 'yoworingo.dock-mode';
const DOCK_AUTOHIDE_KEY = 'yoworingo.dock-autohide';
const DEFAULT_MOTION_STYLE = 'hyperos';
const SAVE_DELAY = 300;

let store = null;
let dock = null;
let wm = null;
let saveTimer = null;
const pendingBadges = new Map();
const reducedQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

function scaleFactor() {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale-factor'));
  return Number.isFinite(value) ? value : 1.3;
}

function collectContent(id) {
  const source = document.querySelector(`.app-source[data-app-id="${id}"]`);
  if (!source) return { titlebar: [], body: [] };
  const titlebar = source.querySelector(':scope > .app-source__titlebar');
  const body = Array.from(source.children).filter((node) => node !== titlebar);
  return {
    titlebar: titlebar ? Array.from(titlebar.children) : [],
    body,
    bodyClass: body.some((node) => node.classList.contains('settings-panel__body')) ? 'wm-window__body--fill' : null,
  };
}

function reducedPreference() {
  const stored = Storage.get(REDUCED_MOTION_KEY, 'system');
  return ['system', 'on', 'off'].includes(stored) ? stored : 'system';
}

function applyReducedPreference() {
  const preference = reducedPreference();
  const reduced = preference === 'on' || (preference === 'system' && !!reducedQuery && reducedQuery.matches);
  MotionSettings.setReduced(reduced);
}

function saveSession() {
  window.clearTimeout(saveTimer);
  saveTimer = null;
  if (store) Storage.set(SESSION_KEY, serializeSession(store));
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveSession, SAVE_DELAY);
}

function applyAutoHide(enabled) {
  const desktop = document.getElementById('desktop');
  if (desktop) desktop.classList.toggle('is-dock-autohide', enabled);
  if (dock) dock.setAutoHide(enabled);
  if (wm) wm.relayout();
}

function boot() {
  const desktop = document.getElementById('desktop');
  const areaEl = document.getElementById('wm-area');
  const dockEl = document.getElementById('dock');
  if (!desktop || !areaEl || !dockEl) return;

  const style = Storage.get(MOTION_STYLE_KEY, DEFAULT_MOTION_STYLE);
  MotionSettings.usePreset(style === 'ios' ? 'ios' : DEFAULT_MOTION_STYLE);
  applyReducedPreference();
  if (reducedQuery) reducedQuery.addEventListener('change', applyReducedPreference);

  const apps = scaledApps(scaleFactor()).map((app) => ({
    id: app.id,
    title: app.title,
    frame: { w: app.size.w, h: app.size.h },
    min: app.min,
    content: collectContent(app.id),
  }));
  const renderIcon = (app) => renderAppIcon(app.id);

  store = createWindowStore();
  dock = createDock({ root: dockEl, apps, store, renderIcon, onActivate: (id) => wm.open(id) });
  const autoHide = Storage.get(DOCK_AUTOHIDE_KEY, 'false') === 'true';
  desktop.classList.toggle('is-dock-autohide', autoHide);
  wm = createWindowManager({
    root: desktop,
    areaEl,
    backdropEl: document.getElementById('wallpaper-layer'),
    apps,
    store,
    dock,
    renderIcon,
  });
  dock.setMode(Storage.get(DOCK_MODE_KEY, 'launcher'));
  dock.setAutoHide(autoHide);
  pendingBadges.forEach((count, id) => dock.setBadge(id, count));
  pendingBadges.clear();

  const sources = document.getElementById('app-sources');
  if (sources) sources.remove();

  wm.restoreSession(sanitizeSession(Storage.get(SESSION_KEY, null), APPS.map((app) => app.id)));
  store.subscribe(scheduleSave);
  window.addEventListener('pagehide', saveSession);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && saveTimer !== null) saveSession();
  });
}

export const Desktop = {
  boot,
  open(id) {
    if (wm) wm.open(id);
  },
  isOpen(id) {
    return !!wm && wm.isOpen(id);
  },
  isFocused(id) {
    return !!wm && wm.isFocused(id);
  },
  setBadge(id, count) {
    if (dock) dock.setBadge(id, count);
    else pendingBadges.set(id, count);
  },
  getMotionStyle() {
    return MotionSettings.presetName;
  },
  setMotionStyle(name) {
    const next = name === 'ios' ? 'ios' : 'hyperos';
    MotionSettings.usePreset(next);
    Storage.set(MOTION_STYLE_KEY, next);
  },
  getReducedMotion() {
    return reducedPreference();
  },
  setReducedMotion(value) {
    Storage.set(REDUCED_MOTION_KEY, ['on', 'off'].includes(value) ? value : 'system');
    applyReducedPreference();
  },
  getDockMode() {
    return dock ? dock.mode : Storage.get(DOCK_MODE_KEY, 'launcher');
  },
  setDockMode(mode) {
    const next = mode === 'minimized' ? 'minimized' : 'launcher';
    Storage.set(DOCK_MODE_KEY, next);
    if (dock) dock.setMode(next);
  },
  isDockAutoHide() {
    return Storage.get(DOCK_AUTOHIDE_KEY, 'false') === 'true';
  },
  setDockAutoHide(enabled) {
    Storage.set(DOCK_AUTOHIDE_KEY, enabled ? 'true' : 'false');
    applyAutoHide(!!enabled);
  },
  get wm() {
    return wm;
  },
  get store() {
    return store;
  },
};
