export const KINDS = [
  { id: 'ui', label: '介面' },
  { id: 'window', label: '視窗' },
  { id: 'notify', label: '通知與完成' },
  { id: 'pet', label: '桌寵' },
];

export const SOUNDS = {
  tap: { kind: 'ui', label: '點擊' },
  toggleOn: { kind: 'ui', label: '開關：開' },
  toggleOff: { kind: 'ui', label: '開關：關' },
  switch: { kind: 'ui', label: '切換選項' },
  key: { kind: 'ui', label: '計算機按鍵' },
  error: { kind: 'ui', label: '錯誤' },
  open: { kind: 'window', label: '打開視窗' },
  close: { kind: 'window', label: '關閉視窗' },
  minimize: { kind: 'window', label: '縮到 Dock' },
  success: { kind: 'notify', label: '記一筆完成' },
  remove: { kind: 'notify', label: '刪除' },
  undo: { kind: 'notify', label: '復原' },
  notify: { kind: 'notify', label: '通知' },
  achievement: { kind: 'notify', label: '成就解鎖' },
  pat: { kind: 'pet', label: '摸頭' },
  treat: { kind: 'pet', label: '吃點心' },
  checkin: { kind: 'pet', label: '每日打卡' },
  chirp: { kind: 'pet', label: '逗她' },
};

export const SOUND_KEY = 'yoworingo.v2.sound';

export const SOUND_DEFAULTS = { enabled: false, volume: 0.6, kinds: { ui: true, window: true, notify: true, pet: true }, asked: false };

export function normalizeSound(raw) {
  const base = SOUND_DEFAULTS;
  if (!raw || typeof raw !== 'object') return { ...base, kinds: { ...base.kinds } };
  const volume = Number(raw.volume);
  const kinds = { ...base.kinds };
  if (raw.kinds && typeof raw.kinds === 'object') Object.keys(kinds).forEach((k) => { if (raw.kinds[k] === false) kinds[k] = false; });
  return {
    enabled: raw.enabled === true,
    volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : base.volume,
    kinds,
    asked: raw.asked === true,
  };
}

export function canPlay(id, prefs, { quiet = false, force = false } = {}) {
  const sound = SOUNDS[id];
  if (!sound) return false;
  if (force) return true;
  if (!prefs.enabled || prefs.volume <= 0) return false;
  if (!prefs.kinds[sound.kind]) return false;
  if (quiet && sound.kind === 'notify') return false;
  return true;
}

export function outputGain(prefs, { ducked = false } = {}) {
  return prefs.volume * prefs.volume * 0.9 * (ducked ? 0.3 : 1);
}

export function panFor(left, width, screen) {
  if (!screen || !Number.isFinite(left)) return 0;
  const center = left + (width || 0) / 2;
  return Math.max(-0.6, Math.min(0.6, (center / screen - 0.5) * 1.2));
}
