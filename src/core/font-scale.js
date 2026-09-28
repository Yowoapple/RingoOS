import { Storage } from './storage/storage.js';

const STORAGE_KEY = 'yoworingo.font-scale';
const MIN_SCALE = 1.0;
const MAX_SCALE = 2.0;
const STEP = 0.1;
const DEFAULT_SCALE = 1.3;

const root = document.documentElement;
let currentScale = DEFAULT_SCALE;

function getStoredScale() {
  try {
    const raw = Storage.get(STORAGE_KEY, null);
    const parsed = raw ? parseFloat(raw) : DEFAULT_SCALE;
    return clamp(isNaN(parsed) ? DEFAULT_SCALE : parsed);
  } catch (err) {
    return DEFAULT_SCALE;
  }
}

function storeScale(scale) {
  try {
    Storage.set(STORAGE_KEY, String(scale));
  } catch (err) {
  }
}

function clamp(value) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function applyScale(scale) {
  const clamped = clamp(scale);
  root.style.setProperty('--scale-factor', clamped.toFixed(2));
  updateLabel(clamped);
  window.dispatchEvent(new CustomEvent('yoworingo:rescale'));
  return clamped;
}

function setScale(scale) {
  currentScale = applyScale(scale);
  storeScale(currentScale);
  return currentScale;
}

function getScale() {
  return currentScale;
}

function updateLabel(scale) {
  const label = document.querySelector('[data-font-scale-label]');
  if (label) {
    label.textContent = `${Math.round(scale * 100)}%`;
  }
  const settingsValue = document.getElementById('settings-font-scale-value');
  if (settingsValue) {
    settingsValue.textContent = `${Math.round(scale * 100)}%`;
  }
  const settingsSlider = document.getElementById('settings-font-scale-slider');
  if (settingsSlider && Number(settingsSlider.value) !== Math.round(scale * 100)) {
    settingsSlider.value = Math.round(scale * 100);
  }
}

function initFontScale() {
  currentScale = getStoredScale();
  applyScale(currentScale);

  const decreaseBtn = document.querySelector('[data-font-scale-decrease]');
  const increaseBtn = document.querySelector('[data-font-scale-increase]');

  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', () => setScale(currentScale - STEP));
  }

  if (increaseBtn) {
    increaseBtn.addEventListener('click', () => setScale(currentScale + STEP));
  }
}

export function boot() {
    initFontScale();
  }

export const FontScale = { applyScale, setScale, getScale };
