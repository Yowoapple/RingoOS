export function createWindowStore() {
  const windows = new Map();
  let order = [];
  let focusedId = null;
  const listeners = new Set();

  function emit(type, id) {
    listeners.forEach((listener) => listener({ type, id }));
  }

  function require(id) {
    const record = windows.get(id);
    if (!record) throw new Error(`Unknown window: ${id}`);
    return record;
  }

  function topVisible(excludeId) {
    for (let i = order.length - 1; i >= 0; i -= 1) {
      const id = order[i];
      if (id !== excludeId && windows.get(id).state === 'open') return id;
    }
    return null;
  }

  function raise(id) {
    order = order.filter((other) => other !== id);
    order.push(id);
  }

  function setFocus(id) {
    if (focusedId === id) return;
    focusedId = id;
    emit('focus', id);
  }

  return {
    register({ id, title, frame, min }) {
      windows.set(id, { id, title, frame: { ...frame }, min: { ...min }, state: 'closed', snap: null, restore: null });
      order.push(id);
      return windows.get(id);
    },
    get(id) {
      return windows.get(id) || null;
    },
    all() {
      return Array.from(windows.values());
    },
    order() {
      return order.slice();
    },
    zIndex(id) {
      return order.indexOf(id);
    },
    get focusedId() {
      return focusedId;
    },
    isRunning(id) {
      const record = windows.get(id);
      return !!record && record.state !== 'closed';
    },
    open(id) {
      const record = require(id);
      const previous = record.state;
      record.state = 'open';
      raise(id);
      setFocus(id);
      emit(previous === 'minimized' ? 'restore' : previous === 'open' ? 'raise' : 'open', id);
      return previous;
    },
    close(id) {
      const record = require(id);
      record.state = 'closed';
      record.snap = null;
      record.restore = null;
      if (focusedId === id) setFocus(topVisible(id));
      emit('close', id);
    },
    minimize(id) {
      const record = require(id);
      if (record.state !== 'open') return;
      record.state = 'minimized';
      if (focusedId === id) setFocus(topVisible(id));
      emit('minimize', id);
    },
    focus(id) {
      const record = require(id);
      if (record.state !== 'open') return;
      raise(id);
      setFocus(id);
      emit('raise', id);
    },
    setFrame(id, frame) {
      const record = require(id);
      record.frame = { ...record.frame, ...frame };
    },
    setSnap(id, zone, frame) {
      const record = require(id);
      if (!record.snap) record.restore = { ...record.frame };
      record.snap = zone;
      record.frame = { ...frame };
      emit('snap', id);
    },
    clearSnap(id) {
      const record = require(id);
      const restore = record.restore;
      record.snap = null;
      record.restore = null;
      emit('unsnap', id);
      return restore;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
