import { Calc } from '../../core/calculations.js';
import { Data } from '../../core/data-model.js';

function getPreviousMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function checkAutoSavings() {
  const todayKey = Data.toDateKey(new Date());
  const currentMonthKey = Data.toMonthKey(todayKey);
  const previousMonthKey = getPreviousMonthKey(currentMonthKey);

  const previousMonthSummary = Calc.computeMonthSummary(previousMonthKey);
  Data.applyMonthlyAutoSavings(previousMonthKey, previousMonthSummary.net);
}

export function boot() {
  if (!Data || !Calc) return;
  try {
    checkAutoSavings();
  } catch (err) {
    console.error('Life Ledger：檢查儲蓄目標自動存入時發生錯誤', err);
  }
}
