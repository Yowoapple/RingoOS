import { Storage } from '../core/storage/storage.js';

const STORAGE_KEY = 'yoworingo.fullscreen-auto';

const ICON_ENTER = 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5';
const ICON_EXIT = 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5';

let armed = false;

function getEl() {
  return document.documentElement;
}

function isSupported() {
  const el = getEl();
  return !!(el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen);
}

function isFullscreenActive() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function isAutoEnabled() {
  try {
    return Storage.get(STORAGE_KEY, null) === '1';
  } catch (err) {
    return false;
  }
}

function storeAutoEnabled(enabled) {
  try {
    Storage.set(STORAGE_KEY, enabled ? '1' : '0');
  } catch (err) {
  }
}

function requestFullscreen() {
  const el = getEl();
  const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (!request) return;
  try {
    const result = request.call(el);
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  } catch (err) {
  }
}

function exitFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (!exit || !isFullscreenActive()) return;
  try {
    const result = exit.call(document);
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch (err) {
  }
}

function toggleFullscreen() {
  if (isFullscreenActive()) {
    exitFullscreen();
  } else {
    requestFullscreen();
  }
}

function handleFirstInteraction() {
  disarmFirstInteraction();
  if (!isFullscreenActive()) requestFullscreen();
}

function armFirstInteraction() {
  if (armed || !isSupported()) return;
  armed = true;
  document.addEventListener('click', handleFirstInteraction, { once: true });
  document.addEventListener('keydown', handleFirstInteraction, { once: true });
}

function disarmFirstInteraction() {
  armed = false;
  document.removeEventListener('click', handleFirstInteraction);
  document.removeEventListener('keydown', handleFirstInteraction);
}

function setAutoEnabled(enabled) {
  storeAutoEnabled(enabled);
  if (enabled) {
    armFirstInteraction();
  } else {
    disarmFirstInteraction();
  }
}

function updateToggleIcon() {
  const btn = document.querySelector('[data-fullscreen-toggle]');
  if (!btn) return;
  const active = isFullscreenActive();
  const path = btn.querySelector('[data-fullscreen-icon] path');
  if (path) path.setAttribute('d', active ? ICON_EXIT : ICON_ENTER);
  btn.setAttribute('aria-label', active ? '結束全螢幕' : '進入全螢幕');
}

function init() {
  const toggleBtn = document.querySelector('[data-fullscreen-toggle]');

  if (!isSupported()) {
    if (toggleBtn) toggleBtn.hidden = true;
    return;
  }

  if (toggleBtn) {
    toggleBtn.hidden = false;
    toggleBtn.addEventListener('click', toggleFullscreen);
  }

  if (isAutoEnabled()) armFirstInteraction();

  document.addEventListener('fullscreenchange', updateToggleIcon);
  document.addEventListener('webkitfullscreenchange', updateToggleIcon);
  updateToggleIcon();
}

export function boot() {
    init();
  }

export const Fullscreen = {
  isSupported,
  isAutoEnabled,
  setAutoEnabled,
  toggleFullscreen,
  isFullscreenActive,
};
