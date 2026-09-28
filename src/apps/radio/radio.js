import { Storage } from '../../core/storage/storage.js';

const VOLUME_KEY = 'yoworingo.radio-volume';
const STATION_KEY = 'yoworingo.radio-last-station';
const FAVORITES_KEY = 'yoworingo.radio-favorites';
const RECENTS_KEY = 'yoworingo.radio-recent';
const DEFAULT_VOLUME = 0.7;
const METADATA_TIMEOUT_MS = 4000;
const METADATA_POLL_MS = 30000;
const MAX_RECENTS = 12;
const STATIONS_KEY = 'yoworingo.radio-stations';
const DEFAULT_GRADIENT = ['#a1c4fd', '#c2e9fb'];
const EMPTY_MESSAGE = '尚未匯入電台清單';

let STATIONS = [];
let audioEl = null;
let currentStationId = null;
let isPlaying = false;
let lastError = null;
let metadataCache = new Map();
let metadataTimer = null;
let favoriteIds = [];
let recentIds = [];

const subscribers = new Set();

function notify() {
  subscribers.forEach((cb) => {
    try { cb(getState()); } catch (err) { console.error('Life Ledger：電台狀態通知失敗', err); }
  });
}

function getStations() {
  return STATIONS.slice();
}

function getStationById(id) {
  return STATIONS.find((s) => s.id === id) || STATIONS[0] || null;
}

function hasStations() {
  return STATIONS.length > 0;
}

function regionFromDescription(description) {
  const match = /^([A-Za-z]{2,3})\s*·/.exec(description || '');
  return match ? match[1].toUpperCase() : '其他';
}

function normalizeStations(input) {
  const list = Array.isArray(input) ? input : (input && Array.isArray(input.stations) ? input.stations : null);
  if (!list) throw new Error('檔案格式不對：需要是電台陣列，或含有 stations 陣列的物件');
  const seen = new Set();
  const stations = [];
  list.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const id = String(item.id || '').trim();
    const name = String(item.name || '').trim();
    const streamUrl = String(item.streamUrl || '').trim();
    if (!id || !name || !/^https?:\/\//i.test(streamUrl) || seen.has(id)) return;
    seen.add(id);
    const description = typeof item.description === 'string' ? item.description : '';
    const gradient = Array.isArray(item.gradient) && item.gradient.length === 2 ? item.gradient.map(String) : DEFAULT_GRADIENT;
    stations.push({
      id,
      name,
      description,
      region: typeof item.region === 'string' && item.region.trim() ? item.region.trim() : regionFromDescription(description),
      streamUrl,
      statusUrl: typeof item.statusUrl === 'string' && /^https?:\/\//i.test(item.statusUrl) ? item.statusUrl : null,
      gradient,
    });
  });
  if (!stations.length) throw new Error('檔案裡沒有可用的電台（每一台都需要 id、name 與 http/https 開頭的 streamUrl）');
  return stations;
}

