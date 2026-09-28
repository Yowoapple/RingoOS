import { Data } from './data-model.js';

function getMonthDateKeys(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const keys = [];
  for (let d = 1; d <= daysInMonth; d++) {
    keys.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return keys;
}

function getWeekDateKeys(anchorDateKey) {
  const anchor = parseDateKey(anchorDateKey);
  const dayOfWeek = anchor.getDay();
  const distanceToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - distanceToMonday);

  const keys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    keys.push(Data.toDateKey(d));
  }
  return keys;
}

function parseDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function shiftDateKey(dateKey, deltaDays) {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + deltaDays);
  return Data.toDateKey(d);
}

function getPreviousMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function summarizeDateKeys(dateKeys) {
  const state = Data.getState();
  let income = 0;
  let expense = 0;
  const incomeByCategory = {};
  const expenseByCategory = {};

  dateKeys.forEach((dateKey) => {
    const day = state.days[dateKey];
    if (!day) return;

    (day.income || []).forEach((entry) => {
      income += entry.amount;
      incomeByCategory[entry.category] = (incomeByCategory[entry.category] || 0) + entry.amount;
    });

    (day.expenses || []).forEach((entry) => {
      expense += entry.amount;
      expenseByCategory[entry.category] = (expenseByCategory[entry.category] || 0) + entry.amount;
    });
  });

  return {
    income,
    expense,
    net: income - expense,
    incomeByCategory,
    expenseByCategory,
  };
}

function getBudgetStatus(spent, budget) {
  if (!budget || budget <= 0) {
    return { status: 'no-budget', ratio: null };
  }
  const ratio = spent / budget;
  let status;
  if (ratio >= 1) status = 'danger';
  else if (ratio >= 0.7) status = 'warning';
  else status = 'safe';
  return { status, ratio };
}

function getMonthBudgetBreakdown(monthKey) {
  const state = Data.getState();
  const budgets = Data.getMonthlyBudgets(monthKey);
  const summary = summarizeDateKeys(getMonthDateKeys(monthKey));

  return state.settings.expenseCategories.map((category) => {
    const spent = summary.expenseByCategory[category] || 0;
    const budget = budgets[category] || 0;
    const { status, ratio } = getBudgetStatus(spent, budget);
    return { category, spent, budget, status, ratio };
  });
}

function getNetStatus(income, expense) {
  const net = income - expense;
  if (net >= 0) return { status: 'positive', net };
  if (income > 0 && Math.abs(net) / income <= 0.1) return { status: 'warning', net };
  return { status: 'danger', net };
}

function getNecessityBreakdown(dateKeys) {
  const state = Data.getState();
  let want = 0;
  let need = 0;
  let unspecified = 0;

  dateKeys.forEach((dateKey) => {
    const day = state.days[dateKey];
    if (!day) return;
    (day.expenses || []).forEach((entry) => {
      if (entry.necessity === 'want') want += entry.amount;
      else if (entry.necessity === 'need') need += entry.amount;
      else unspecified += entry.amount;
    });
  });

  const tagged = want + need;
  const wantRatio = tagged > 0 ? Math.round((want / tagged) * 100) : null;

  return { want, need, unspecified, wantRatio };
}

function getMidMonthProjection(monthKey) {
  const todayKey = Data.toDateKey(new Date());
  const actualCurrentMonthKey = Data.toMonthKey(todayKey);

  if (monthKey !== actualCurrentMonthKey) {
    return { applicable: false };
  }

  const dayOfMonth = Number(todayKey.slice(8, 10));
  const daysInMonth = getMonthDateKeys(monthKey).length;

  if (dayOfMonth <= 3 || dayOfMonth >= daysInMonth - 1) {
    return { applicable: false };
  }

  const summary = summarizeDateKeys(getMonthDateKeys(monthKey).slice(0, dayOfMonth));
  const dailyAverage = summary.expense / dayOfMonth;
  const projectedExpense = Math.round(dailyAverage * daysInMonth);

  const budgets = Data.getMonthlyBudgets(monthKey);
  const totalBudget = Object.values(budgets).reduce((sum, v) => sum + v, 0);
  const overProjected = totalBudget > 0 && projectedExpense > totalBudget;

  return {
    applicable: true,
    dayOfMonth,
    daysInMonth,
    currentExpense: summary.expense,
    projectedExpense,
    totalBudget,
    overProjected,
  };
}

function getMonthComparison(monthKey) {
  const previousMonthKey = getPreviousMonthKey(monthKey);
  const previousSummary = summarizeDateKeys(getMonthDateKeys(previousMonthKey));
  const hasPrevious = previousSummary.income > 0 || previousSummary.expense > 0;
  if (!hasPrevious) return { hasPrevious: false };

  const currentSummary = summarizeDateKeys(getMonthDateKeys(monthKey));
  return {
    hasPrevious: true,
    previousExpense: previousSummary.expense,
    currentExpense: currentSummary.expense,
    diff: currentSummary.expense - previousSummary.expense,
    previousByCategory: previousSummary.expenseByCategory,
    currentByCategory: currentSummary.expenseByCategory,
  };
}

function getWeekComparison(anchorDateKey) {
  const currentWeekKeys = getWeekDateKeys(anchorDateKey);
  const previousAnchor = shiftDateKey(currentWeekKeys[0], -7);
  const previousWeekKeys = getWeekDateKeys(previousAnchor);
  const previousSummary = summarizeDateKeys(previousWeekKeys);
  const hasPrevious = previousSummary.income > 0 || previousSummary.expense > 0;
  if (!hasPrevious) return { hasPrevious: false };

  const currentSummary = summarizeDateKeys(currentWeekKeys);
  return {
    hasPrevious: true,
    previousExpense: previousSummary.expense,
    currentExpense: currentSummary.expense,
    diff: currentSummary.expense - previousSummary.expense,
    previousByCategory: previousSummary.expenseByCategory,
    currentByCategory: currentSummary.expenseByCategory,
  };
}

