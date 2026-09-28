import { describe, expect, it } from 'vitest';
import { createWindowStore } from '../src/wm/store.js';
import { SESSION_VERSION, sanitizeSession, serializeSession } from '../src/wm/session.js';

const IDS = ['a', 'b', 'c'];

function makeStore() {
  const store = createWindowStore();
  IDS.forEach((id) => store.register({ id, title: id, frame: { x: null, y: null, w: 400, h: 300 }, min: { w: 300, h: 200 } }));
  return store;
}

describe('serializeSession', () => {
  it('captures state, frames, snapping and order', () => {
    const store = makeStore();
    store.setFrame('a', { x: 10, y: 20 });
    store.open('a');
    store.setFrame('b', { x: 30, y: 40 });
    store.open('b');
    store.setSnap('b', 'left', { x: 0, y: 0, w: 600, h: 700 });
    store.minimize('a');
    const session = serializeSession(store);
    expect(session.version).toBe(SESSION_VERSION);
    expect(session.windows.a).toEqual({ state: 'minimized', frame: { x: 10, y: 20, w: 400, h: 300 }, snap: null, restore: null });
    expect(session.windows.b).toEqual({ state: 'open', frame: { x: 0, y: 0, w: 600, h: 700 }, snap: 'left', restore: { x: 30, y: 40, w: 400, h: 300 } });
    expect(session.windows.c).toEqual({ state: 'closed', frame: null, snap: null, restore: null });
    expect(session.order.slice(-2)).toEqual(['a', 'b']);
    expect(session.focused).toBe('b');
  });

  it('survives a JSON round trip unchanged', () => {
    const store = makeStore();
    store.setFrame('c', { x: 1, y: 2 });
    store.open('c');
    const session = serializeSession(store);
    expect(sanitizeSession(JSON.parse(JSON.stringify(session)), IDS)).toEqual(session);
  });
});

describe('sanitizeSession', () => {
  it('rejects missing or foreign data', () => {
    expect(sanitizeSession(null, IDS)).toBeNull();
    expect(sanitizeSession({ version: 99, windows: {} }, IDS)).toBeNull();
    expect(sanitizeSession({ version: SESSION_VERSION }, IDS)).toBeNull();
  });

  it('drops unknown apps and repairs broken entries', () => {
    const session = sanitizeSession({
      version: SESSION_VERSION,
      order: ['ghost', 'b', 'b', 'a'],
      focused: 'ghost',
      windows: {
        ghost: { state: 'open', frame: { x: 0, y: 0, w: 10, h: 10 } },
        a: { state: 'open', frame: { x: 'no', y: 0, w: 10, h: 10 } },
        b: { state: 'weird', frame: { x: 5, y: 5, w: 300, h: 200 }, snap: 'diagonal' },
      },
    }, IDS);
    expect(Object.keys(session.windows).sort()).toEqual(['a', 'b']);
    expect(session.windows.a.state).toBe('closed');
    expect(session.windows.b).toEqual({ state: 'closed', frame: { x: 5, y: 5, w: 300, h: 200 }, snap: null, restore: null });
    expect(session.order).toEqual(['b', 'a', 'c']);
    expect(session.focused).toBeNull();
  });

  it('keeps a snapped window even without a stored frame', () => {
    const session = sanitizeSession({ version: SESSION_VERSION, order: ['a'], focused: 'a', windows: { a: { state: 'open', frame: null, snap: 'max', restore: { x: 1, y: 1, w: 400, h: 300 } } } }, IDS);
    expect(session.windows.a).toEqual({ state: 'open', frame: null, snap: 'max', restore: { x: 1, y: 1, w: 400, h: 300 } });
    expect(session.focused).toBe('a');
  });
});
