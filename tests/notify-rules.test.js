import { describe, expect, it } from 'vitest';
import { budgetSignals, dailyLog, dailySummary, dayLabel, inQuietHours, leadMs, taskReminders, weatherSignals } from '../src/shell/notify-rules.js';

const at = (text) => new Date(text);

describe('leadMs', () => {
  it('parses reminder leads', () => {
    expect(leadMs('15M')).toBe(15 * 60000);
    expect(leadMs('2H')).toBe(2 * 3600000);
    expect(leadMs('1D')).toBe(86400000);
    expect(leadMs('1W')).toBe(604800000);
    expect(leadMs('none')).toBeNull();
    expect(leadMs(undefined)).toBeNull();
  });
});

describe('taskReminders', () => {
  const task = { id: 't1', text: '牙醫回診', time: '14:30', reminderLead: '15M', location: '中山診所' };

  it('fires inside the window between lead time and a little after start', () => {
    expect(taskReminders([{ dateKey: '2026-10-02', tasks: [task] }], at('2026-10-02T14:10:00'))).toEqual([]);
    const [hit] = taskReminders([{ dateKey: '2026-10-02', tasks: [task] }], at('2026-10-02T14:16:00'));
    expect(hit.key).toBe('cal:t1:2026-10-02:14:30:15M');
    expect(hit.level).toBe('time');
    expect(hit.body).toBe('14 分鐘後開始 · 14:30 · 中山診所');
    expect(taskReminders([{ dateKey: '2026-10-02', tasks: [task] }], at('2026-10-02T14:41:00'))).toEqual([]);
  });

  it('skips done tasks and tasks without a reminder', () => {
    const days = [{ dateKey: '2026-10-02', tasks: [{ ...task, done: true }, { ...task, id: 't2', reminderLead: 'none' }] }];
    expect(taskReminders(days, at('2026-10-02T14:20:00'))).toEqual([]);
  });

  it('uses 9:00 as the base for all-day tasks and keeps them until the day ends', () => {
    const allDay = { id: 't3', text: '繳電費', reminderLead: '1D' };
    expect(taskReminders([{ dateKey: '2026-10-05', tasks: [allDay] }], at('2026-10-04T08:59:00'))).toEqual([]);
    const [hit] = taskReminders([{ dateKey: '2026-10-05', tasks: [allDay] }], at('2026-10-04T09:00:00'));
    expect(hit.body).toBe('明天 · 整天');
    expect(taskReminders([{ dateKey: '2026-10-05', tasks: [allDay] }], at('2026-10-05T23:00:00'))).toHaveLength(1);
  });

  it('changes the key when the time or lead changes so edits re-notify', () => {
    const a = taskReminders([{ dateKey: '2026-10-02', tasks: [task] }], at('2026-10-02T14:20:00'))[0].key;
    const b = taskReminders([{ dateKey: '2026-10-02', tasks: [{ ...task, time: '14:40' }] }], at('2026-10-02T14:30:00'))[0].key;
    expect(a).not.toBe(b);
  });
});

describe('dailySummary', () => {
  it('lists the first two tasks by time and counts the rest', () => {
    const tasks = [{ text: '倒垃圾' }, { text: '開會', time: '10:00' }, { text: '買菜', time: '18:00' }, { text: '完成', done: true }];
    const summary = dailySummary(tasks, at('2026-10-02T08:00:00'));
    expect(summary.title).toBe('今天有 3 件代辦');
    expect(summary.body).toBe('10:00 開會、18:00 買菜，還有 1 件');
    expect(summary.key).toBe('cal-summary:2026-10-02');
  });

  it('stays quiet before 6:00 or with nothing pending', () => {
    expect(dailySummary([{ text: 'a' }], at('2026-10-02T05:00:00'))).toBeNull();
    expect(dailySummary([{ text: 'a', done: true }], at('2026-10-02T08:00:00'))).toBeNull();
  });
});

