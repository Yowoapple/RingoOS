import { effectiveDetail } from '../apps/calendar/ics.js';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const UNIT_MS = { M: 60000, H: 3600000, D: 86400000, W: 604800000 };
const ALL_DAY_HOUR = 9;
const LATE_MS = 10 * 60000;

export const RAIN_POP = 70;
export const HEAT_APPARENT = 38;
export const COLD_TEMPERATURE = 10;

function pad(n) {
  return String(n).padStart(2, '0');
}

function money(n) {
  return `NT$ ${Math.round(n).toLocaleString('en-US')}`;
}

function dateOf(dateKey, hours = 0, minutes = 0) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d, hours, minutes);
}

function keyOf(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function leadMs(lead) {
  if (!lead || lead === 'none') return null;
  const unit = lead.slice(-1);
  const amount = Number(lead.slice(0, -1));
  if (!UNIT_MS[unit] || !Number.isFinite(amount)) return null;
  return amount * UNIT_MS[unit];
}

export function dayLabel(dateKey, now) {
  const today = keyOf(now);
  const tomorrow = keyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  if (dateKey === today) return '今天';
  if (dateKey === tomorrow) return '明天';
  const date = dateOf(dateKey);
  return `${date.getMonth() + 1}/${date.getDate()} 週${WEEK[date.getDay()]}`;
}

function untilText(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return '現在開始';
  if (minutes < 60) return `${minutes} 分鐘後開始`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小時後開始`;
  return null;
}

export function taskReminders(days, now) {
  const out = [];
  const time = now.getTime();
  days.forEach(({ dateKey, tasks }) => {
    (tasks || []).forEach((task) => {
      if (task.done || !task.text) return;
      const detail = effectiveDetail(task);
      const lead = leadMs(detail.reminderLead);
      if (lead === null) return;
      const timed = !!task.time;
      const [hh, mm] = timed ? task.time.split(':').map(Number) : [ALL_DAY_HOUR, 0];
      const start = dateOf(dateKey, hh, mm).getTime();
      const fireAt = start - lead;
      const until = timed ? start + LATE_MS : dateOf(dateKey, 23, 59).getTime();
      if (time < fireAt || time > until) return;
      const when = timed ? `${dayLabel(dateKey, now)} ${task.time}` : `${dayLabel(dateKey, now)} · 整天`;
      const soon = timed ? untilText(start - time) : null;
      const parts = [soon ? `${soon} · ${task.time}` : when];
      if (detail.location.trim()) parts.push(detail.location.trim());
      out.push({
        key: `cal:${task.id}:${dateKey}:${task.time || 'all'}:${detail.reminderLead}`,
        app: 'calendar',
        kind: 'calendar',
        level: 'time',
        title: task.text,
        body: parts.join(' · '),
        target: { dateKey, id: task.id },
      });
    });
  });
  return out;
}

export function dailySummary(tasks, now) {
  if (now.getHours() < 6) return null;
  const pending = (tasks || []).filter((task) => !task.done && task.text);
  if (!pending.length) return null;
  const sorted = pending.slice().sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const names = sorted.slice(0, 2).map((task) => (task.time ? `${task.time} ${task.text}` : task.text));
  const today = keyOf(now);
  return {
    key: `cal-summary:${today}`,
    app: 'calendar',
    kind: 'summary',
    level: 'info',
    title: `今天有 ${pending.length} 件代辦`,
    body: pending.length > 2 ? `${names.join('、')}，還有 ${pending.length - 2} 件` : names.join('、'),
    target: { dateKey: today },
  };
}

function hourText(ms, timeZone) {
  try {
    return new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(ms));
  } catch (err) {
    const date = new Date(ms);
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}

export function weatherSignals({ current, hourly, alerts, location, timezone }, now) {
  const out = [];
  const today = keyOf(now);
  const time = now.getTime();
  const place = location ? location.county || location.name : '';
  if (alerts && alerts.length) {
    const names = Array.from(new Set(alerts.map((alert) => alert.phenomena))).sort();
    out.push({
      key: `wx-alert:${today}:${place}:${names.join(',')}`,
      app: 'weather',
      kind: 'weather',
      level: 'time',
      title: `${names.join('、')}特報`,
      body: place ? `${place} · 點開看影響範圍與時間` : '點開看影響範圍與時間',
    });
  }
  const soon = (hourly || []).filter((hour) => hour.time > time - 3600000 && hour.time <= time + 3 * 3600000);
  const wet = soon.find((hour) => (hour.pop ?? 0) >= RAIN_POP);
  if (wet) {
    out.push({
      key: `wx-rain:${today}`,
      app: 'weather',
      kind: 'weather',
      level: 'info',
      title: `降雨機率 ${Math.round(wet.pop)}%`,
      body: `${wet.time <= time ? '現在' : `${hourText(wet.time, timezone)} 左右`}可能下雨${place ? ` · ${place}` : ''}，出門記得帶傘`,
    });
  }
  if (current && Number.isFinite(current.apparent) && current.apparent >= HEAT_APPARENT) {
    out.push({
      key: `wx-heat:${today}`,
      app: 'weather',
      kind: 'weather',
      level: 'info',
      title: `體感 ${Math.round(current.apparent)}°`,
      body: '很熱，記得補水、避開正午的太陽',
    });
  }
  if (current && Number.isFinite(current.temperature) && current.temperature <= COLD_TEMPERATURE) {
    out.push({
      key: `wx-cold:${today}`,
      app: 'weather',
      kind: 'weather',
      level: 'info',
      title: `氣溫 ${Math.round(current.temperature)}°`,
      body: '偏冷，出門多帶一件外套',
    });
  }
  return out;
}

export function budgetSignals({ monthKey, expense, byCategory, budgets, projection }) {
  const out = [];
  const total = Object.values(budgets || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const ratio = total > 0 ? expense / total : 0;
  const month = Number(monthKey.slice(5, 7));
  if (total > 0 && ratio >= 1) {
    out.push({
      key: `budget-100:${monthKey}`,
      covers: [`budget-80:${monthKey}`, `budget-proj:${monthKey}`],
      app: 'overview',
      kind: 'budget',
      level: 'info',
      title: `${month} 月預算用完了`,
      body: `已經花了 ${money(expense)}，超出 ${money(expense - total)}`,
      target: { mode: 'month', anchorKey: `${monthKey}-01` },
    });
  } else if (total > 0 && ratio >= 0.8) {
    out.push({
      key: `budget-80:${monthKey}`,
      app: 'overview',
      kind: 'budget',
      level: 'info',
      title: `${month} 月預算用了 ${Math.floor(ratio * 100)}%`,
      body: `還剩 ${money(total - expense)}`,
      target: { mode: 'month', anchorKey: `${monthKey}-01` },
    });
  }
  Object.keys(budgets || {}).forEach((category) => {
    const limit = Number(budgets[category]) || 0;
    const spent = (byCategory && byCategory[category]) || 0;
    if (limit <= 0 || spent <= limit) return;
    out.push({
      key: `budget-cat:${monthKey}:${category}`,
      app: 'overview',
      kind: 'budget',
      level: 'info',
      title: `${category}超出預算`,
      body: `這個月花了 ${money(spent)}，預算 ${money(limit)}`,
      target: { mode: 'month', anchorKey: `${monthKey}-01` },
    });
  });
  if (projection && projection.applicable && projection.overProjected && ratio < 1) {
    out.push({
      key: `budget-proj:${monthKey}`,
      app: 'overview',
      kind: 'budget',
      level: 'info',
      title: '照這個速度，月底會超支',
      body: `推估 ${money(projection.projectedExpense)}，預算 ${money(projection.totalBudget)}`,
      target: { mode: 'month', anchorKey: `${monthKey}-01` },
    });
  }
  return out;
}

export function dailyLog({ hasEntries, time = '21:00' }, now) {
  if (hasEntries) return null;
  const [hh, mm] = String(time).split(':').map(Number);
  if (now.getHours() * 60 + now.getMinutes() < hh * 60 + (mm || 0)) return null;
  return {
    key: `daily:${keyOf(now)}`,
    app: 'daily-entry',
    kind: 'daily',
    level: 'info',
    title: '今天還沒記帳',
    body: '花一分鐘把今天的開銷記下來',
  };
}

export function inQuietHours(dnd, now) {
  if (!dnd) return false;
  if (dnd.on) return true;
  if (!dnd.schedule) return false;
  const toMinutes = (text) => {
    const [h, m] = String(text || '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const from = toMinutes(dnd.from);
  const to = toMinutes(dnd.to);
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (from === to) return false;
  return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}
