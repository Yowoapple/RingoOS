import { Storage } from '../core/storage/storage.js';
import { inQuietHours } from './notify-rules.js';

export const PREFS_KEY = 'yoworingo.v2.notify-prefs';
export const HISTORY_KEY = 'yoworingo.v2.notify-history';
export const SENT_KEY = 'yoworingo.v2.notify-sent';

const LIMIT = 50;
const SENT_TTL = 45 * 86400000;
const LOCK = 'yoworingo-notify-leader';

export const DEFAULT_PREFS = {
  enabled: true,
  system: false,
  dnd: { on: false, schedule: false, from: '23:00', to: '07:00' },
  kinds: { calendar: true, summary: true, weather: true, budget: true, daily: false },
  dailyTime: '21:00',
};

function mergePrefs(stored) {
  const base = JSON.parse(JSON.stringify(DEFAULT_PREFS));
  if (!stored || typeof stored !== 'object') return base;
  return {
    ...base,
    ...stored,
    dnd: { ...base.dnd, ...(stored.dnd || {}) },
    kinds: { ...base.kinds, ...(stored.kinds || {}) },
  };
}

function newId() {
  return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createNotifier({ onShow, onActivate, now = () => new Date() } = {}) {
  const listeners = new Set();
  let prefs = mergePrefs(Storage.get(PREFS_KEY, null));
  let history = Array.isArray(Storage.get(HISTORY_KEY, null)) ? Storage.get(HISTORY_KEY, null) : [];
  let sent = Storage.get(SENT_KEY, null) || {};
  let leader = typeof navigator === 'undefined' || !navigator.locks;
  const known = new Set(history.map((item) => item.id));

  if (!leader) {
    navigator.locks.request(LOCK, () => {
      leader = true;
      emit('leader');
      return new Promise(() => {});
    }).catch(() => {
      leader = true;
    });
  }

  function emit(type) {
    listeners.forEach((listener) => listener({ type }));
  }

  function saveHistory() {
    Storage.set(HISTORY_KEY, history.slice());
  }

  function prune() {
    const limit = now().getTime() - SENT_TTL;
    Object.keys(sent).forEach((key) => {
      if (sent[key] < limit) delete sent[key];
    });
  }

  function quiet() {
    return inQuietHours(prefs.dnd, now());
  }

  function kindOn(kind) {
    return !kind || prefs.kinds[kind] !== false;
  }

  function systemAllowed() {
    return prefs.system && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  }

  function present(item) {
    if (quiet()) return;
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (hidden) {
      if (item.level === 'time' && systemAllowed()) {
        try {
          const native = new Notification(item.title, { body: item.body, tag: item.key, lang: 'zh-Hant' });
          native.onclick = () => {
            window.focus();
            activate(item.id);
            native.close();
          };
        } catch (err) {
          console.warn('RingoOS: system notification failed', err);
        }
      }
      return;
    }
    if (onShow) onShow(item);
  }

  function notify(candidate) {
    if (!candidate || !candidate.key) return null;
    if (!prefs.enabled || !kindOn(candidate.kind)) return null;
    if (sent[candidate.key]) return null;
    const at = now().getTime();
    sent[candidate.key] = at;
    (candidate.covers || []).forEach((key) => {
      if (!sent[key]) sent[key] = at;
    });
    prune();
    Storage.set(SENT_KEY, { ...sent });
    const item = {
      id: newId(),
      key: candidate.key,
      app: candidate.app,
      kind: candidate.kind || null,
      level: candidate.level || 'info',
      title: candidate.title,
      body: candidate.body || '',
      target: candidate.target || null,
      at,
      read: false,
    };
    history = [item, ...history].slice(0, LIMIT);
    known.add(item.id);
    saveHistory();
    present(item);
    emit('add');
    return item;
  }

  function sendAll(list) {
    (list || []).filter(Boolean).forEach(notify);
  }

  function activate(id) {
    const item = history.find((entry) => entry.id === id);
    if (!item) return;
    if (!item.read) {
      history = history.map((entry) => (entry.id === id ? { ...entry, read: true } : entry));
      saveHistory();
      emit('read');
    }
    if (onActivate) onActivate(item);
  }

  function markAllRead() {
    if (!history.some((item) => !item.read)) return;
    history = history.map((item) => (item.read ? item : { ...item, read: true }));
    saveHistory();
    emit('read');
  }

  function remove(id) {
    const next = history.filter((item) => item.id !== id);
    if (next.length === history.length) return;
    history = next;
    saveHistory();
    emit('remove');
  }

  function clear() {
    if (!history.length) return;
    history = [];
    saveHistory();
    emit('clear');
  }

  function setPrefs(patch) {
    prefs = mergePrefs({
      ...prefs,
      ...patch,
      dnd: { ...prefs.dnd, ...(patch.dnd || {}) },
      kinds: { ...prefs.kinds, ...(patch.kinds || {}) },
    });
    Storage.set(PREFS_KEY, JSON.parse(JSON.stringify(prefs)));
    emit('prefs');
  }

  async function requestSystem() {
    if (typeof Notification === 'undefined') return 'unsupported';
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    setPrefs({ system: permission === 'granted' });
    return permission;
  }

  Storage.subscribe(({ keys }) => {
    let changed = false;
    if (keys.includes(PREFS_KEY)) {
      prefs = mergePrefs(Storage.get(PREFS_KEY, null));
      changed = true;
    }
    if (keys.includes(SENT_KEY)) sent = { ...(Storage.get(SENT_KEY, null) || {}) };
    if (keys.includes(HISTORY_KEY)) {
      const next = Storage.get(HISTORY_KEY, null);
      history = Array.isArray(next) ? next : [];
      const fresh = history.filter((item) => !known.has(item.id));
      fresh.forEach((item) => known.add(item.id));
      fresh.slice().reverse().forEach((item) => {
        if (!quiet() && document.visibilityState === 'visible' && onShow) onShow(item);
      });
      changed = true;
    }
    if (changed) emit('sync');
  });

  return {
    notify,
    sendAll,
    activate,
    markAllRead,
    remove,
    clear,
    setPrefs,
    requestSystem,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    wasSent: (key) => !!sent[key],
    get prefs() { return prefs; },
    get history() { return history; },
    get unread() { return history.filter((item) => !item.read).length; },
    get quiet() { return quiet(); },
    get leader() { return leader; },
  };
}