describe('weatherSignals', () => {
  const now = at('2026-10-02T12:00:00');
  const hour = (h, pop) => ({ time: at(`2026-10-02T${String(h).padStart(2, '0')}:00:00`).getTime(), pop });

  it('warns about rain within three hours once a day', () => {
    const list = weatherSignals({ current: { temperature: 25, apparent: 27 }, hourly: [hour(12, 10), hour(14, 80), hour(18, 90)], timezone: 'Asia/Taipei', location: { name: '虎尾' } }, now);
    expect(list).toHaveLength(1);
    expect(list[0].key).toBe('wx-rain:2026-10-02');
    expect(list[0].title).toBe('降雨機率 80%');
  });

  it('ignores rain further than three hours away', () => {
    expect(weatherSignals({ current: { temperature: 25, apparent: 27 }, hourly: [hour(16, 90)] }, now)).toEqual([]);
  });

  it('reports heat, cold and alerts', () => {
    const list = weatherSignals({ current: { temperature: 9, apparent: 39 }, hourly: [], alerts: [{ phenomena: '大雨' }, { phenomena: '大雨' }], location: { county: '雲林縣' } }, now);
    expect(list.map((item) => item.key)).toEqual(['wx-alert:2026-10-02:雲林縣:大雨', 'wx-heat:2026-10-02', 'wx-cold:2026-10-02']);
    expect(list[0].level).toBe('time');
  });
});

describe('budgetSignals', () => {
  const base = { monthKey: '2026-10', byCategory: { 餐飲: 6000, 交通: 500 }, budgets: { 餐飲: 5000, 交通: 3000 }, projection: { applicable: false } };

  it('reports 80% of the total budget', () => {
    const list = budgetSignals({ ...base, expense: 6500, byCategory: { 餐飲: 4000, 交通: 2500 } });
    expect(list.map((item) => item.key)).toEqual(['budget-80:2026-10']);
    expect(list[0].body).toBe('還剩 NT$ 1,500');
  });

  it('reports the whole budget plus categories that went over, covering 80%', () => {
    const list = budgetSignals({ ...base, expense: 8200, byCategory: { 餐飲: 7000, 交通: 1200 } });
    expect(list[0].key).toBe('budget-100:2026-10');
    expect(list[0].covers).toContain('budget-80:2026-10');
    expect(list[1].key).toBe('budget-cat:2026-10:餐飲');
  });

  it('warns about projected overspend only while still under budget', () => {
    const projection = { applicable: true, overProjected: true, projectedExpense: 9000, totalBudget: 8000 };
    expect(budgetSignals({ ...base, expense: 3000, byCategory: {}, projection }).map((item) => item.key)).toEqual(['budget-proj:2026-10']);
  });

  it('says nothing without budgets', () => {
    expect(budgetSignals({ monthKey: '2026-10', expense: 99999, byCategory: {}, budgets: {}, projection: null })).toEqual([]);
  });
});

describe('dailyLog', () => {
  it('fires after the chosen time when nothing was logged', () => {
    expect(dailyLog({ hasEntries: false, time: '21:00' }, at('2026-10-02T20:59:00'))).toBeNull();
    expect(dailyLog({ hasEntries: false, time: '21:00' }, at('2026-10-02T21:00:00')).key).toBe('daily:2026-10-02');
    expect(dailyLog({ hasEntries: true, time: '21:00' }, at('2026-10-02T22:00:00'))).toBeNull();
  });
});

describe('inQuietHours', () => {
  it('handles manual, overnight and same-day schedules', () => {
    expect(inQuietHours({ on: true }, at('2026-10-02T12:00:00'))).toBe(true);
    const night = { on: false, schedule: true, from: '23:00', to: '07:00' };
    expect(inQuietHours(night, at('2026-10-02T23:30:00'))).toBe(true);
    expect(inQuietHours(night, at('2026-10-02T06:59:00'))).toBe(true);
    expect(inQuietHours(night, at('2026-10-02T07:00:00'))).toBe(false);
    expect(inQuietHours({ on: false, schedule: true, from: '13:00', to: '14:00' }, at('2026-10-02T13:30:00'))).toBe(true);
    expect(inQuietHours({ on: false, schedule: false, from: '00:00', to: '23:59' }, at('2026-10-02T13:30:00'))).toBe(false);
  });
});

describe('dayLabel', () => {
  it('names today, tomorrow and other days', () => {
    const now = at('2026-10-02T10:00:00');
    expect(dayLabel('2026-10-02', now)).toBe('今天');
    expect(dayLabel('2026-10-03', now)).toBe('明天');
    expect(dayLabel('2026-10-05', now)).toBe('10/5 週一');
  });
});
