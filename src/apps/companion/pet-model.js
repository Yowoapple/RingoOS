export const DEFAULT_NAME = 'SAYA';
export const LEVELS = [0, 30, 80, 150, 250, 380, 540, 740, 980, 1260];
export const TITLES = ['初次見面', '認識了', '熟人', '朋友', '好朋友', '知己', '摯友', '很親', '家人', '形影不離'];
export const TREAT_CAP = 9;
export const FEEDS_PER_DAY = 5;
export const GOAL_TREATS_PER_DAY = 3;

const FULL_DECAY_PER_HOUR = 4;
const MOOD_DRIFT_PER_HOUR = 2;
const MOOD_FLOOR = 15;
const MEAL = [30, 15, 8, 5, 5, 4, 3];
const KEEP_DAYS = 40;
const REVOCABLE = new Set(['log', 'need', 'note']);

export const GOALS = {
  log: { label: '記一筆帳', check: (c) => c.entries > 0 },
  need: { label: '幫一筆支出標「需要／想要」', check: (c) => c.tagged > 0 },
  note: { label: '幫一筆紀錄寫備註', check: (c) => c.noted > 0 },
  task: { label: '完成一件代辦', check: (c) => c.tasksDone > 0, when: (c) => c.pendingTasks > 0 || c.tasksDone > 0 },
  pat: { label: '摸摸她的頭', check: (c) => c.pats > 0 },
  save: { label: '存一筆錢到目標', check: (c) => c.deposits > 0, when: (c) => c.goals > 0 },
  budget: { label: '今天花費守在每日預算內', check: (c) => c.dailyBudget > 0 && c.expense <= c.dailyBudget && c.hour >= 20, when: (c) => c.dailyBudget > 0 },
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function hash(text) {
  let value = 7;
  for (let i = 0; i < text.length; i += 1) value = (value * 31 + text.charCodeAt(i)) % 1000003;
  return value;
}

export function defaultLife(now = Date.now()) {
  return {
    name: DEFAULT_NAME,
    fullness: 60,
    mood: 60,
    bond: 0,
    treats: 0,
    lastTick: now,
    streak: { count: 0, last: null },
    days: {},
    seen: [],
  };
}

export function normalize(raw, now = Date.now()) {
  const base = defaultLife(now);
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 12) : DEFAULT_NAME,
    fullness: clamp(Number(raw.fullness) || 0, 0, 100),
    mood: clamp(Number(raw.mood) || 0, MOOD_FLOOR, 100),
    bond: Math.max(0, Number(raw.bond) || 0),
    treats: clamp(Math.floor(Number(raw.treats) || 0), 0, TREAT_CAP),
    streak: raw.streak && typeof raw.streak === 'object' ? { count: raw.streak.count || 0, last: raw.streak.last || null } : base.streak,
    days: raw.days && typeof raw.days === 'object' ? raw.days : {},
    seen: Array.isArray(raw.seen) ? raw.seen.slice(0, 64) : [],
  };
}

export function levelOf(bond) {
  let level = 1;
  LEVELS.forEach((need, i) => {
    if (bond >= need) level = i + 1;
  });
  const floor = LEVELS[level - 1];
  const next = LEVELS[level] ?? null;
  return { level, title: TITLES[level - 1], floor, next, progress: next === null ? 1 : (bond - floor) / (next - floor) };
}

export function mealFor(count) {
  let total = 0;
  for (let i = 0; i < count; i += 1) total += MEAL[Math.min(i, MEAL.length - 1)];
  return Math.min(70, total);
}

export function decay(life, now = Date.now()) {
  const since = Number.isFinite(life.lastTick) ? life.lastTick : now;
  const hours = Math.max(0, (now - since) / 3600000);
  if (hours <= 0) return { ...life, lastTick: now };
  const moodGap = life.mood - 50;
  const drift = Math.min(Math.abs(moodGap), MOOD_DRIFT_PER_HOUR * hours) * Math.sign(moodGap);
  return {
    ...life,
    fullness: clamp(life.fullness - FULL_DECAY_PER_HOUR * hours, 0, 100),
    mood: clamp(life.mood - drift, MOOD_FLOOR, 100),
    lastTick: now,
  };
}

function prevKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dayOf(life, dateKey) {
  return life.days[dateKey] || { fed: 0, checked: false, prevStreak: null, goals: {}, goalTreats: 0, feeds: 0, tasksDone: 0, pats: 0, deposits: 0 };
}

