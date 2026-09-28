import { Storage } from '../core/storage/storage.js';

const STORAGE_PREFIX = 'yoworingo.window-visible-';

function isVisible(windowId) {
  try {
    const stored = Storage.get(STORAGE_PREFIX + windowId, null);
    return stored === null ? true : stored === 'true';
  } catch (err) {
    return true;
  }
}

function setVisible(windowId, visible) {
  try {
    Storage.set(STORAGE_PREFIX + windowId, visible ? 'true' : 'false');
  } catch (err) {}

  const windowEl = document.querySelector(`[data-window-id="${windowId}"]`);
  if (windowEl) {
    windowEl.classList.toggle('window--hidden', !visible);
  }
  window.dispatchEvent(new CustomEvent('yoworingo:layout-changed'));
}

function applyStoredVisibility() {
  document.querySelectorAll('[data-window-id]').forEach((windowEl) => {
    const windowId = windowEl.dataset.windowId;
    if (!isVisible(windowId)) {
      windowEl.classList.add('window--hidden');
    }
  });
}

export function boot() {
    applyStoredVisibility();
  }

export const WindowVisibility = { isVisible, setVisible };
