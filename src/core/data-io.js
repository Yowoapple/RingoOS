import { Data } from './data-model.js';
import { Wallpaper } from '../system/wallpaper.js';

const FOLDER_FILENAME = 'ringoos-data.json';
const LEGACY_FOLDER_FILENAME = 'life-ledger-data.json';
let connectedDirHandle = null;

function collectPayload() {
  const store = Data.getState();
  const payload = { ...store };
  if (Wallpaper) {
    payload.wallpaper = Wallpaper.exportData();
  }
  return payload;
}

function applyWallpaperFromPayload(parsed) {
  if (parsed && parsed.wallpaper && Wallpaper) {
    Wallpaper.importData(parsed.wallpaper);
  }
}

function exportJSON() {
  const payload = collectPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ringoos-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object' || !parsed.days || !parsed.settings) {
          reject(new Error('這個檔案的格式不是有效的 Life Ledger 資料'));
          return;
        }
        resolve(parsed);
      } catch (err) {
        reject(new Error('無法解析這個 JSON 檔案，請確認檔案未損毀'));
      }
    };
    reader.onerror = () => reject(new Error('讀取檔案時發生錯誤'));
    reader.readAsText(file);
  });
}

function isFolderSyncSupported() {
  return typeof window.showDirectoryPicker === 'function' && window.isSecureContext;
}

async function connectFolder() {
  if (!isFolderSyncSupported()) {
    throw new Error('目前瀏覽器不支援資料夾自動讀寫，請改用匯出/匯入 JSON');
  }
  connectedDirHandle = await window.showDirectoryPicker();
  return connectedDirHandle;
}

function isFolderConnected() {
  return connectedDirHandle !== null;
}

async function saveToFolder() {
  if (!connectedDirHandle) throw new Error('尚未連結資料夾');
  const payload = collectPayload();
  const fileHandle = await connectedDirHandle.getFileHandle(FOLDER_FILENAME, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
}

async function readFolderFile(filename) {
  try {
    const fileHandle = await connectedDirHandle.getFileHandle(filename, { create: false });
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text());
  } catch (err) {
    if (err.name === 'NotFoundError') return null;
    throw err;
  }
}

async function loadFromFolder() {
  if (!connectedDirHandle) throw new Error('尚未連結資料夾');
  const current = await readFolderFile(FOLDER_FILENAME);
  if (current) return current;
  return readFolderFile(LEGACY_FOLDER_FILENAME);
}

export const IO = {
  exportJSON,
  importJSONFile,
  applyWallpaperFromPayload,
  isFolderSyncSupported,
  connectFolder,
  isFolderConnected,
  saveToFolder,
  loadFromFolder,
};
