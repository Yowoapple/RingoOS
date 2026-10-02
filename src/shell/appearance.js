import { Storage } from '../core/storage/storage.js';
import { baseThickness, sampleGlassThickness, presetAccent, wallpaperAccent } from '../ui/wall-tone.js';

const KEY = 'yoworingo.v2.appearance';
const WALL_KEY = 'yoworingo.v2.wallpaper';
const SCALE_KEY = 'yoworingo.font-scale';
const DEFAULTS = { style: 'a', accent: 'auto', theme: 'auto', wall: 'mono' };
const STYLES = ['a', 'c'];
const ACCENTS = ['auto', 'apple', 'signal', 'ultramarine'];
const THEMES = ['auto', 'light', 'dark'];
const WALLS = ['mono', 'aurora', 'photo'];
const MIN_SCALE = 1;
const MAX_SCALE = 2;
const DEFAULT_SCALE = 1.3;
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;

function pick(value, list, fallback) {
  return list.includes(value) ? value : fallback;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('請選擇圖片檔案'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { naturalWidth: width, naturalHeight: height } = img;
      if (Math.max(width, height) > MAX_DIMENSION) {
        const ratio = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      try {
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      } catch (err) {
        reject(new Error('這張圖片無法轉換，請換一張試試'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('圖片讀取失敗，請確認檔案是有效的圖片'));
    };
    img.src = url;
  });
}

export function createAppearance({ root, regions }) {
  const saved = Storage.get(KEY, null) || {};
  const state = {
    style: pick(saved.style, STYLES, DEFAULTS.style),
    accent: pick(saved.accent, ACCENTS, DEFAULTS.accent),
    theme: pick(saved.theme, THEMES, DEFAULTS.theme),
    wall: pick(saved.wall, WALLS, DEFAULTS.wall),
  };
  let photo = Storage.get(WALL_KEY, null);
  if (state.wall === 'photo' && !photo) state.wall = DEFAULTS.wall;
  const storedScale = parseFloat(Storage.get(SCALE_KEY, String(DEFAULT_SCALE)));
  let scale = Number.isFinite(storedScale) ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, storedScale)) : DEFAULT_SCALE;
  let autoAccent = presetAccent(state.wall);
  let token = 0;
  const listeners = new Set();
  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function resolvedTheme() {
    if (state.theme !== 'auto') return state.theme;
    if (darkQuery) return darkQuery.matches ? 'dark' : 'light';
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18 ? 'light' : 'dark';
  }

  function emit() {
    listeners.forEach((listener) => listener(api));
  }

  function applyTones({ bar, dock }) {
    root.style.setProperty('--bar-alpha', bar.alpha.toFixed(2));
    root.style.setProperty('--dock-alpha', dock.alpha.toFixed(2));
    root.dataset.barSolid = bar.solid ? '1' : '0';
  }

  function applyAccent() {
    root.dataset.accent = state.accent === 'auto' ? autoAccent : state.accent;
  }

  function refreshTones() {
    const mine = ++token;
    const theme = resolvedTheme();
    if (state.wall !== 'photo' || !photo) {
      autoAccent = presetAccent(state.wall);
      applyTones(baseThickness(theme));
      applyAccent();
      emit();
      return;
    }
    sampleGlassThickness(photo, regions(), theme).then((tones) => {
      if (mine === token) applyTones(tones);
    }).catch(() => {
      if (mine === token) applyTones(baseThickness(theme));
    });
    wallpaperAccent(photo).then((name) => {
      if (mine !== token) return;
      autoAccent = name;
      applyAccent();
      emit();
    }).catch(() => {});
  }

  function apply() {
    root.dataset.style = state.style;
    root.dataset.theme = resolvedTheme();
    root.dataset.themeMode = state.theme;
    root.dataset.wall = state.wall;
    root.style.fontSize = `${Math.round(scale * 100)}%`;
    if (photo) root.style.setProperty('--wall-photo', `url("${photo}")`);
    else root.style.removeProperty('--wall-photo');
    applyAccent();
    refreshTones();
  }

  function persist() {
    Storage.set(KEY, { ...state });
  }

  const api = {
    get state() { return { ...state }; },
    get theme() { return resolvedTheme(); },
    get autoAccent() { return autoAccent; },
    get scale() { return scale; },
    set(key, value) {
      const lists = { style: STYLES, accent: ACCENTS, theme: THEMES, wall: WALLS };
      if (!lists[key] || !lists[key].includes(value) || state[key] === value) return;
      if (key === 'wall' && value === 'photo' && !photo) return;
      state[key] = value;
      persist();
      apply();
      emit();
    },
    setScale(next) {
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(next * 10) / 10));
      if (clamped === scale) return;
      scale = clamped;
      Storage.set(SCALE_KEY, String(scale));
      root.style.fontSize = `${Math.round(scale * 100)}%`;
      window.dispatchEvent(new CustomEvent('yoworingo:rescale'));
      emit();
    },
    async setPhoto(file) {
      photo = await compressImage(file);
      Storage.set(WALL_KEY, photo);
      state.wall = 'photo';
      persist();
      apply();
      emit();
    },
    clearPhoto() {
      if (!photo) return;
      photo = null;
      Storage.remove(WALL_KEY);
      if (state.wall === 'photo') state.wall = DEFAULTS.wall;
      persist();
      apply();
      emit();
    },
    get hasPhoto() { return !!photo; },
    refresh: refreshTones,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  if (darkQuery) darkQuery.addEventListener('change', () => { if (state.theme === 'auto') apply(); });
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(refreshTones, 200);
  });
  apply();
  return api;
}
