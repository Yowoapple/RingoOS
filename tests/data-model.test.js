import { beforeEach, describe, expect, it } from 'vitest';
import { Data } from '../src/core/data-model.js';

const DAY = '2026-09-29';

beforeEach(() => {
  Data.replaceStore(Data.createDefaultStore());
});

describe('entries', () => {
  it('stamps new entries with a creation time', () => {
    Data.addExpenseEntry(DAY, { amount: 120, category: '餐飲', note: '午餐' });
    const [entry] = Data.getDayEntries(DAY).expenses;
    expect(typeof entry.createdAt).toBe('number');
    expect(entry.recurring).toBe(false);
    expect(entry.necessity).toBe(null);
  });

  it('restores a removed entry at its original position with the same id', () => {
    Data.addExpenseEntry(DAY, { amount: 1, category: '餐飲' });
    Data.addExpenseEntry(DAY, { amount: 2, category: '交通' });
    Data.addExpenseEntry(DAY, { amount: 3, category: '娛樂' });
    const removed = { ...Data.getDayEntries(DAY).expenses[1] };
    const index = Data.getEntryIndex(DAY, 'expense', removed.id);
    Data.removeEntry(DAY, 'expense', removed.id);
    expect(Data.getDayEntries(DAY).expenses.map((e) => e.amount)).toEqual([1, 3]);
    expect(Data.restoreEntry(DAY, 'expense', removed, index)).toBe(true);
    expect(Data.getDayEntries(DAY).expenses.map((e) => e.amount)).toEqual([1, 2, 3]);
    expect(Data.getDayEntries(DAY).expenses[1].id).toBe(removed.id);
  });

  it('does not restore the same entry twice', () => {
    Data.addIncomeEntry(DAY, { amount: 500, category: '薪資' });
    const entry = { ...Data.getDayEntries(DAY).income[0] };
    expect(Data.restoreEntry(DAY, 'income', entry, 0)).toBe(false);
    expect(Data.getDayEntries(DAY).income).toHaveLength(1);
  });

  it('restores into a day that no longer exists', () => {
    const entry = { id: 'id-x', amount: 80, category: '其他', note: '' };
    expect(Data.restoreEntry('2026-01-01', 'expense', entry, 5)).toBe(true);
    expect(Data.getDayEntries('2026-01-01').expenses[0]).toMatchObject({ id: 'id-x', amount: 80, recurring: false, necessity: null });
  });

  it('updates an entry in place', () => {
    Data.addExpenseEntry(DAY, { amount: 100, category: '餐飲', note: '' });
    const { id } = Data.getDayEntries(DAY).expenses[0];
    const result = Data.updateEntry(DAY, 'expense', id, { amount: 150, note: '晚餐', necessity: 'want' });
    expect(result.type).toBe('expense');
    expect(Data.getDayEntries(DAY).expenses[0]).toMatchObject({ id, amount: 150, note: '晚餐', necessity: 'want' });
  });

  it('moves an entry to the other list when its type changes and drops expense-only fields', () => {
    Data.addExpenseEntry(DAY, { amount: 300, category: '其他', recurring: true, necessity: 'need' });
    const { id } = Data.getDayEntries(DAY).expenses[0];
    const result = Data.updateEntry(DAY, 'expense', id, { type: 'income', category: '獎金' });
    expect(result.type).toBe('income');
    expect(Data.getDayEntries(DAY).expenses).toHaveLength(0);
    const moved = Data.getDayEntries(DAY).income[0];
    expect(moved).toMatchObject({ id, amount: 300, category: '獎金' });
    expect(moved).not.toHaveProperty('recurring');
    expect(moved).not.toHaveProperty('necessity');
  });

  it('returns null when updating an unknown entry', () => {
    expect(Data.updateEntry(DAY, 'expense', 'missing', { amount: 1 })).toBe(null);
  });
});

describe('changes from another tab', () => {
  it('reloads the ledger from storage and notifies without saving over it', async () => {
    const { Storage } = await import('../src/core/storage/storage.js');
    Data.addExpenseEntry(DAY, { amount: 10, category: '餐飲' });
    const external = JSON.parse(JSON.stringify(Data.getState()));
    external.days[DAY].expenses.push({ id: 'from-other-tab', amount: 99, category: '交通', note: '', recurring: false, necessity: null });
    external.meta.lastModified = '2000-01-01T00:00:00.000Z';
    Storage.set('yoworingo.ledger', external);
    let calls = 0;
    const stop = Data.subscribe(() => { calls += 1; });
    expect(Data.reloadFromStorage()).toBe(true);
    stop();
    expect(calls).toBe(1);
    expect(Data.getDayEntries(DAY).expenses.map((e) => e.amount)).toEqual([10, 99]);
    expect(Storage.get('yoworingo.ledger').meta.lastModified).toBe('2000-01-01T00:00:00.000Z');
  });
});
