import { beforeEach, describe, expect, it } from 'vitest';
import { Data } from '../src/core/data-model.js';
import { buildInsight, tokensToText } from '../src/apps/reminder/insight.js';

const TODAY = '2026-09-10';

function spend(date, amount, category = '餐飲') {
  Data.addExpenseEntry(date, { amount, category, note: '' });
}

function earn(date, amount) {
  Data.addIncomeEntry(date, { amount, category: '薪資', note: '' });
}

function texts(insight) {
  return insight.details.map(tokensToText);
}

beforeEach(() => {
  Data.replaceStore(Data.createDefaultStore());
});

describe('lead and voice', () => {
  it('invites a first entry on an empty current month', () => {
    const insight = buildInsight({ mode: 'month', anchorKey: TODAY, todayKey: TODAY });
    expect(insight.status).toBe('empty');
    expect(insight.label).toBe('尚無記錄');
    expect(insight.sub).toBeTruthy();
    expect(insight.clues).toEqual([]);
    expect(insight.details).toEqual([]);
  });

  it('names a past month and drops the advice', () => {
    earn('2026-08-03', 5000);
    spend('2026-08-04', 1200);
    const insight = buildInsight({ mode: 'month', anchorKey: '2026-08-31', todayKey: TODAY });
    expect(insight.current).toBe(false);
    expect(insight.sub).toBe(null);
    expect(insight.status).toBe('positive');
    expect(insight.lead).not.toContain('{p}');
    expect(insight.lead.includes('8 月') || !insight.lead.includes('這個月')).toBe(true);
  });

  it('speaks in the chosen persona and stays stable for the same period', () => {
    const plain = buildInsight({ mode: 'month', anchorKey: TODAY, todayKey: TODAY });
    const maid = buildInsight({ mode: 'month', anchorKey: TODAY, todayKey: TODAY, persona: 'maid' });
    expect(maid.lead + maid.sub).not.toBe(plain.lead + plain.sub);
    expect(buildInsight({ mode: 'month', anchorKey: '2026-09-02', todayKey: TODAY, persona: 'maid' }).lead).toBe(maid.lead);
  });

  it('uses this week for the current week', () => {
    const insight = buildInsight({ mode: 'week', anchorKey: TODAY, todayKey: TODAY });
    expect(insight.keys).toHaveLength(7);
    expect(insight.lead.includes('這週') || !insight.lead.includes('{p}')).toBe(true);
  });
});

describe('evidence', () => {
  it('compares against the same stretch of last month', () => {
    earn('2026-09-01', 50000);
    spend('2026-08-05', 1000);
    spend('2026-08-20', 5000);
    spend('2026-09-05', 3000);
    const insight = buildInsight({ mode: 'month', anchorKey: TODAY, todayKey: TODAY });
    const compare = insight.clues.find((clue) => clue.id === 'compare');
    expect(compare.label).toBe('比上月同期');
    expect(tokensToText(compare.value)).toBe('+2,000');
    expect(texts(insight)).toContain('比上月同期多花了 NT$ 2,000。');
  });

  it('flags categories over budget and a projected overspend', () => {
    Data.setMonthlyBudget('2026-09', '餐飲', 1000);
    earn('2026-09-01', 50000);
    spend('2026-09-02', 1500);
    const insight = buildInsight({ mode: 'month', anchorKey: TODAY, todayKey: TODAY });
    expect(insight.status).toBe('positive');
    expect(insight.label).toBe('推估超支');
    expect(insight.tone).toBe('alert');
    expect(texts(insight)[0]).toBe('「餐飲」超出預算 NT$ 500。');
    expect(texts(insight)[1]).toBe('照這 10 天的速度，月底約 NT$ 4,500，會比預算多 NT$ 3,500。');
    const budget = insight.clues.find((clue) => clue.id === 'budget');
    expect(tokensToText(budget.value)).toBe('150%');
    expect(budget.accent).toBe(true);
  });

  it('celebrates a streak of positive months', () => {
    ['2026-06-02', '2026-07-02', '2026-08-02', '2026-09-02'].forEach((date) => {
      earn(date, 3000);
      spend(date, 1000);
    });
    const insight = buildInsight({ mode: 'month', anchorKey: TODAY, todayKey: TODAY });
    expect(texts(insight)[0]).toBe('已經連續 3 個月收支為正。');
    const streak = insight.clues.find((clue) => clue.id === 'streak');
    expect(streak.target.anchorKey).toBe('2026-08-31');
  });

  it('keeps month-only evidence out of the week view', () => {
    Data.setMonthlyBudget('2026-09', '餐飲', 3000);
    spend('2026-09-08', 400);
    const insight = buildInsight({ mode: 'week', anchorKey: TODAY, todayKey: TODAY });
    const ids = insight.clues.map((clue) => clue.id);
    expect(ids).not.toContain('projection');
    expect(ids).not.toContain('goal');
    expect(insight.clues.find((clue) => clue.id === 'budget').label).toBe('週預算用了');
  });
});
