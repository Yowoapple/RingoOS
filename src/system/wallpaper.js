import { Storage } from '../core/storage/storage.js';

const STORAGE_KEY = 'yoworingo.wallpaper';
const DEFAULTS = { dataUrl: null, opacity: 60, blur: 6 };

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;

function load() {
  try {
    const raw = Storage.get(STORAGE_KEY, null);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch (err) {
    return { ...DEFAULTS };
  }
}

function persist(state) {
  try {
    Storage.set(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    return false;
  }
}

let current = { ...DEFAULTS };

function hydrate() {
  current = load();
}

function apply() {
  const imageEl = document.getElementById('wallpaper-layer-image');
  const layerEl = document.getElementById('wallpaper-layer');
  if (!imageEl || !layerEl) return;

  if (current.dataUrl) {
    imageEl.style.backgroundImage = `url("${current.dataUrl}")`;
    layerEl.classList.add('is-active');
  } else {
    imageEl.style.backgroundImage = 'none';
    layerEl.classList.remove('is-active');
  }
  layerEl.style.setProperty('--wallpaper-opacity', String(current.opacity / 100));
  layerEl.style.setProperty('--wallpaper-blur', `${current.blur}px`);
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type || file.type.indexOf('image/') !== 0) {
      reject(new Error('請選擇圖片檔案'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        } catch (err) {
          reject(new Error('這張圖片無法轉換，請換一張試試'));
        }
      };
      img.onerror = () => reject(new Error('圖片讀取失敗，請確認檔案是有效的圖片'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('讀取檔案時發生錯誤'));
    reader.readAsDataURL(file);
  });
}

async function setImageFile(file) {
  const dataUrl = await compressImage(file);
  current = { ...current, dataUrl };
  persist(current);
  apply();
  return dataUrl;
}

function clearImage() {
  current = { ...current, dataUrl: null };
  persist(current);
  apply();
}

function setOpacity(value) {
  current = { ...current, opacity: value };
  persist(current);
  apply();
}

function setBlur(value) {
  current = { ...current, blur: value };
  persist(current);
  apply();
}

function getState() {
  return { ...current };
}

function exportData() {
  return { ...current };
}

function importData(data) {
  if (!data || typeof data !== 'object') return;
  current = { ...DEFAULTS, ...data };
  persist(current);
  apply();
}

export function boot() {
    apply();
  }

export const Wallpaper = {
  hydrate,
  getState,
  setImageFile,
  clearImage,
  setOpacity,
  setBlur,
  exportData,
  importData,
};
