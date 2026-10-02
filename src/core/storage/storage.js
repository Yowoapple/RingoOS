import { Idb } from './idb.js';

const cache = new Map();
const pending = new Map();
let mode = 'uninitialized';
let flushScheduled = false;
let writeChain = Promise.resolve();

const OPEN_TIMEOUT = 4000;
const CHANNEL = 'yoworingo-storage';
const tabId = Math.random().toString(36).slice(2);
const listeners = new Set();
let channel = null;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`IndexedDB did not respond within ${ms} ms`)), ms)),
  ]);
}

async function init() {
  if (mode !== 'uninitialized') return mode;
  try {
    const all = await withTimeout(Idb.readAll(), OPEN_TIMEOUT);
    all.forEach((value, key) => cache.set(key, value));
    mode = 'indexeddb';
    requestPersistence();
    openChannel();
  } catch (err) {
    console.warn('RingoOS: IndexedDB unavailable, data will not persist', err);
    mode = 'memory';
  }
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  return mode;
}

function openChannel() {
  if (typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event) => {
    const message = event.data;
    if (!message || message.from === tabId || !Array.isArray(message.keys)) return;
    Idb.readKeys(message.keys).then((values) => {
      const changed = [];
      values.forEach((value, key) => {
        if (pending.has(key)) return;
        if (value === undefined) cache.delete(key);
        else cache.set(key, value);
        changed.push(key);
      });
      if (changed.length) listeners.forEach((listener) => listener({ keys: changed, external: true }));
    }).catch((err) => console.warn('RingoOS: could not read changes from another tab', err));
  };
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function requestPersistence() {
  if (!navigator.storage || typeof navigator.storage.persist !== 'function') return;
  navigator.storage.persisted()
    .then((already) => (already ? true : navigator.storage.persist()))
    .catch(() => {});
}

function has(key) {
  return cache.has(key);
}

function keys() {
  return Array.from(cache.keys());
}

function get(key, fallback) {
  return cache.has(key) ? cache.get(key) : fallback;
}

function set(key, value) {
  cache.set(key, value);
  queue(key, value);
}

function remove(key) {
  cache.delete(key);
  queue(key, undefined);
}

function queue(key, value) {
  if (mode !== 'indexeddb') return;
  pending.set(key, value);
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(flush);
}

function flush() {
  flushScheduled = false;
  if (mode !== 'indexeddb' || pending.size === 0) return writeChain;
  const entries = Array.from(pending.entries());
  pending.clear();
  writeChain = writeChain
    .then(() => Idb.write(entries))
    .then(() => {
      if (channel) channel.postMessage({ from: tabId, keys: entries.map(([key]) => key) });
    })
    .catch((err) => console.error('RingoOS: storage write failed', err));
  return writeChain;
}

function readLegacy(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

const LEGACY_PREFIX = 'lifeledger-';
const KEY_PREFIX = 'yoworingo.';
const LEGACY_SKIP = new Set(['lifeledger-draft-v1']);
const LEGACY_MARKER = 'yoworingo.legacy-prefs-imported';

function importLegacyPrefs() {
  if (has(LEGACY_MARKER)) return 0;
  let imported = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const legacyKey = window.localStorage.key(i);
      if (!legacyKey || !legacyKey.startsWith(LEGACY_PREFIX) || LEGACY_SKIP.has(legacyKey)) continue;
      const key = KEY_PREFIX + legacyKey.slice(LEGACY_PREFIX.length);
      if (has(key)) continue;
      set(key, window.localStorage.getItem(legacyKey));
      imported += 1;
    }
  } catch (err) {
    console.warn('RingoOS: legacy preferences could not be read', err);
  }
  set(LEGACY_MARKER, new Date().toISOString());
  return imported;
}

function getMode() {
  return mode;
}

export const Storage = { KEY_PREFIX, init, has, keys, get, set, remove, flush, readLegacy, importLegacyPrefs, getMode, subscribe };