function getRegions() {
  const counts = new Map();
  STATIONS.forEach((s) => {
    const key = s.region || '其他';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count);
}

function searchStations(query, region) {
  const q = (query || '').trim().toLowerCase();
  return STATIONS.filter((s) => {
    const matchesRegion = !region || region === 'all' || s.region === region;
    const matchesQuery = !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    return matchesRegion && matchesQuery;
  });
}

function loadFavorites() {
  try {
    const raw = Storage.get(FAVORITES_KEY, null);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((id) => STATIONS.some((s) => s.id === id)) : [];
  } catch (err) {
    return [];
  }
}

function saveFavorites() {
  Storage.set(FAVORITES_KEY, JSON.stringify(favoriteIds));
}

function isFavorite(id) {
  return favoriteIds.includes(id);
}

function toggleFavorite(id) {
  favoriteIds = isFavorite(id) ? favoriteIds.filter((x) => x !== id) : [id, ...favoriteIds];
  saveFavorites();
  notify();
}

function getFavorites() {
  return favoriteIds.map((id) => getStationById(id)).filter(Boolean);
}

function loadRecents() {
  try {
    const raw = Storage.get(RECENTS_KEY, null);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((id) => STATIONS.some((s) => s.id === id)) : [];
  } catch (err) {
    return [];
  }
}

function saveRecents() {
  Storage.set(RECENTS_KEY, JSON.stringify(recentIds));
}

function recordRecent(id) {
  recentIds = [id, ...recentIds.filter((x) => x !== id)].slice(0, MAX_RECENTS);
  saveRecents();
}

function getRecents() {
  return recentIds.map((id) => getStationById(id)).filter(Boolean);
}

function loadVolume() {
  const raw = Storage.get(VOLUME_KEY, null);
  const parsed = raw === null ? DEFAULT_VOLUME : Number(raw);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : DEFAULT_VOLUME;
}

function loadLastStationId() {
  const raw = Storage.get(STATION_KEY, null);
  if (raw && STATIONS.some((s) => s.id === raw)) return raw;
  return STATIONS.length ? STATIONS[0].id : null;
}

function ensureAudio() {
  if (audioEl) return audioEl;
  audioEl = new Audio();
  audioEl.preload = 'none';
  audioEl.volume = loadVolume();
  audioEl.addEventListener('playing', () => {
    isPlaying = true;
    lastError = null;
    recordRecent(currentStationId);
    notify();
  });
  audioEl.addEventListener('pause', () => {
    isPlaying = false;
    notify();
  });
  audioEl.addEventListener('error', () => {
    isPlaying = false;
    lastError = '電台目前連不上，可能是斷線或網址失效';
    console.error('Life Ledger：電台播放失敗', audioEl.error, audioEl.error && audioEl.error.code, audioEl.src);
    notify();
  });
  audioEl.addEventListener('waiting', () => {
    notify();
  });
  return audioEl;
}

function setSource(stationId) {
  const station = getStationById(stationId);
  const audio = ensureAudio();
  audio.pause();
  audio.src = station.streamUrl;
  currentStationId = station.id;
  Storage.set(STATION_KEY, station.id);
  lastError = null;
}

function play(stationId) {
  if (!hasStations()) {
    lastError = EMPTY_MESSAGE;
    notify();
    return;
  }
  const targetId = stationId || currentStationId;
  if (targetId !== currentStationId || !audioEl || !audioEl.src) {
    setSource(targetId);
  }
  const audio = ensureAudio();
  const result = audio.play();
  if (result && typeof result.catch === 'function') {
    result.catch((err) => {
      lastError = '無法自動播放，請再點一次播放鍵';
      isPlaying = false;
      console.error('Life Ledger：play() 被拒絕', err && err.name, err && err.message, audio.src);
      notify();
    });
  }
  notify();
  startMetadataPolling();
}

function pause() {
  if (audioEl) audioEl.pause();
  notify();
}

function togglePlay() {
  if (isPlaying) {
    pause();
  } else {
    play(currentStationId);
  }
}

function switchStation(stationId) {
  if (!hasStations()) return;
  const wasPlaying = isPlaying;
  setSource(stationId);
  notify();
  if (wasPlaying) play(stationId);
}

function setVolume(value) {
  const v = Math.min(1, Math.max(0, Number(value)));
  ensureAudio().volume = v;
  Storage.set(VOLUME_KEY, String(v));
  notify();
}

function getVolume() {
  return audioEl ? audioEl.volume : loadVolume();
}

async function tryFetchMetadata(station) {
  if (!station.statusUrl) return null;
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
    const res = await fetch(station.statusUrl, { signal: controller.signal, mode: 'cors' });
    window.clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const source = data && data.icestats ? data.icestats.source : null;
    if (!source) return null;
    const first = Array.isArray(source) ? source[0] : source;
    if (!first) return null;
    return {
      nowPlaying: first.title || first.yp_currently_playing || null,
      listeners: typeof first.listeners === 'number' ? first.listeners : null,
    };
  } catch (err) {
    return null;
  }
}

async function refreshMetadata() {
  const station = getStationById(currentStationId);
  if (!station) return;
  const result = await tryFetchMetadata(station);
  metadataCache.set(station.id, result);
  notify();
}

function startMetadataPolling() {
  stopMetadataPolling();
  refreshMetadata();
  metadataTimer = window.setInterval(refreshMetadata, METADATA_POLL_MS);
}

function stopMetadataPolling() {
  if (metadataTimer) {
    window.clearInterval(metadataTimer);
    metadataTimer = null;
  }
}

function getMetadata(stationId) {
  return metadataCache.get(stationId || currentStationId) || null;
}

function getState() {
  return {
    stations: getStations(),
    currentStationId,
    currentStation: getStationById(currentStationId),
    isPlaying,
    volume: getVolume(),
    error: lastError,
    metadata: getMetadata(currentStationId),
  };
}

function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function applyStations(list) {
  STATIONS = list;
  currentStationId = loadLastStationId();
  favoriteIds = loadFavorites();
  recentIds = loadRecents();
}

function loadStations() {
  const stored = Storage.get(STATIONS_KEY, null);
  let list = [];
  try {
    list = stored ? normalizeStations(stored) : [];
  } catch (err) {
    console.warn('RingoOS: stored radio stations are invalid', err);
  }
  applyStations(list);
}

function importStations(input) {
  const stations = normalizeStations(input);
  if (audioEl) {
    audioEl.pause();
    audioEl.removeAttribute('src');
  }
  stopMetadataPolling();
  isPlaying = false;
  lastError = null;
  Storage.set(STATIONS_KEY, stations);
  applyStations(stations);
  notify();
  window.dispatchEvent(new CustomEvent('yoworingo:radio-stations-change'));
  return stations.length;
}

function clearStations() {
  if (audioEl) {
    audioEl.pause();
    audioEl.removeAttribute('src');
  }
  stopMetadataPolling();
  isPlaying = false;
  lastError = null;
  Storage.remove(STATIONS_KEY);
  applyStations([]);
  notify();
  window.dispatchEvent(new CustomEvent('yoworingo:radio-stations-change'));
}

export const Radio = {
  EMPTY_MESSAGE,
  loadStations,
  importStations,
  clearStations,
  hasStations,
  getStations,
  getRegions,
  searchStations,
  getState,
  play,
  pause,
  togglePlay,
  switchStation,
  setVolume,
  subscribe,
  isFavorite,
  toggleFavorite,
  getFavorites,
  getRecents,
};
