import { describe, expect, it } from 'vitest';
import { collect, isFiltered, parseQuery, search } from '../src/apps/ledger/search.js';

const state = {
  days: {
    '2026-08-12': { income: [], expenses: [{ id: 'a', amount: 120, category: '餐飲', note: '午餐便當', createdAt: 1 }] },
    '2026-10-01': {
      income: [{ id: 'b', amount: 30000, category: '薪資', note: '', createdAt: 2 }],
      expenses: [
        { id: 'c', amount: 12000, category: '居住', note: '房租', recurring: true, createdAt: 3 },
        { id: 'd', amount: 1200, category: '交通', note: '捷運卡儲值', createdAt: 4 },
      ],
    },
    '2026-10-03': { income: [], expenses: [{ id: 'e', amount: 85, category: '餐飲', note: '午餐', createdAt: 5 }] },
  },
};
const transfers = [{ id: 't', dateKey: '2026-10-02', amount: 5000, signed: 5000, type: 'manual', goalId: 'g', goalTitle: '旅行', date: '2026-10-02T03:00:00.000Z' }];
const items = collect(state, transfers);
const TODAY = '2026-10-03';

describe('ledger search', () => {
  it('matches notes and categories, newest first, grouped by month with totals', () => {
    const out = search(items, { q: '午餐' }, TODAY);
    expect(out.results.map((r) => r.id)).toEqual(['e', 'a']);
    expect(out.groups.map((g) => [g.monthKey, g.sum])).toEqual([['2026-10', -85], ['2026-08', -120]]);
    expect(out.total).toBe(-205);
  });

  it('treats a number as an amount or text and supports comparisons', () => {
    expect(search(items, { q: '1200' }, TODAY).results.map((r) => r.id)).toEqual(['d']);
    expect(search(items, { q: '1,200' }, TODAY).results.map((r) => r.id)).toEqual(['d']);
    expect(search(items, { q: '>10000' }, TODAY).results.map((r) => r.id).sort()).toEqual(['b', 'c']);
    expect(parseQuery('<= 50')[0]).toEqual({ text: '<=' });
    expect(parseQuery('<=50')[0]).toEqual({ op: '<=', value: 50 });
  });

  it('filters by kind, period, categories, amount range and fixed expenses', () => {
    expect(search(items, { kind: 'income' }, TODAY).results.map((r) => r.id)).toEqual(['b']);
    expect(search(items, { kind: 'transfer' }, TODAY).total).toBe(0);
    expect(search(items, { period: 'month' }, TODAY).count).toBe(5);
    expect(search(items, { period: 'quarter' }, TODAY).count).toBe(6);
    expect(search(items, { categories: ['餐飲', '交通'] }, TODAY).results.map((r) => r.id)).toEqual(['e', 'd', 'a']);
    expect(search(items, { min: 100, max: 2000 }, TODAY).results.map((r) => r.id)).toEqual(['d', 'a']);
    expect(search(items, { fixed: true }, TODAY).results.map((r) => r.id)).toEqual(['c']);
    expect(search(items, { q: '旅行' }, TODAY).results.map((r) => r.kind)).toEqual(['transfer']);
  });

  it('limits results to a date range handed over from the overview', () => {
    const out = search(items, { period: 'range', range: { from: '2026-10-01', to: '2026-10-02', label: '10/01—10/02' } }, TODAY);
    expect(out.results.map((r) => r.id).sort()).toEqual(['b', 'c', 'd', 't']);
  });

  it('knows when any filter is on', () => {
    expect(isFiltered({})).toBe(false);
    expect(isFiltered({ q: '  ' })).toBe(false);
    expect(isFiltered({ categories: ['餐飲'] })).toBe(true);
  });
});
