export function cumulative(daily) {
  let sum = 0;
  return daily.map((value) => {
    sum += value || 0;
    return sum;
  });
}

export function paceSeries({ daily, previousDaily = [], todayIndex = -1, budget = 0 }) {
  const full = cumulative(daily);
  const shown = todayIndex >= 0 ? full.map((value, i) => (i <= todayIndex ? value : null)) : full;
  const prev = cumulative(previousDaily).slice(0, daily.length);
  let projection = null;
  if (todayIndex >= 0 && todayIndex < daily.length - 1 && full[todayIndex] > 0) {
    projection = Math.round((full[todayIndex] / (todayIndex + 1)) * daily.length);
  }
  const top = Math.max(1, budget || 0, ...full.filter((v, i) => todayIndex < 0 || i <= todayIndex), ...prev, projection || 0);
  return { values: shown, prev, budget: budget || 0, todayIndex, projection, max: top };
}

export function slices(byCategory, limit = 5) {
  const ranked = Object.entries(byCategory || {})
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((sum, [, amount]) => sum + amount, 0);
  if (!total) return { total: 0, items: [] };
  const head = ranked.slice(0, limit).map(([category, amount]) => ({ id: category, category, amount, share: amount / total }));
  const rest = ranked.slice(limit);
  if (rest.length) {
    const amount = rest.reduce((sum, [, value]) => sum + value, 0);
    head.push({ id: '__rest', category: `其餘 ${rest.length} 項`, amount, share: amount / total, rest: rest.map(([category]) => category) });
  }
  return { total, items: head };
}

export function monthKeysBack(monthKey, count) {
  const [y, m] = monthKey.split('-').map(Number);
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}