export function goalsFor(dateKey, ctx) {
  const eligible = Object.keys(GOALS).filter((id) => id !== 'log' && (!GOALS[id].when || GOALS[id].when(ctx)));
  const picked = ['log'];
  const seed = hash(dateKey);
  const pool = eligible.slice().sort((a, b) => hash(`${dateKey}${a}`) - hash(`${dateKey}${b}`));
  for (let i = 0; i < pool.length && picked.length < 3; i += 1) picked.push(pool[(i + seed) % pool.length]);
  return Array.from(new Set(picked)).slice(0, 3);
}

export function sync(life, dateKey, ctx) {
  const events = [];
  let next = { ...life, days: { ...life.days } };
  const day = { ...dayOf(next, dateKey) };
  const full = { ...ctx, tasksDone: day.tasksDone, pats: day.pats, deposits: day.deposits };
  const target = mealFor(full.entries);
  if (target !== day.fed) {
    next.fullness = clamp(next.fullness + (target - day.fed), 0, 100);
    day.fed = target;
  }
  if (full.entries > 0 && !day.checked) {
    const continuing = next.streak.last === prevKey(dateKey);
    day.prevStreak = { ...next.streak };
    const count = continuing ? next.streak.count + 1 : 1;
    next.streak = { count, last: dateKey };
    day.checked = true;
    day.checkBond = 10 + Math.floor(Math.min(count, 30) / 3);
    next.bond += day.checkBond;
    next.treats = clamp(next.treats + 1, 0, TREAT_CAP);
    next.mood = clamp(next.mood + 6, MOOD_FLOOR, 100);
    events.push({ type: 'checkin', streak: count });
  } else if (full.entries === 0 && day.checked && day.prevStreak) {
    next.streak = { ...day.prevStreak };
    next.bond = Math.max(0, next.bond - (day.checkBond || 0));
    day.checkBond = 0;
    next.treats = clamp(next.treats - 1, 0, TREAT_CAP);
    day.checked = false;
    day.prevStreak = null;
    events.push({ type: 'uncheck' });
  }
  goalsFor(dateKey, full).forEach((id) => {
    if (day.goals[id] || !GOALS[id].check(full)) return;
    day.goals = { ...day.goals, [id]: true };
    next.bond += 2;
    if (day.goalTreats < GOAL_TREATS_PER_DAY) {
      day.goalTreats += 1;
      next.treats = clamp(next.treats + 1, 0, TREAT_CAP);
    }
    events.push({ type: 'goal', id });
  });
  Object.keys(day.goals).forEach((id) => {
    if (!REVOCABLE.has(id) || !GOALS[id] || GOALS[id].check(full)) return;
    const goals = { ...day.goals };
    delete goals[id];
    day.goals = goals;
    next.bond = Math.max(0, next.bond - 2);
    if (day.goalTreats > 0) {
      day.goalTreats -= 1;
      next.treats = clamp(next.treats - 1, 0, TREAT_CAP);
    }
    events.push({ type: 'revoke', id });
  });
  next.days[dateKey] = day;
  const keys = Object.keys(next.days).sort();
  keys.slice(0, Math.max(0, keys.length - KEEP_DAYS)).forEach((key) => delete next.days[key]);
  const before = levelOf(life.bond).level;
  const after = levelOf(next.bond).level;
  if (after > before) events.push({ type: 'level', level: after, title: TITLES[after - 1] });
  return { life: next, events };
}

export function count(life, dateKey, key, amount = 1) {
  const day = { ...dayOf(life, dateKey) };
  day[key] = (day[key] || 0) + amount;
  return { ...life, days: { ...life.days, [dateKey]: day } };
}

export function nudgeMood(life, amount) {
  return { ...life, mood: clamp(life.mood + amount, MOOD_FLOOR, 100) };
}

export function feed(life, dateKey) {
  const day = { ...dayOf(life, dateKey) };
  if (life.treats <= 0) return { life, ok: false, reason: 'empty' };
  if (day.feeds >= FEEDS_PER_DAY) return { life, ok: false, reason: 'full' };
  day.feeds += 1;
  const before = levelOf(life.bond).level;
  const next = {
    ...life,
    treats: life.treats - 1,
    fullness: clamp(life.fullness + 15, 0, 100),
    mood: clamp(life.mood + 10, MOOD_FLOOR, 100),
    bond: life.bond + 1,
    days: { ...life.days, [dateKey]: day },
  };
  const after = levelOf(next.bond).level;
  return { life: next, ok: true, levelUp: after > before ? { level: after, title: TITLES[after - 1] } : null };
}

export function stateOf(life) {
  if (life.fullness < 25) return 'hungry';
  if (life.mood < 35) return 'sad';
  if (life.mood >= 72 && life.fullness >= 50) return 'happy';
  return 'calm';
}

export function markSeen(life, file) {
  if (!file || life.seen.includes(file)) return life;
  return { ...life, seen: [...life.seen, file] };
}
