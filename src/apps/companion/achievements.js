import { levelOf } from './pet-model.js';
import { dexProgress } from './dex.js';

function shiftKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function loggedDays(state) {
  return Object.keys((state && state.days) || {})
    .filter((key) => {
      const day = state.days[key];
      return ((day.income || []).length + (day.expenses || []).length) > 0;
    })
    .sort();
}

export function streaks(keys, today) {
  const set = new Set(keys);
  let best = 0;
  let run = 0;
  let prev = null;
  keys.forEach((key) => {
    run = prev && shiftKey(prev, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  });
  let current = 0;
  let cursor = set.has(today) ? today : shiftKey(today, -1);
  while (set.has(cursor)) {
    current += 1;
    cursor = shiftKey(cursor, -1);
  }
  return { best, current };
}

export function runsOf(keys) {
  const set = new Set(keys);
  const out = new Map();
  keys.forEach((key) => {
    out.set(key, { prev: set.has(shiftKey(key, -1)), next: set.has(shiftKey(key, 1)) });
  });
  return out;
}

export function collectStats(state, life, today, { budgetsFor = () => ({}) } = {}) {
  const keys = loggedDays(state);
  let entries = 0;
  let noted = 0;
  let night = 0;
  const monthSpend = {};
  keys.forEach((key) => {
    const day = state.days[key];
    const all = [...(day.income || []), ...(day.expenses || [])];
    entries += all.length;
    all.forEach((e) => {
      if (e.note && String(e.note).trim()) noted += 1;
      if (Number.isFinite(e.createdAt)) {
        const hour = new Date(e.createdAt).getHours();
        if (hour < 4) night += 1;
      }
    });
    const month = key.slice(0, 7);
    monthSpend[month] = (monthSpend[month] || 0) + (day.expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  });
  const thisMonth = today.slice(0, 7);
  const keptBudget = Object.keys(monthSpend).some((month) => {
    if (month >= thisMonth) return false;
    const total = Object.values(budgetsFor(month) || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
    return total > 0 && monthSpend[month] > 0 && monthSpend[month] <= total;
  });
  const goals = (state.settings && state.settings.savingsGoals) || [];
  let saves = 0;
  let goalDone = false;
  goals.forEach((goal) => {
    let balance = 0;
    let peak = Number(goal.currentAmount) || 0;
    (goal.deposits || []).forEach((t) => {
      if (t.type !== 'withdraw' && t.type !== 'auto') saves += 1;
      balance += (t.type === 'withdraw' ? -1 : 1) * (Number(t.amount) || 0);
      peak = Math.max(peak, balance);
    });
    if (goal.targetAmount > 0 && peak >= goal.targetAmount) goalDone = true;
  });
  const run = streaks(keys, today);
  const totals = life.totals || {};
  return {
    entries,
    days: keys.length,
    noted,
    night,
    streakBest: run.best,
    streakNow: run.current,
    saves: Math.max(saves, totals.deposits || 0),
    goalDone,
    keptBudget,
    recurring: ((state.settings && state.settings.recurring) || []).length,
    searched: !!(life.flags && life.flags.search),
    level: levelOf(life.bond).level,
    pats: totals.pats || 0,
    feeds: totals.feeds || 0,
    dex: dexProgress(life.seen || []).found,
    birthday: !!(life.birthday && today.slice(5) === life.birthday),
  };
}

const count = (key, goal) => ({ progress: (s) => [Math.min(s[key], goal), goal], check: (s) => s[key] >= goal });
const flag = (key) => ({ progress: (s) => [s[key] ? 1 : 0, 1], check: (s) => !!s[key] });

export const ACHIEVEMENTS = [
  { id: 'first-entry', title: '第一筆', desc: '記下第一筆帳', badge: 'pen', ...count('entries', 1) },
  { id: 'entries-100', title: '一百筆', desc: '累積記滿 100 筆', badge: 'pen', ...count('entries', 100) },
  { id: 'entries-500', title: '五百筆', desc: '累積記滿 500 筆', badge: 'pen', ...count('entries', 500) },
  { id: 'entries-1000', title: '一千筆', desc: '累積記滿 1,000 筆', badge: 'pen', ...count('entries', 1000) },
  { id: 'days-30', title: '三十個日子', desc: '有 30 天記過帳', badge: 'calendar', ...count('days', 30) },
  { id: 'streak-7', title: '一整週', desc: '連續 7 天都有記帳', badge: 'flame', ...count('streakBest', 7) },
  { id: 'streak-30', title: '一整個月', desc: '連續 30 天都有記帳', badge: 'flame', ...count('streakBest', 30) },
  { id: 'streak-100', title: '一百天', desc: '連續 100 天都有記帳', badge: 'flame', ...count('streakBest', 100) },
  { id: 'noter', title: '有話要說', desc: '寫了 50 筆備註', badge: 'note', ...count('noted', 50) },
  { id: 'night-owl', title: '夜貓子', desc: '凌晨 0 到 4 點記一筆帳', badge: 'moon', ...count('night', 1) },
  { id: 'first-save', title: '第一桶金', desc: '第一次把錢存進目標', badge: 'coin', ...count('saves', 1) },
  { id: 'goal-done', title: '達標', desc: '有一個存錢目標存滿了', badge: 'coin', ...flag('goalDone') },
  { id: 'budget-month', title: '守住了', desc: '整個月的花費都沒超過預算', badge: 'shield', ...flag('keptBudget') },
  { id: 'recurring', title: '交給我', desc: '設定一筆固定支出', badge: 'repeat', ...count('recurring', 1) },
  { id: 'search', title: '翻翻舊帳', desc: '用搜尋找過紀錄', badge: 'search', ...flag('searched') },
  { id: 'level-5', title: '好朋友', desc: '親密度到 Lv5', badge: 'heart', ...count('level', 5) },
  { id: 'level-10', title: '形影不離', desc: '親密度到 Lv10', badge: 'heart', ...count('level', 10) },
  { id: 'pats-100', title: '摸頭達人', desc: '摸她的頭 100 次', badge: 'hand', ...count('pats', 100) },
  { id: 'feeds-50', title: '點心師傅', desc: '餵她 50 次點心', badge: 'cake', ...count('feeds', 50) },
  { id: 'dex-half', title: '半本圖鑑', desc: '圖鑑收集 15 種動作', badge: 'book', ...count('dex', 15) },
  { id: 'dex-all', title: '全收集', desc: '圖鑑 29 種動作全部看過', badge: 'book', ...count('dex', 29) },
  { id: 'birthday', title: '生日快樂', desc: '生日那天和她一起度過', badge: 'gift', ...flag('birthday') },
];

export function newlyUnlocked(stats, unlocked) {
  return ACHIEVEMENTS.filter((a) => !unlocked[a.id] && a.check(stats)).map((a) => a.id);
}

export function achievement(id) {
  return ACHIEVEMENTS.find((a) => a.id === id) || null;
}
