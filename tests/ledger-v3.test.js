import { beforeEach, describe, expect, it } from 'vitest';
import { Data } from '../src/core/data-model.js';
import { migrateLedger } from '../src/core/migrations.js';
import { Calc } from '../src/core/calculations.js';

beforeEach(() => {
  Data.replaceStore(Data.createDefaultStore());
});

function v2(patch = {}) {
  return {
    meta: { schema: 2, createdAt: '2026-01-01T00:00:00.000Z', lastModified: '2026-01-01T00:00:00.000Z' },
    settings: {
      currency: 'TWD',
      incomeCategories: ['薪資', '其他收入'],
      expenseCategories: ['餐飲', '交通', '其他'],
      monthlyBudgets: {
        '2026-07': { 餐飲: 4000 },
        '2026-09': { 餐飲: 6000, 交通: 1200, 其他: 0 },
      },
      savingsGoals: [{ id: 'g1', title: '旅行', targetAmount: 30000, currentAmount: 1500, deadline: null, autoSavePercent: null, lastAutoSaveMonth: null, deposits: [{ date: '2026-09-15T04:00:00.000Z', amount: 1500, type: 'manual', monthKey: null }] }],
      taskReminderLookaheadDays: 1,
      ...patch,
    },
    days: {},
  };
}

describe('schema 3 migration', () => {
  it('turns the latest budgeted month into the template and keeps older months as they were', () => {
    const doc = migrateLedger(v2());
    expect(doc.meta.schema).toBe(3);
    expect(doc.settings.budgetPlans).toEqual([{ since: '2026-09', amounts: { 餐飲: 6000, 交通: 1200 } }]);
    expect(doc.settings.monthlyBudgets['2026-07']).toEqual({ 餐飲: 4000 });
    expect(doc.settings.monthlyBudgets['2026-09']).toEqual({ 其他: 0 });
    Data.replaceStore(doc);
    expect(Data.getMonthlyBudgets('2026-07')).toEqual({ 餐飲: 4000 });
    expect(Data.getMonthlyBudgets('2026-08')).toEqual({});
    expect(Data.getMonthlyBudgets('2026-09')).toEqual({ 餐飲: 6000, 交通: 1200 });
    expect(Data.getMonthlyBudgets('2026-12')).toEqual({ 餐飲: 6000, 交通: 1200 });
  });

  it('gives old deposits ids and a local date', () => {
    const doc = migrateLedger(v2());
    const dep = doc.settings.savingsGoals[0].deposits[0];
    expect(dep.id).toBeTruthy();
    expect(dep.dateKey).toMatch(/^2026-09-1[45]$/);
    expect(migrateLedger(doc)).toEqual(doc);
  });
});

describe('budget template', () => {
  it('applies the template forward and keeps history from before it', () => {
    Data.setMonthlyBudget('2026-08', '餐飲', 3000);
    Data.setBudgetTemplate('餐飲', 5000, '2026-10');
    expect(Data.getMonthlyBudgets('2026-08')).toEqual({ 餐飲: 3000 });
    expect(Data.getMonthlyBudgets('2026-11')).toEqual({ 餐飲: 5000 });
    Data.setBudgetTemplate('餐飲', 5500, '2027-01');
    expect(Data.getMonthlyBudgets('2026-12')).toEqual({ 餐飲: 5000 });
    expect(Data.getMonthlyBudgets('2027-02')).toEqual({ 餐飲: 5500 });
  });

  it('lets one month differ and resets it back', () => {
    Data.setBudgetTemplate('餐飲', 5000, '2026-10');
    Data.setMonthlyBudget('2026-11', '餐飲', 8000);
    Data.setMonthlyBudget('2026-11', '交通', 900);
    expect(Data.isMonthAdjusted('2026-11')).toBe(true);
    expect(Data.getMonthlyBudgets('2026-11')).toEqual({ 餐飲: 8000, 交通: 900 });
    Data.setMonthlyBudget('2026-11', '餐飲', 0);
    expect(Data.getMonthlyBudgets('2026-11')).toEqual({ 交通: 900 });
    Data.resetMonthToTemplate('2026-11');
    expect(Data.isMonthAdjusted('2026-11')).toBe(false);
    expect(Data.getMonthlyBudgets('2026-11')).toEqual({ 餐飲: 5000 });
  });

  it('drops a month override that matches the template', () => {
    Data.setBudgetTemplate('餐飲', 5000, '2026-10');
    Data.setMonthlyBudget('2026-10', '餐飲', 5000);
    expect(Data.isMonthAdjusted('2026-10')).toBe(false);
  });

  it('follows category renames and deletes', () => {
    Data.setBudgetTemplate('餐飲', 5000, '2026-10');
    Data.renameCategory('expense', '餐飲', '吃飯');
    expect(Data.getMonthlyBudgets('2026-10')).toEqual({ 吃飯: 5000 });
    const { snapshot } = Data.removeCategory('expense', '吃飯');
    expect(Data.getMonthlyBudgets('2026-10')).toEqual({});
    Data.restoreCategory(snapshot);
    expect(Data.getMonthlyBudgets('2026-10')).toEqual({ 吃飯: 5000 });
  });
});

