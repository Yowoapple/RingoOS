import { Storage } from './storage/storage.js';

const STORAGE_KEY = 'yoworingo.theme-preference';
const root = document.documentElement;

function getSystemPrefersDark() {
  if (window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return null;
}

function getTimeBasedTheme() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? 'light' : 'dark';
}

function resolveAutoTheme() {
  const systemPrefersDark = getSystemPrefersDark();
  if (systemPrefersDark !== null) {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return getTimeBasedTheme();
}

function applyTheme(theme) {
  const resolved = theme === 'auto' ? resolveAutoTheme() : theme;
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-mode', theme);
  updateThemeToggleIcon(theme, resolved);
}

function getStoredPreference() {
  try {
    return Storage.get(STORAGE_KEY, null) || 'auto';
  } catch (err) {
    return 'auto';
  }
}

function storePreference(theme) {
  try {
    Storage.set(STORAGE_KEY, theme);
  } catch (err) {
  }
}

function updateThemeToggleIcon(mode, resolved) {
  const btn = document.querySelector('[data-theme-toggle]');
  if (!btn) return;
  const labelMap = { light: '淺色', dark: '深色', auto: '自動' };
  btn.setAttribute('aria-label', `目前主題：${labelMap[mode]}（實際顯示：${resolved === 'dark' ? '深色' : '淺色'}），點擊切換`);
  btn.dataset.mode = mode;
  btn.textContent = mode === 'light' ? '☀' : mode === 'dark' ? '☾' : '◐';
}

function cycleTheme() {
  const current = getStoredPreference();
  const order = ['auto', 'light', 'dark'];
  const next = order[(order.indexOf(current) + 1) % order.length];
  storePreference(next);
  applyTheme(next);
}

function setTheme(mode) {
  storePreference(mode);
  applyTheme(mode);
}

function initTheme() {
  const preference = getStoredPreference();
  applyTheme(preference);

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getStoredPreference() === 'auto') applyTheme('auto');
    });
  }

  const toggleBtn = document.querySelector('[data-theme-toggle]');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', cycleTheme);
  }

  window.setInterval(() => {
    if (getStoredPreference() === 'auto') applyTheme('auto');
  }, 30 * 60 * 1000);
}

export function boot() {
    initTheme();
  }

export const Theme = { applyTheme, cycleTheme, setTheme };
