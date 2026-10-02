import { describe, expect, it } from 'vitest';
import { cumulative, monthKeysBack, paceSeries, slices } from '../src/apps/overview/series.js';

describe('pace series', () => {
  it('adds up spending, stops at today and projects the period end', () => {
    expect(cumulative([100, 0, 50])).toEqual([100, 100, 150]);
    const out = paceSeries({ daily: [100, 0, 50, 0, 0, 0], previousDaily: [10, 10, 10, 10, 10, 10, 10], todayIndex: 2, budget: 500 });
    expect(out.values).toEqual([100, 100, 150, null, null, null]);
    expect(out.prev).toEqual([10, 20, 30, 40, 50, 60]);
    expect(out.projection).toBe(300);
    expect(out.max).toBe(500);
  });

  it('shows a finished period whole without a projection', () => {
    const out = paceSeries({ daily: [10, 20], todayIndex: -1 });
    expect(out.values).toEqual([10, 30]);
    expect(out.projection).toBeNull();
    expect(out.max).toBe(30);
  });
});

describe('category slices', () => {
  it('keeps the biggest categories and folds the rest into one slice', () => {
    const out = slices({ 餐飲: 500, 交通: 200, 娛樂: 100, 醫療: 0, 教育: 50, 居住: 30, 其他: 20 }, 4);
    expect(out.total).toBe(900);
    expect(out.items.map((s) => s.id)).toEqual(['餐飲', '交通', '娛樂', '教育', '__rest']);
    expect(out.items[4]).toMatchObject({ amount: 50, category: '其餘 2 項', rest: ['居住', '其他'] });
    expect(slices({}).items).toEqual([]);
  });
});

describe('month keys', () => {
  it('walks back across the year boundary', () => {
    expect(monthKeysBack('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});