describe('recurring expenses', () => {
  it('posts on the due day, backfills missed months, and never posts twice', () => {
    Data.addRecurring({ name: '房租', amount: 12000, category: '其他', day: 5, since: '2026-08' }, '2026-08-01');
    expect(Data.postDueRecurring('2026-08-04')).toHaveLength(0);
    const first = Data.postDueRecurring('2026-10-08');
    expect(first.map((p) => p.dateKey)).toEqual(['2026-08-05', '2026-09-05', '2026-10-05']);
    expect(Data.getDayEntries('2026-10-05').expenses[0]).toMatchObject({ amount: 12000, note: '房租', recurring: true });
    expect(Data.postDueRecurring('2026-10-20')).toHaveLength(0);
  });

  it('does not bring back an entry the user deleted', () => {
    const id = Data.addRecurring({ name: '健身房', amount: 999, category: '其他', day: 1, since: '2026-10' }, '2026-10-01');
    const [posted] = Data.postDueRecurring('2026-10-01');
    Data.removeEntry(posted.dateKey, 'expense', posted.entryId);
    expect(Data.postDueRecurring('2026-10-02')).toHaveLength(0);
    expect(Data.getRecurringTemplate(id).posted['2026-10']).toBe(posted.entryId);
  });

  it('uses the last day for short months and stops after until or when paused', () => {
    const id = Data.addRecurring({ name: '月底', amount: 100, category: '其他', day: 31, since: '2027-02', until: '2027-03' }, '2027-02-01');
    expect(Data.postDueRecurring('2027-02-28').map((p) => p.dateKey)).toEqual(['2027-02-28']);
    expect(Data.postDueRecurring('2027-05-31').map((p) => p.dateKey)).toEqual(['2027-03-31']);
    Data.updateRecurring(id, { active: false, until: null });
    expect(Data.postDueRecurring('2027-07-31')).toHaveLength(0);
  });

  it('starts this month when the day is still ahead, otherwise next month, and adopts an existing entry', () => {
    const later = Data.addRecurring({ name: 'A', amount: 1, category: '其他', day: 20 }, '2026-10-10');
    const passed = Data.addRecurring({ name: 'B', amount: 1, category: '其他', day: 5 }, '2026-10-10');
    expect(Data.getRecurringTemplate(later).since).toBe('2026-10');
    expect(Data.getRecurringTemplate(passed).since).toBe('2026-11');
    const entryId = Data.addExpenseEntry('2026-10-03', { amount: 500, category: '其他', note: '網路' });
    const adopted = Data.addRecurring({ name: '網路', amount: 500, category: '其他', day: 3, postedEntry: { monthKey: '2026-10', dateKey: '2026-10-03', entryId } }, '2026-10-03');
    expect(Data.getDayEntries('2026-10-03').expenses[0].recurringId).toBe(adopted);
    expect(Data.postDueRecurring('2026-10-31').filter((p) => p.templateId === adopted)).toHaveLength(0);
  });

  it('removes and restores a template', () => {
    const id = Data.addRecurring({ name: 'A', amount: 1, category: '其他', day: 1, since: '2026-10' }, '2026-10-01');
    const snapshot = Data.removeRecurring(id);
    expect(Data.getRecurring()).toHaveLength(0);
    Data.restoreRecurring(snapshot);
    expect(Data.getRecurring()[0].id).toBe(id);
  });
});

describe('goal transfers', () => {
  it('records deposits and withdrawals as transfers that are not spending', () => {
    const goal = Data.addSavingsGoal({ title: '旅行', targetAmount: 30000 });
    Data.addExpenseEntry('2026-10-03', { amount: 300, category: '餐飲', note: '' });
    Data.depositToGoal(goal, 5000, { dateKey: '2026-10-03' });
    expect(Data.withdrawFromGoal(goal, 9000, { dateKey: '2026-10-04' })).toBeNull();
    Data.withdrawFromGoal(goal, 2000, { dateKey: '2026-10-04' });
    const g = Data.getState().settings.savingsGoals[0];
    expect(g.currentAmount).toBe(3000);
    expect(Data.getTransfers(['2026-10-03']).map((t) => t.signed)).toEqual([5000]);
    const month = Calc.summarizeDateKeys(Calc.getMonthDateKeys('2026-10'));
    expect(month).toMatchObject({ expense: 300, saved: 3000, net: -300 });
  });

  it('removes a transfer, fixes the balance, and restores it in place', () => {
    const goal = Data.addSavingsGoal({ title: '旅行', targetAmount: 30000 });
    Data.depositToGoal(goal, 1000, { dateKey: '2026-10-01' });
    const second = Data.depositToGoal(goal, 400, { dateKey: '2026-10-02' });
    const snapshot = Data.removeGoalTransfer(goal, second);
    expect(Data.getState().settings.savingsGoals[0].currentAmount).toBe(1000);
    Data.restoreGoalTransfer(snapshot);
    const g = Data.getState().settings.savingsGoals[0];
    expect(g.currentAmount).toBe(1400);
    expect(g.deposits[1].id).toBe(second);
  });

  it('refuses to cancel a deposit that was already withdrawn', () => {
    const goal = Data.addSavingsGoal({ title: '旅行', targetAmount: 30000 });
    const deposit = Data.depositToGoal(goal, 100, { dateKey: '2026-10-01' });
    Data.withdrawFromGoal(goal, 30, { dateKey: '2026-10-02' });
    expect(Data.removeGoalTransfer(goal, deposit)).toMatchObject({ blocked: true });
    expect(Data.getState().settings.savingsGoals[0].currentAmount).toBe(70);
  });

  it('counts withdrawals against the monthly savings pace', () => {
    const goal = Data.addSavingsGoal({ title: '旅行', targetAmount: 10000 });
    Data.depositToGoal(goal, 3000, { dateKey: '2026-09-01' });
    Data.withdrawFromGoal(goal, 1000, { dateKey: '2026-09-20' });
    const projection = Calc.getGoalProjection(Data.getState().settings.savingsGoals[0]);
    expect(projection.avgMonthly).toBe(2000);
    expect(projection.remaining).toBe(8000);
  });
});
