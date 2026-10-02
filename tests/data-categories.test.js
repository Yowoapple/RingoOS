import { beforeEach, describe, expect, it } from 'vitest';
import { Data } from '../src/core/data-model.js';

const DAY = '2026-10-02';

beforeEach(() => {
  Data.replaceStore(Data.createDefaultStore());
});

describe('categories', () => {
  it('renames a category in entries and every month of budgets', () => {
    Data.addExpenseEntry(DAY, { amount: 120, category: '餐飲', note: '' });
    Data.addExpenseEntry('2026-09-10', { amount: 80, category: '餐飲', note: '' });
    Data.setMonthlyBudget('2026-09', '餐飲', 5000);
    Data.setMonthlyBudget('2026-10', '餐飲', 6000);
    const result = Data.renameCategory('expense', '餐飲', '吃飯');
    expect(result).toEqual({ ok: true, count: 2 });
    const state = Data.getState();
    expect(state.settings.expenseCategories[0]).toBe('吃飯');
    expect(state.days[DAY].expenses[0].category).toBe('吃飯');
    expect(Data.getMonthlyBudgets('2026-09')).toEqual({ 吃飯: 5000 });
    expect(Data.getMonthlyBudgets('2026-10')).toEqual({ 吃飯: 6000 });
  });

  it('refuses empty, duplicate and fallback names', () => {
    expect(Data.renameCategory('expense', '餐飲', '  ').reason).toBe('empty');
    expect(Data.renameCategory('expense', '餐飲', '交通').reason).toBe('exists');
    expect(Data.renameCategory('expense', '其他', '雜項').reason).toBe('fallback');
    expect(Data.renameCategory('income', '不存在', 'x').reason).toBe('not-found');
  });

  it('reorders only when the set of names is the same', () => {
    const list = Data.getState().settings.incomeCategories.slice();
    expect(Data.setCategoryOrder('income', list.slice().reverse())).toBe(true);
    expect(Data.getState().settings.incomeCategories).toEqual(list.slice().reverse());
    expect(Data.setCategoryOrder('income', ['薪資'])).toBe(false);
    expect(Data.setCategoryOrder('income', [...list.slice(1), '薪資X'])).toBe(false);
  });

  it('restores a removed category with its entries and budgets', () => {
    Data.addExpenseEntry(DAY, { amount: 300, category: '娛樂', note: '' });
    Data.setMonthlyBudget('2026-10', '娛樂', 2000);
    const before = Data.getState().settings.expenseCategories.slice();
    const result = Data.removeCategory('expense', '娛樂');
    expect(result.ok).toBe(true);
    expect(Data.getState().days[DAY].expenses[0].category).toBe('其他');
    expect(Data.restoreCategory(result.snapshot)).toBe(true);
    expect(Data.getState().settings.expenseCategories).toEqual(before);
    expect(Data.getState().days[DAY].expenses[0].category).toBe('娛樂');
    expect(Data.getMonthlyBudgets('2026-10')).toEqual({ 娛樂: 2000 });
  });

  it('only moves back entries that are still in the fallback category', () => {
    Data.addExpenseEntry(DAY, { amount: 300, category: '娛樂', note: '' });
    const { snapshot } = Data.removeCategory('expense', '娛樂');
    const entry = Data.getState().days[DAY].expenses[0];
    Data.updateEntry(DAY, 'expense', entry.id, { category: '交通' });
    Data.restoreCategory(snapshot);
    expect(Data.getState().days[DAY].expenses[0].category).toBe('交通');
  });
});

describe('budgets and goals', () => {
  it('copies last month budgets without overwriting ones already set', () => {
    Data.setMonthlyBudget('2026-09', '餐飲', 5000);
    Data.setMonthlyBudget('2026-09', '交通', 1200);
    Data.setMonthlyBudget('2026-10', '交通', 900);
    expect(Data.copyMonthlyBudgets('2026-09', '2026-10')).toBe(1);
    expect(Data.getMonthlyBudgets('2026-10')).toEqual({ 交通: 900, 餐飲: 5000 });
    expect(Data.copyMonthlyBudgets('2026-09', '2026-10', { overwrite: true })).toBe(2);
    expect(Data.getMonthlyBudgets('2026-10').交通).toBe(1200);
  });

  it('puts a removed goal back in place once', () => {
    Data.addSavingsGoal({ title: 'A', targetAmount: 1000 });
    Data.addSavingsGoal({ title: 'B', targetAmount: 2000 });
    const goal = Data.getState().settings.savingsGoals[0];
    Data.removeSavingsGoal(goal.id);
    expect(Data.restoreSavingsGoal(goal, 0)).toBe(true);
    expect(Data.restoreSavingsGoal(goal, 0)).toBe(false);
    expect(Data.getState().settings.savingsGoals.map((g) => g.title)).toEqual(['A', 'B']);
  });
});
