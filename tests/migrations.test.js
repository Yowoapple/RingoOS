import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA, createDefaultLedger, detectSchema, migrateLedger } from '../src/core/migrations.js';

function legacyLedger() {
  return {
    meta: { version: '0.1.0', createdAt: '2026-05-01T00:00:00.000Z', lastModified: '2026-07-01T00:00:00.000Z' },
    settings: {
      currency: 'TWD',
      incomeCategories: ['薪資'],
      expenseCategories: ['餐飲', '寵物', '其他'],
      monthlyBudgets: { '2026-09': { 餐飲: 6000 } },
      savingsGoals: [{ id: 'g1', title: '旅行', targetAmount: 30000, currentAmount: 500, deadline: null }],
    },
    days: {
      '2026-09-01': { income: [{ id: 'i1', amount: 30000, category: '薪資', note: '' }], expenses: [] },
      '2026-09-28': {
        income: [],
        expenses: [{ id: 'e1', amount: 650, category: '寵物', note: '飼料', recurring: true, necessity: 'need' }],
        tasks: [
          { id: 't1', text: 'a', done: false, time: '15:00', durationMinutes: 90, reminderMinutes: 30 },
          { id: 't2', text: 'b', done: true, time: null, reminderMinutes: null },
          { id: 't3', text: 'c', done: false, time: null, durationMinutes: 0 },
          { id: 't4', text: 'd', done: false, time: '09:00', durationChoice: 'allday', reminderLead: '1D', durationMinutes: 45, reminderMinutes: 5 },
        ],
      },
    },
    wallpaper: { dataUrl: 'data:image/jpeg;base64,AAAA', opacity: 60, blur: 6 },
  };
}

describe('detectSchema', () => {
  it('treats documents without an integer schema as schema 1', () => {
    expect(detectSchema(legacyLedger())).toBe(1);
    expect(detectSchema({ meta: { schema: '2' } })).toBe(1);
    expect(detectSchema({ meta: { schema: 2 } })).toBe(2);
  });
});

describe('migrateLedger', () => {
  it('upgrades a legacy ledger to the current schema', () => {
    const result = migrateLedger(legacyLedger());
    expect(result.meta.schema).toBe(CURRENT_SCHEMA);
    expect(result.meta.createdWith).toBe('RingoOS by YoWoRingo');
    expect(result.meta.createdAt).toBe('2026-05-01T00:00:00.000Z');
    expect(result.meta.lastModified).toBe('2026-07-01T00:00:00.000Z');
  });

  it('converts legacy task fields exactly like the calendar display did', () => {
    const [t1, t2, t3, t4] = migrateLedger(legacyLedger()).days['2026-09-28'].tasks;
    expect(t1).toMatchObject({ durationChoice: '90', reminderLead: '30M' });
    expect(t2.reminderLead).toBe('none');
    expect(t3.durationChoice).toBeUndefined();
    expect(t3.reminderLead).toBeUndefined();
    expect(t4).toMatchObject({ durationChoice: 'allday', reminderLead: '1D' });
    [t1, t2, t3, t4].forEach((task) => {
      expect(task).not.toHaveProperty('durationMinutes');
      expect(task).not.toHaveProperty('reminderMinutes');
    });
  });

  it('fills missing arrays and goal fields without touching user data', () => {
    const result = migrateLedger(legacyLedger());
    expect(result.days['2026-09-01'].tasks).toEqual([]);
    expect(result.settings.expenseCategories).toEqual(['餐飲', '寵物', '其他']);
    expect(result.settings.monthlyBudgets).toEqual({});
    expect(result.settings.budgetPlans).toEqual([{ since: '2026-09', amounts: { 餐飲: 6000 } }]);
    expect(result.settings.recurring).toEqual([]);
    expect(result.settings.taskReminderLookaheadDays).toBe(1);
    expect(result.settings.savingsGoals[0]).toEqual({
      id: 'g1', title: '旅行', targetAmount: 30000, currentAmount: 500, deadline: null,
      autoSavePercent: null, lastAutoSaveMonth: null, deposits: [],
    });
  });

  it('removes the embedded wallpaper from the ledger document', () => {
    expect(migrateLedger(legacyLedger())).not.toHaveProperty('wallpaper');
  });

  it('does not mutate its input', () => {
    const input = legacyLedger();
    const snapshot = structuredClone(input);
    migrateLedger(input);
    expect(input).toEqual(snapshot);
  });

  it('is idempotent', () => {
    const once = migrateLedger(legacyLedger());
    expect(migrateLedger(once)).toEqual(once);
  });

  it('rejects documents that are not ledgers', () => {
    expect(() => migrateLedger(null)).toThrow('INVALID_LEDGER');
    expect(() => migrateLedger({ days: {} })).toThrow('INVALID_LEDGER');
  });

  it('rejects documents from a newer schema', () => {
    expect(() => migrateLedger({ meta: { schema: CURRENT_SCHEMA + 1 }, settings: {}, days: {} })).toThrow('NEWER_SCHEMA');
  });
});

describe('createDefaultLedger', () => {
  it('creates a ledger already at the current schema', () => {
    const ledger = createDefaultLedger();
    expect(detectSchema(ledger)).toBe(CURRENT_SCHEMA);
    expect(migrateLedger(ledger)).toEqual(ledger);
  });
});