function getCategoryDriver(currentByCategory, previousByCategory) {
  const categories = Object.keys(currentByCategory);
  if (categories.length === 0) return null;

  if (previousByCategory) {
    let best = null;
    categories.forEach((cat) => {
      const diff = currentByCategory[cat] - (previousByCategory[cat] || 0);
      if (!best || diff > best.diff) {
        best = { category: cat, amount: currentByCategory[cat], diff };
      }
    });
    if (best && best.diff > 0) return { ...best, mode: 'increase' };
  }

  const sorted = getSortedCategoryBreakdown(currentByCategory);
  return { category: sorted[0].category, amount: sorted[0].amount, diff: null, mode: 'top' };
}

function getConsecutiveGoodWeeks(anchorDateKey) {
  let count = 0;
  let cursorAnchor = shiftDateKey(getWeekDateKeys(anchorDateKey)[0], -7);
  for (let i = 0; i < 52; i++) {
    const weekKeys = getWeekDateKeys(cursorAnchor);
    const summary = summarizeDateKeys(weekKeys);
    if (summary.income === 0 && summary.expense === 0) break;
    if (summary.income - summary.expense >= 0) {
      count += 1;
      cursorAnchor = shiftDateKey(weekKeys[0], -7);
    } else {
      break;
    }
  }
  return count;
}

function getConsecutiveGoodMonths(monthKey) {
  let count = 0;
  let cursorMonthKey = getPreviousMonthKey(monthKey);
  for (let i = 0; i < 24; i++) {
    const summary = summarizeDateKeys(getMonthDateKeys(cursorMonthKey));
    if (summary.income === 0 && summary.expense === 0) break;
    if (summary.income - summary.expense >= 0) {
      count += 1;
      cursorMonthKey = getPreviousMonthKey(cursorMonthKey);
    } else {
      break;
    }
  }
  return count;
}

function getGoalProjection(goal) {
  const deposits = goal.deposits || [];
  if (deposits.length === 0) {
    return { hasHistory: false, remaining: goal.targetAmount - goal.currentAmount };
  }

  const byMonth = {};
  deposits.forEach((dep) => {
    const monthKey = dep.monthKey || Data.toMonthKey(Data.toDateKey(new Date(dep.date)));
    byMonth[monthKey] = (byMonth[monthKey] || 0) + dep.amount;
  });
  const monthlyAmounts = Object.values(byMonth);
  const avgMonthly = monthlyAmounts.reduce((sum, v) => sum + v, 0) / monthlyAmounts.length;

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  if (avgMonthly <= 0) {
    return { hasHistory: true, avgMonthly, remaining, monthsRemaining: null };
  }

  const monthsRemaining = Math.ceil(remaining / avgMonthly);
  return { hasHistory: true, avgMonthly, remaining, monthsRemaining };
}

function computeMonthSummary(monthKey) {
  const dateKeys = getMonthDateKeys(monthKey);
  const summary = summarizeDateKeys(dateKeys);
  const netStatus = getNetStatus(summary.income, summary.expense);
  const budgetBreakdown = getMonthBudgetBreakdown(monthKey);
  const overBudgetCount = budgetBreakdown.filter((b) => b.status === 'danger').length;
  const watchBudgetCount = budgetBreakdown.filter((b) => b.status === 'warning').length;
  const necessityBreakdown = getNecessityBreakdown(dateKeys);

  return {
    monthKey,
    ...summary,
    ...netStatus,
    budgetBreakdown,
    overBudgetCount,
    watchBudgetCount,
    necessityBreakdown,
  };
}

function computeWeekSummary(anchorDateKey) {
  const dateKeys = getWeekDateKeys(anchorDateKey);
  const summary = summarizeDateKeys(dateKeys);
  const netStatus = getNetStatus(summary.income, summary.expense);
  const necessityBreakdown = getNecessityBreakdown(dateKeys);

  return {
    weekStart: dateKeys[0],
    weekEnd: dateKeys[6],
    dateKeys,
    ...summary,
    ...netStatus,
    necessityBreakdown,
  };
}

function getSortedCategoryBreakdown(byCategory) {
  return Object.entries(byCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function getUpcomingTaskSummary() {
  const lookahead = Data.getTaskReminderLookaheadDays();
  const todayKey = Data.toDateKey(new Date());
  let count = 0;
  const days = [];

  for (let i = 0; i <= lookahead; i++) {
    const dateKey = shiftDateKey(todayKey, i);
    const pending = Data.getDayTasks(dateKey).filter((t) => !t.done);
    if (pending.length > 0) {
      count += pending.length;
      days.push({ dateKey, pendingCount: pending.length, isToday: i === 0 });
    }
  }

  return { count, days };
}

export const Calc = {
  getMonthDateKeys,
  getWeekDateKeys,
  shiftDateKey,
  getPreviousMonthKey,
  summarizeDateKeys,
  getBudgetStatus,
  getMonthBudgetBreakdown,
  getNetStatus,
  getNecessityBreakdown,
  getMidMonthProjection,
  getMonthComparison,
  getWeekComparison,
  getCategoryDriver,
  getConsecutiveGoodWeeks,
  getConsecutiveGoodMonths,
  getGoalProjection,
  computeMonthSummary,
  computeWeekSummary,
  getSortedCategoryBreakdown,
  getUpcomingTaskSummary,
};
