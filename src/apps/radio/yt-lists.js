import { Storage } from '../../core/storage/storage.js';

const KEY = 'yoworingo.v2.yt-lists';
const MODE_KEY = 'yoworingo.v2.yt-mode';
const REPEATS = ['off', 'all', 'one'];

function uid() {
  return `yt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function clean(raw) {
  const lists = Array.isArray(raw && raw.lists) ? raw.lists : [];
  const fixed = lists
    .filter((list) => list && list.id && typeof list.name === 'string')
    .map((list) => ({
      id: list.id,
      name: list.name.slice(0, 24) || '清單',
      items: Array.isArray(list.items) ? list.items.filter((item) => item && item.id && (item.kind === 'video' || item.kind === 'playlist') && item.ref) : [],
    }));
  const active = fixed.some((list) => list.id === raw?.active) ? raw.active : fixed[0]?.id || null;
  return { lists: fixed, active };
}

export function createYtLists() {
  let state = clean(Storage.get(KEY, null));
  let mode = Storage.get(MODE_KEY, null) || {};
  let shuffle = !!mode.shuffle;
  let repeat = REPEATS.includes(mode.repeat) ? mode.repeat : 'off';
  const listeners = new Set();

  function emit(reason) {
    listeners.forEach((listener) => listener(reason));
  }

  function save(reason = 'change') {
    Storage.set(KEY, state);
    emit(reason);
  }

  function saveMode() {
    Storage.set(MODE_KEY, { shuffle, repeat });
    emit('mode');
  }

  function find(id = state.active) {
    return state.lists.find((list) => list.id === id) || null;
  }

  return {
    get lists() { return state.lists; },
    get active() { return find(); },
    get shuffle() { return shuffle; },
    get repeat() { return repeat; },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reload() {
      state = clean(Storage.get(KEY, null));
      mode = Storage.get(MODE_KEY, null) || {};
      shuffle = !!mode.shuffle;
      repeat = REPEATS.includes(mode.repeat) ? mode.repeat : 'off';
      emit('reload');
    },
    createList(name) {
      const list = { id: uid(), name: (name || '').trim().slice(0, 24) || `清單 ${state.lists.length + 1}`, items: [] };
      state.lists.push(list);
      state.active = list.id;
      save('lists');
      return list;
    },
    renameList(id, name) {
      const list = find(id);
      const next = (name || '').trim().slice(0, 24);
      if (!list || !next || list.name === next) return;
      list.name = next;
      save('lists');
    },
    removeList(id) {
      const index = state.lists.findIndex((list) => list.id === id);
      if (index < 0) return null;
      const [removed] = state.lists.splice(index, 1);
      if (state.active === id) state.active = state.lists[Math.min(index, state.lists.length - 1)]?.id || null;
      save('lists');
      return { list: removed, index };
    },
    restoreList(list, index) {
      if (state.lists.some((other) => other.id === list.id)) return;
      state.lists.splice(Math.min(index, state.lists.length), 0, list);
      state.active = list.id;
      save('lists');
    },
    setActive(id) {
      if (!find(id) || state.active === id) return;
      state.active = id;
      save('active');
    },
    addItem(item) {
      let list = find();
      if (!list) list = this.createList('我的清單');
      const entry = { id: uid(), kind: item.kind, ref: item.ref, title: item.title || '', author: item.author || '', thumb: item.thumb || '', addedAt: Date.now() };
      list.items.push(entry);
      save('items');
      return entry;
    },
    updateItem(id, patch) {
      const list = find();
      const item = list && list.items.find((other) => other.id === id);
      if (!item) return;
      Object.assign(item, patch);
      save('items');
    },
    removeItem(id) {
      const list = find();
      if (!list) return null;
      const index = list.items.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const [item] = list.items.splice(index, 1);
      save('items');
      return { item, index, listId: list.id };
    },
    restoreItem({ item, index, listId }) {
      const list = find(listId);
      if (!list || list.items.some((other) => other.id === item.id)) return;
      list.items.splice(Math.min(index, list.items.length), 0, item);
      save('items');
    },
    moveItem(id, to) {
      const list = find();
      if (!list) return;
      const from = list.items.findIndex((item) => item.id === id);
      if (from < 0 || from === to) return;
      const [item] = list.items.splice(from, 1);
      list.items.splice(Math.max(0, Math.min(to, list.items.length)), 0, item);
      save('order');
    },
    setShuffle(on) {
      shuffle = !!on;
      saveMode();
    },
    cycleRepeat() {
      repeat = REPEATS[(REPEATS.indexOf(repeat) + 1) % REPEATS.length];
      saveMode();
      return repeat;
    },
  };
}
