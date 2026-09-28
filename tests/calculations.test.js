import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Data } from '../src/core/data-model.js';
import { Calc } from '../src/core/calculations.js';

function fixture() {
  return {
    meta: {},
    settings: {
      incomeCategories: ['薪資'],
      expenseCategories: ['餐飲', '交通', '娛樂', '其他'],
      monthlyBudgets: { '2026-09': { 餐飲: 6000, 娛樂: 1000 } },
      savingsGoals: [],
      taskReminderLookaheadDays: 1,
    },
    days: {
      '2026-07-01': { income: [{ id: 'a', amount: 30000, category: '薪資' }], expenses: [] },
      '2026-07-05': { income: [], expenses: [{ id: 'b', amount: 40000, category: '交通' }] },
      '2026-08-01': { income: [{ id: 'c', amount: 30000, category: '薪資' }], expenses: [] },
      '2026-08-10': { income: [], expenses: [{ id: 'd', amount: 5000, category: '餐飲' }] },
      '2026-09-01': { income: [{ id: 'e', amount: 30000, category: '薪資' }], expenses: [] },
      '2026-09-02': { income: [], expenses: [{ id: 'f', amount: 3000, category: '餐飲', necessity: 'need' }] },
      '2026-09-10': { income: [], expenses: [{ id: 'g', amount: 1200, category: '娛樂', necessity: 'want' }] },
      '2026-09-15': { income: [], expenses: [], tasks: [{ id: 't1', text: 'x', done: false }, { id: 't2', text: 'y', done: true }] },
      '2026-09-16': { income: [], expenses: [], tasks: [{ id: 't3', text: 'z', done: false }] },
      '2026-09-17': { income: [], expenses: [], tasks: [{ id: 't4', text: 'w', done: false }] },
      '2026-09-20': { income: [], expenses: [{ id: 'h', amount: 1500, category: '餐飲' }] },
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 0));
  Data.replaceStore(fixture());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('date ranges', () => {
  it('lists every day of a month, including leap years', () => {
    expect(Calc.getMonthDateKeys('2026-09')).toHaveLength(30);
    expect(Calc.getMonthDateKeys('2026-02')).toHaveLength(28);
    expect(Calc.getMonthDateKeys('2024-02')).toHaveLength(29);
  });

  it('builds Monday-to-Sunday weeks', () => {
    const week = Calc.getWeekDateKeys('2026-10-01');
    expect(week[0]).toBe('2026-09-28');
    expect(week[6]).toBe('2026-10-04');
  });

  it('steps back across year boundaries', () => {
    expect(Calc.getPreviousMonthKey('2026-01')).toBe('2025-12');
    expect(Calc.shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('status rules', () => {
  it('grades budget usage at 70% and 100%', () => {
    expect(Calc.getBudgetStatus(699, 1000).status).toBe('safe');
    expect(Calc.getBudgetStatus(700, 1000).status).toBe('warning');
    expect(Calc.getBudgetStatus(1000, 1000).status).toBe('danger');
    expect(Calc.getBudgetStatus(500, 0).status).toBe('no-budget');
  });

  it('grades net balance with a 10% tolerance', () => {
    expect(Calc.getNetStatus(100, 100).status).toBe('positive');
    expect(Calc.getNetStatus(1000, 1100).status).toBe('warning');
    expect(Calc.getNetStatus(1000, 1101).status).toBe('danger');
    expect(Calc.getNetStatus(0, 10).status).toBe('danger');
  });
});

describe('month summary', () => {
  it('totals income, expenses and budget alerts', () => {
    const month = Calc.computeMonthSummary('2026-09');
    expect(month).toMatchObject({ income: 30000, expense: 5700, net: 24300, status: 'positive', overBudgetCount: 1, watchBudgetCount: 1 });
    expect(month.expenseByCategory).toEqual({ 餐飲: 4500, 娛樂: 1200 });
  });

  it('computes the want ratio from tagged expenses only', () => {
    expect(Calc.computeMonthSummary('2026-09').necessityBreakdown).toEqual({ want: 1200, need: 3000, unspecified: 1500, wantRatio: 29 });
  });

  it('projects month-end spending from the pace so far', () => {
    expect(Calc.getMidMonthProjection('2026-09')).toMatchObject({
      applicable: true, dayOfMonth: 15, daysInMonth: 30, currentExpense: 4200, projectedExpense: 8400, totalBudget: 7000, overProjected: true,
    });
    expect(Calc.getMidMonthProjection('2026-08').applicable).toBe(false);
  });

  it('compares against the previous month and finds the category driver', () => {
    const comparison = Calc.getMonthComparison('2026-09');
    expect(comparison).toMatchObject({ hasPrevious: true, previousExpense: 5000, currentExpense: 5700, diff: 700 });
    expect(Calc.getCategoryDriver(comparison.currentByCategory, comparison.previousByCategory)).toMatchObject({ category: '娛樂', mode: 'increase' });
  });

  it('counts consecutive positive months before the current one', () => {
    expect(Calc.getConsecutiveGoodMonths('2026-09')).toBe(1);
  });
});

describe('goals and tasks', () => {
  it('projects months remaining from monthly deposit averages', () => {
    const goal = { targetAmount: 10000, currentAmount: 3000, deposits: [{ amount: 1000, monthKey: '2026-08' }, { amount: 2000, monthKey: '2026-09' }] };
    expect(Calc.getGoalProjection(goal)).toMatchObject({ hasHistory: true, avgMonthly: 1500, remaining: 7000, monthsRemaining: 5 });
    expect(Calc.getGoalProjection({ targetAmount: 100, currentAmount: 0 })).toEqual({ hasHistory: false, remaining: 100 });
  });

  it('counts unfinished tasks within the lookahead window', () => {
    expect(Calc.getUpcomingTaskSummary()).toEqual({
      count: 2,
      days: [
        { dateKey: '2026-09-15', pendingCount: 1, isToday: true },
        { dateKey: '2026-09-16', pendingCount: 1, isToday: false },
      ],
    });
  });
});
