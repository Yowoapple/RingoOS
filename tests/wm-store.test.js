import { describe, expect, it } from 'vitest';
import { createWindowStore } from '../src/wm/store.js';

function setup() {
  const store = createWindowStore();
  ['a', 'b', 'c'].forEach((id, i) => store.register({ id, title: id, frame: { x: i * 10, y: 0, w: 400, h: 300 }, min: { w: 320, h: 220 } }));
  const events = [];
  store.subscribe((event) => events.push(`${event.type}:${event.id}`));
  return { store, events };
}

describe('window store', () => {
  it('starts with every window closed', () => {
    const { store } = setup();
    expect(store.all().every((w) => w.state === 'closed')).toBe(true);
    expect(store.focusedId).toBeNull();
  });

  it('raises and focuses opened windows', () => {
    const { store, events } = setup();
    store.open('a');
    store.open('b');
    expect(store.order().slice(-2)).toEqual(['a', 'b']);
    expect(store.focusedId).toBe('b');
    expect(events).toContain('open:a');
  });

  it('focus moves a window to the top', () => {
    const { store } = setup();
    store.open('a');
    store.open('b');
    store.focus('a');
    expect(store.order().at(-1)).toBe('a');
    expect(store.focusedId).toBe('a');
  });

  it('passes focus to the next visible window on minimize and close', () => {
    const { store } = setup();
    store.open('a');
    store.open('b');
    store.open('c');
    store.minimize('c');
    expect(store.focusedId).toBe('b');
    store.close('b');
    expect(store.focusedId).toBe('a');
    store.close('a');
    expect(store.focusedId).toBeNull();
  });

  it('reports restore when reopening a minimized window', () => {
    const { store, events } = setup();
    store.open('a');
    store.minimize('a');
    expect(store.isRunning('a')).toBe(true);
    expect(store.open('a')).toBe('minimized');
    expect(events.at(-1)).toBe('restore:a');
  });

  it('remembers the frame from before snapping', () => {
    const { store } = setup();
    store.open('a');
    store.setFrame('a', { x: 50, y: 60, w: 500, h: 350 });
    store.setSnap('a', 'left', { x: 0, y: 0, w: 600, h: 700 });
    store.setSnap('a', 'max', { x: 0, y: 0, w: 1200, h: 700 });
    expect(store.get('a').frame).toEqual({ x: 0, y: 0, w: 1200, h: 700 });
    expect(store.clearSnap('a')).toEqual({ x: 50, y: 60, w: 500, h: 350 });
    expect(store.get('a').snap).toBeNull();
  });

  it('forgets snapping when a window is closed', () => {
    const { store } = setup();
    store.open('a');
    store.setSnap('a', 'right', { x: 600, y: 0, w: 600, h: 700 });
    store.close('a');
    expect(store.get('a').snap).toBeNull();
    expect(store.isRunning('a')).toBe(false);
  });

  it('announces frame changes so the session can be saved', () => {
    const { store, events } = setup();
    store.setFrame('a', { x: 5 });
    expect(events).toEqual(['frame:a']);
    expect(store.get('a').frame.x).toBe(5);
  });

  it('ignores minimize and focus for windows that are not open', () => {
    const { store, events } = setup();
    store.minimize('a');
    store.focus('a');
    expect(events).toEqual([]);
  });
});
