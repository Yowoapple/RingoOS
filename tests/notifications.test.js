import { beforeEach, describe, expect, it } from 'vitest';
import { Storage } from '../src/core/storage/storage.js';
import { HISTORY_KEY, PREFS_KEY, SENT_KEY, createNotifier } from '../src/shell/notifications.js';

let clock = new Date('2026-10-02T12:00:00');
const shown = [];

function make() {
  shown.length = 0;
  return createNotifier({ onShow: (item) => shown.push(item), now: () => clock });
}

const candidate = (key, extra = {}) => ({ key, app: 'weather', kind: 'weather', title: key, body: '', ...extra });

beforeEach(() => {
  Storage.remove(PREFS_KEY);
  Storage.remove(HISTORY_KEY);
  Storage.remove(SENT_KEY);
  clock = new Date('2026-10-02T12:00:00');
});

describe('notifier', () => {
  it('records, shows and never repeats the same key', () => {
    const notifier = make();
    expect(notifier.notify(candidate('a'))).not.toBeNull();
    expect(notifier.notify(candidate('a'))).toBeNull();
    expect(notifier.history).toHaveLength(1);
    expect(notifier.unread).toBe(1);
    expect(shown).toHaveLength(1);
    expect(Storage.get(HISTORY_KEY)).toHaveLength(1);
  });

  it('marks covered keys as sent', () => {
    const notifier = make();
    notifier.notify(candidate('budget-100', { covers: ['budget-80'] }));
    expect(notifier.wasSent('budget-80')).toBe(true);
    expect(notifier.notify(candidate('budget-80'))).toBeNull();
  });

  it('keeps notifications quiet during do not disturb but still records them', () => {
    const notifier = make();
    notifier.setPrefs({ dnd: { on: true } });
    notifier.notify(candidate('b'));
    expect(shown).toHaveLength(0);
    expect(notifier.unread).toBe(1);
  });

  it('skips kinds the user turned off without burning the key', () => {
    const notifier = make();
    notifier.setPrefs({ kinds: { weather: false } });
    expect(notifier.notify(candidate('c'))).toBeNull();
    expect(notifier.wasSent('c')).toBe(false);
    notifier.setPrefs({ kinds: { weather: true } });
    expect(notifier.notify(candidate('c'))).not.toBeNull();
  });

  it('keeps the daily reminder off by default', () => {
    const notifier = make();
    expect(notifier.notify(candidate('d', { kind: 'daily' }))).toBeNull();
  });

  it('caps history at 50 and supports read, remove and clear', () => {
    const notifier = make();
    for (let i = 0; i < 55; i += 1) notifier.notify(candidate(`k${i}`));
    expect(notifier.history).toHaveLength(50);
    expect(notifier.history[0].key).toBe('k54');
    notifier.markAllRead();
    expect(notifier.unread).toBe(0);
    notifier.remove(notifier.history[0].id);
    expect(notifier.history).toHaveLength(49);
    notifier.clear();
    expect(notifier.history).toHaveLength(0);
    expect(notifier.notify(candidate('k1'))).toBeNull();
  });

  it('forgets sent keys after 45 days', () => {
    const notifier = make();
    notifier.notify(candidate('old'));
    clock = new Date('2026-11-20T12:00:00');
    notifier.notify(candidate('new'));
    expect(notifier.wasSent('old')).toBe(false);
  });
});
