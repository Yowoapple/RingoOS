export const PERIODS = ['all', 'month', 'quarter', 'year'];
export const KINDS = ['all', 'expense', 'income', 'transfer'];

export function emptyFilters() {
  return { q: '', kind: 'all', period: 'all', range: null, categories: [], min: null, max: null, fixed: false };
}

function monthsBack(todayKey, count) {
  const [y, m] = todayKey.split('-').map(Number);
  const d = new Date(y, m - 1 - count, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function periodStart(period, todayKey) {
  if (period === 'month') return `${todayKey.slice(0, 7)}-01`;
  if (period === 'quarter') return monthsBack(todayKey, 2);
  if (period === 'year') return `${todayKey.slice(0, 4)}-01-01`;
  return null;
}

function normalizeNumber(text) {
  const cleaned = text.replace(/[,，]/g, '');
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
}

export function parseQuery(q) {
  return String(q || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const compare = token.match(/^([<>]=?)(.+)$/);
      if (compare) {
        const value = normalizeNumber(compare[2]);
        if (value !== null) return { op: compare[1], value };
      }
      const value = normalizeNumber(token);
      return value !== null ? { text: token, value } : { text: token };
    });
}

function tokenMatches(token, item) {
  if (token.op) {
    if (token.op === '>') return item.amount > token.value;
    if (token.op === '>=') return item.amount >= token.value;
    if (token.op === '<') return item.amount < token.value;
    return item.amount <= token.value;
  }
  const hay = `${item.note || ''} ${item.category || ''}`.toLowerCase();
  if (hay.includes(token.text)) return true;
  return token.value !== undefined && item.amount === token.value;
}

export function collect(state, transfers = []) {
  const items = [];
  Object.entries(state.days || {}).forEach(([dateKey, day]) => {
    (day.income || []).forEach((entry) => items.push({ ...entry, kind: 'income', dateKey }));
    (day.expenses || []).forEach((entry) => items.push({ ...entry, kind: 'expense', dateKey }));
  });
  transfers.forEach((t) => {
    if (!t.dateKey) return;
    items.push({
      id: t.id,
      kind: 'transfer',
      dateKey: t.dateKey,
      amount: t.amount,
      signed: t.signed,
      transferType: t.type,
      goalId: t.goalId,
      goalTitle: t.goalTitle,
      category: t.goalTitle,
      note: t.signed < 0 ? '從目標取出' : '存到目標',
      createdAt: Date.parse(t.date) || 0,
    });
  });
  return items;
}

export function search(items, filters, todayKey) {
  const f = { ...emptyFilters(), ...filters };
  const tokens = parseQuery(f.q);
  const ranged = f.period === 'range' && f.range;
  const start = ranged ? f.range.from : periodStart(f.period, todayKey);
  const end = ranged ? f.range.to : null;
  const cats = new Set(f.categories || []);
  const min = Number.isFinite(f.min) ? f.min : null;
  const max = Number.isFinite(f.max) ? f.max : null;
  const results = items.filter((item) => {
    if (f.kind !== 'all' && item.kind !== f.kind) return false;
    if (start && item.dateKey < start) return false;
    if (end && item.dateKey > end) return false;
    if (!ranged && item.dateKey > todayKey && f.period !== 'all') return false;
    if (cats.size && !cats.has(item.category)) return false;
    if (min !== null && item.amount < min) return false;
    if (max !== null && item.amount > max) return false;
    if (f.fixed && !(item.kind === 'expense' && item.recurring)) return false;
    return tokens.every((token) => tokenMatches(token, item));
  });
  results.sort((a, b) => (a.dateKey === b.dateKey ? (b.createdAt || 0) - (a.createdAt || 0) : a.dateKey < b.dateKey ? 1 : -1));
  let total = 0;
  const groups = [];
  results.forEach((item) => {
    const monthKey = item.dateKey.slice(0, 7);
    let group = groups[groups.length - 1];
    if (!group || group.monthKey !== monthKey) {
      group = { monthKey, items: [], sum: 0 };
      groups.push(group);
    }
    group.items.push(item);
    const signed = item.kind === 'income' ? item.amount : item.kind === 'expense' ? -item.amount : 0;
    group.sum += signed;
    total += signed;
  });
  return { results, groups, total, count: results.length };
}

export function isFiltered(filters) {
  const f = { ...emptyFilters(), ...filters };
  return !!(f.q.trim() || f.kind !== 'all' || f.period !== 'all' || (f.categories && f.categories.length) || f.min !== null || f.max !== null || f.fixed);
}
