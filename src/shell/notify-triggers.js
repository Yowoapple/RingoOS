import { Data } from '../core/data-model.js';
import { Calc } from '../core/calculations.js';
import { budgetSignals, dailyLog, dailySummary, taskReminders, weatherSignals } from './notify-rules.js';

const TICK_MS = 30000;
const SETTLE_MS = 2400;
const DATA_DELAY = 1200;
const SCAN_DAYS = 15;

export function startTriggers(notifier, { now = () => new Date() } = {}) {
  let ready = false;
  let dataTimer = 0;
  let lastWeather = null;

  function scanDays(todayKey) {
    const days = [];
    for (let i = -1; i <= SCAN_DAYS; i += 1) {
      const dateKey = Calc.shiftDateKey(todayKey, i);
      const tasks = Data.getDayTasks(dateKey);
      if (tasks.length) days.push({ dateKey, tasks });
    }
    return days;
  }

  function budget(todayKey) {
    const monthKey = Data.toMonthKey(todayKey);
    const summary = Calc.summarizeDateKeys(Calc.getMonthDateKeys(monthKey));
    return budgetSignals({
      monthKey,
      expense: summary.expense,
      byCategory: summary.expenseByCategory,
      budgets: Data.getMonthlyBudgets(monthKey),
      projection: Calc.getMidMonthProjection(monthKey),
    });
  }

  function tick() {
    if (!ready || !notifier.leader) return;
    const at = now();
    const todayKey = Data.toDateKey(at);
    const day = Data.getDayEntries(todayKey);
    notifier.sendAll([
      dailySummary(Data.getDayTasks(todayKey), at),
      ...taskReminders(scanDays(todayKey), at),
      ...budget(todayKey),
      dailyLog({ hasEntries: (day.income || []).length + (day.expenses || []).length > 0, time: notifier.prefs.dailyTime }, at),
    ]);
  }

  function weather(payload) {
    lastWeather = payload;
    if (!ready || !notifier.leader || !payload) return;
    notifier.sendAll(weatherSignals(payload, now()));
  }

  window.setTimeout(() => {
    ready = true;
    tick();
    if (lastWeather) weather(lastWeather);
  }, SETTLE_MS);
  window.setInterval(tick, TICK_MS);
  Data.subscribe(() => {
    window.clearTimeout(dataTimer);
    dataTimer = window.setTimeout(tick, DATA_DELAY);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });
  notifier.subscribe(({ type }) => {
    if (type !== 'leader' && type !== 'prefs') return;
    tick();
    if (lastWeather) weather(lastWeather);
  });

  return { tick, weather };
}
