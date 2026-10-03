import { Storage } from '../../../core/storage/storage.js';

export const FX_KEY = 'yoworingo.v2.weather-fx';
export const FX_DEFAULTS = { enabled: true, level: 'normal', lightning: true };
const LEVELS = ['soft', 'normal', 'rich'];
const listeners = new Set();

export function readFxPrefs() {
  const raw = Storage.get(FX_KEY, null) || {};
  return {
    enabled: raw.enabled !== false,
    level: LEVELS.includes(raw.level) ? raw.level : FX_DEFAULTS.level,
    lightning: raw.lightning !== false,
  };
}

export function setFxPrefs(patch) {
  const next = { ...readFxPrefs(), ...patch };
  Storage.set(FX_KEY, next);
  listeners.forEach((fn) => fn(next));
  return next;
}

let preview = null;
const previewListeners = new Set();

export function getFxPreview() {
  return preview;
}

export function setFxPreview(id) {
  const next = id || null;
  if (next === preview) return;
  preview = next;
  previewListeners.forEach((fn) => fn(preview));
}

export function onFxPreview(fn) {
  previewListeners.add(fn);
  return () => previewListeners.delete(fn);
}

export function onFxPrefs(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (typeof Storage.subscribe === 'function') {
  Storage.subscribe(({ keys }) => {
    if (!keys.includes(FX_KEY)) return;
    const next = readFxPrefs();
    listeners.forEach((fn) => fn(next));
  });
}
