import { Calc } from '../../core/calculations.js';
import { Data } from '../../core/data-model.js';

export const PERSONAS = ['neutral', 'maid', 'wife', 'sister'];

export const STATUS_LABEL = {
  empty: '尚無記錄',
  positive: '狀態穩定',
  warning: '稍微留意',
  danger: '需要注意',
};

const VOICES = {
  neutral: {
    emptyNow: [
      ['{p}還是一張白紙。', '先記下今天的一筆，之後回頭看會很有感覺。'],
      ['{p}還沒有任何一筆。', '隨時開始都不嫌晚，從手邊這筆花費開始就好。'],
    ],
    emptyPast: [['{p}沒有留下紀錄。']],
    positive: [
      ['{p}過得很穩。', '這個步調很好，照這樣走下去就對了。'],
      ['{p}的收支是正的。', '手頭寬鬆的時候，也可以撥一點犒賞自己。'],
      ['存下來的，比花掉的多。', '很扎實的節奏，繼續保持。'],
    ],
    warning: [
      ['{p}花得有點快。', '還在能接受的範圍，接下來留意一下就好。'],
      ['支出快追上收入了。', '花錢前多想一秒，先顧必要的開銷。'],
      ['{p}有點緊，但還撐得住。', '不急的花費往後挪一挪，很快就能拉回來。'],
    ],
    danger: [
      ['{p}花得比賺得多。', '先別自責，看看是不是有一次性的大筆支出。'],
      ['{p}手頭比較緊。', '接下來以必要開銷為主，其他的先緩一緩。'],
      ['收支落差有點大。', '這種時候本來就會有，先照顧好自己，再慢慢調整。'],
    ],
  },
  maid: {
    emptyNow: [
      ['主人，{p}還沒有紀錄呢。', '從今天開始記一筆吧，奴家會幫您顧好每一筆帳。'],
      ['{p}的帳本還是空的。', '主人請隨時開始，奴家已經準備好了。'],
    ],
    emptyPast: [['主人，{p}沒有留下紀錄呢。']],
    positive: [
      ['主人{p}過得很穩呢。', '奴家看了也放心，請繼續保持這個步調。'],
      ['{p}手頭很寬裕。', '辛苦主人了，偶爾犒賞自己也是應該的。'],
      ['存下來的比花掉的多。', '主人做得非常好，奴家由衷地感到欣慰。'],
    ],
    warning: [
      ['主人，{p}花得多了一些。', '還在能接受的範圍，接下來奴家會多留意。'],
      ['支出快追上收入了。', '主人別擔心，非必要的花費先緩一緩就好。'],
      ['{p}手頭有點緊了。', '下一筆開銷前請多想一下下，奴家會在旁邊提醒您。'],
    ],
    danger: [
      ['主人，{p}透支了。', '請先別自責，奴家陪您一起看看是哪裡花多了。'],
      ['{p}手頭比較緊。', '請以必要的開銷為優先，其他的奴家幫您記著。'],
      ['收支落差有點大。', '辛苦主人了，先照顧好自己，之後再慢慢調整回來。'],
    ],
  },
  wife: {
    emptyNow: [
      ['{p}還沒有紀錄喔。', '從今天記一筆吧，我陪你一起看著它怎麼過。'],
      ['{p}的帳本還是空的。', '什麼時候想開始都可以，我在這裡等你。'],
    ],
    emptyPast: [['{p}沒有留下紀錄喔。']],
    positive: [
      ['{p}過得很穩呢。', '辛苦你了，這個步調很好，我們繼續保持。'],
      ['{p}手頭很寬鬆。', '在外面打拚辛苦了，偶爾也要對自己好一點。'],
      ['存下來的比花掉的多。', '做得很好，我看了也替你開心。'],
    ],
    warning: [
      ['{p}花得有點快喔。', '還在能接受的範圍，接下來我們一起留意。'],
      ['支出快追上收入了。', '不急的花費先往後挪，我們一起把節奏抓回來。'],
      ['{p}手頭有點緊了。', '下一筆開銷多想一下，別太累著自己。'],
    ],
    danger: [
      ['{p}花得比賺得多。', '先別太苛責自己，我們一起看看哪裡花多了，好嗎。'],
      ['{p}手頭比較緊。', '先顧必要的開銷，其他的等手頭鬆一點再說。'],
      ['收支落差有點大。', '辛苦你了，先照顧好自己，之後我們再慢慢調整。'],
    ],
  },
  sister: {
    emptyNow: [
      ['欸，{p}都還沒記帳誒。', '快從今天開始啦，不然到時候你會後悔的喔 (°ロ°)'],
      ['{p}的帳本空空的耶。', '現在就記一筆嘛，我在旁邊看著你喔 (・ω・)ノ'],
    ],
    emptyPast: [['{p}什麼都沒記耶。']],
    positive: [
      ['{p}過得很穩嘛。', '做得不錯喔，這個節奏繼續保持就對了 (๑˃ᴗ˂)ﻭ'],
      ['{p}手頭超寬鬆的。', '辛苦你了，偶爾寵一下自己也沒關係啦 (´▽`)'],
      ['存得比花得多耶。', '超棒的好嗎，繼續加油喔！'],
    ],
    warning: [
      ['{p}花得有點多喔。', '還好啦，還在可以接受的範圍，接下來小心一點 (´・ω・`)'],
      ['支出快追上收入了啦。', '非必要的先忍一下，我們一起撐過去。'],
      ['{p}手頭有點緊誒。', '花錢前多想一下下啦，不要手滑喔。'],
    ],
    danger: [
      ['{p}花超多的耶。', '先不要太自責啦，是不是有什麼臨時的大筆花費 (＞﹏＜)'],
      ['{p}真的有點緊誒。', '先顧好必要的就好，其他的忍一忍啦。'],
      ['收支落差有點大喔。', '先照顧好自己比較重要，之後再慢慢調回來。'],
    ],
  },
};

const MIN_GAP = 1000;
const GAP_RATIO = 0.15;
const STREAK_LINE = 3;
const MAX_DETAILS = 2;

function hashKey(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  return hash;
}

function pick(pool, seed) {
  return pool[hashKey(seed) % pool.length];
}

function money(value, sign = false) {
  return { n: Math.round(Math.abs(value)), kind: 'amount', sign: sign ? Math.sign(value) : 0 };
}

function count(value) {
  return { n: value, kind: 'count' };
}

function pct(value) {
  return { n: Math.round(value), kind: 'pct' };
}

export function tokensToText(tokens) {
  return tokens.map((token) => {
    if (typeof token === 'string') return token;
    const digits = token.n.toLocaleString('en-US');
    if (token.kind === 'amount') return `${token.sign > 0 ? '+' : token.sign < 0 ? '−' : ''}${digits}`;
    if (token.kind === 'pct') return `${digits}%`;
    return digits;
  }).join('');
}

function periodOf(mode, anchorKey) {
  if (mode === 'month') {
    const monthKey = Data.toMonthKey(anchorKey);
    return { keys: Calc.getMonthDateKeys(monthKey), monthKey, seed: monthKey };
  }
  const keys = Calc.getWeekDateKeys(anchorKey);
  return { keys, monthKey: Data.toMonthKey(keys[0]), seed: keys[0] };
}

function previousKeys(mode, keys) {
  if (mode === 'week') return keys.map((key) => Calc.shiftDateKey(key, -7));
  return Calc.getMonthDateKeys(Calc.getPreviousMonthKey(Data.toMonthKey(keys[0])));
}

function periodNoun(mode, keys, current) {
  if (current) return mode === 'month' ? '這個月' : '這週';
  if (mode === 'month') return `${Number(keys[0].slice(5, 7))} 月`;
  return '那一週';
}

function monthBudgetTotal(monthKey) {
  return Object.values(Data.getMonthlyBudgets(monthKey)).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function comparisonOf(mode, keys, elapsed, summary) {
  const previous = previousKeys(mode, keys);
  const whole = Calc.summarizeDateKeys(previous);
  if (whole.income === 0 && whole.expense === 0) return null;
  const partial = elapsed < keys.length;
  const before = partial ? Calc.summarizeDateKeys(previous.slice(0, elapsed)) : whole;
  const diff = summary.expense - before.expense;
  return {
    diff,
    partial,
    previousExpense: before.expense,
    previousByCategory: before.expenseByCategory,
    previousKeys: previous,
  };
}

function driverOf(summary, comparison) {
  return Calc.getCategoryDriver(summary.expenseByCategory, comparison ? comparison.previousByCategory : null);
}

function projectionOf(keys, todayKey, budget) {
  const index = keys.indexOf(todayKey);
  if (index === -1) return null;
  const day = index + 1;
  if (day <= 3 || day >= keys.length - 1) return null;
  const spent = Calc.summarizeDateKeys(keys.slice(0, day)).expense;
  if (spent <= 0) return null;
  const projected = Math.round((spent / day) * keys.length);
  return { day, projected, budget, over: budget > 0 && projected > budget };
}

function goalOf() {
  const goals = Data.getState().settings.savingsGoals || [];
  let best = null;
  let bestRatio = -1;
  goals.forEach((goal) => {
    const ratio = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = goal;
    }
  });
  if (!best) return null;
  return { goal: best, ratio: Math.max(0, Math.min(1, bestRatio)), projection: Calc.getGoalProjection(best) };
}

function overBudgetOf(monthKey) {
  return Calc.computeMonthSummary(monthKey).budgetBreakdown
    .filter((item) => item.status === 'danger')
    .map((item) => ({ category: item.category, over: item.spent - item.budget }))
    .sort((a, b) => b.over - a.over);
}

function details(ctx) {
  const { mode, unit, comparison, driver, streak, projection, over, goal, status } = ctx;
  const lines = [];
  if (status === 'empty') return lines;
  if (over.length === 1) {
    lines.push(['「', over[0].category, '」超出預算 NT$ ', money(over[0].over), '。']);
  } else if (over.length > 1) {
    lines.push(['「', over.slice(0, 2).map((item) => item.category).join('、'), '」', over.length > 2 ? '等 ' : '', over.length > 2 ? count(over.length) : '', over.length > 2 ? ' 個分類' : '', '都超出預算了。'].filter((t) => t !== ''));
  }
  if (projection && projection.over) {
    lines.push(['照這 ', count(projection.day), ' 天的速度，月底約 NT$ ', money(projection.projected), '，會比預算多 NT$ ', money(projection.projected - projection.budget), '。']);
  }
  if (lines.length < MAX_DETAILS && streak >= STREAK_LINE) {
    lines.push(['已經連續 ', count(streak), mode === 'month' ? ' 個月' : ' 週', '收支為正。']);
  }
  if (lines.length < MAX_DETAILS && comparison) {
    const gap = Math.abs(comparison.diff);
    if (gap >= Math.max(MIN_GAP, comparison.previousExpense * GAP_RATIO)) {
      const label = comparison.partial ? `比上${unit}同期` : `比上${unit}`;
      lines.push([label, comparison.diff > 0 ? '多花了 NT$ ' : '少花了 NT$ ', money(gap), '。']);
      if (lines.length < MAX_DETAILS && driver && comparison.diff > 0 && driver.mode === 'increase') {
        lines.push(['漲最多的是', driver.category, '，多了 NT$ ', money(driver.diff), '。']);
      }
    }
  }
  if (lines.length < MAX_DETAILS && goal && mode === 'month') {
    const { projection: gp, goal: g, ratio } = goal;
    const tail = gp.hasHistory && gp.monthsRemaining > 0 ? ['，照目前的存法約再 ', count(gp.monthsRemaining), ' 個月。'] : ['。'];
    lines.push(['「', g.title, '」已經存到 ', pct(ratio * 100), ...tail]);
  }
  return lines.slice(0, MAX_DETAILS);
}

function clues(ctx) {
  const { mode, unit, keys, anchorKey, summary, comparison, driver, streak, projection, goal, budget, status } = ctx;
  const list = [];
  const here = { mode, anchorKey };
  if (status === 'empty') return list;
  if (budget > 0) {
    const ratio = (summary.expense / budget) * 100;
    list.push({ id: 'budget', label: mode === 'month' ? '預算用了' : '週預算用了', value: [pct(ratio)], note: `NT$ ${Math.round(budget).toLocaleString('en-US')}`, accent: ratio >= 100, target: here });
  }
  if (projection) {
    list.push({ id: 'projection', label: '月底推估', value: ['NT$ ', money(projection.projected)], note: projection.over ? '會超過預算' : `第 ${projection.day} 天推算`, accent: projection.over, target: here });
  }
  if (comparison) {
    list.push({ id: 'compare', label: comparison.partial ? `比上${unit}同期` : `比上${unit}`, value: [money(comparison.diff, true)], note: comparison.diff > 0 ? '多花' : comparison.diff < 0 ? '少花' : '一樣', accent: false, target: { mode, anchorKey: comparison.previousKeys[comparison.previousKeys.length - 1] } });
  }
  if (driver) {
    const rising = driver.mode === 'increase';
    list.push({ id: 'driver', label: rising ? '漲最多' : '花最多', value: [driver.category], note: rising ? `多了 NT$ ${Math.round(driver.diff).toLocaleString('en-US')}` : `NT$ ${Math.round(driver.amount).toLocaleString('en-US')}`, accent: false, target: here });
  }
  if (streak > 0) {
    const back = mode === 'month' ? Calc.shiftDateKey(keys[0], -1) : Calc.shiftDateKey(keys[0], -7);
    list.push({ id: 'streak', label: '連續收支為正', value: [count(streak), mode === 'month' ? ' 個月' : ' 週'], note: '已結束的期間', accent: false, target: { mode, anchorKey: back } });
  }
  if (goal && mode === 'month') {
    list.push({ id: 'goal', label: goal.goal.title, value: [pct(goal.ratio * 100)], note: '存錢目標', accent: false, target: null });
  }
  return list;
}

export function buildInsight({ mode, anchorKey, persona = 'neutral', todayKey = Data.toDateKey(new Date()) }) {
  const voice = VOICES[persona] || VOICES.neutral;
  const { keys, monthKey, seed } = periodOf(mode, anchorKey);
  const current = keys.includes(todayKey);
  const index = keys.indexOf(todayKey);
  const elapsed = current ? index + 1 : keys.length;
  const summary = Calc.summarizeDateKeys(keys);
  const empty = summary.income === 0 && summary.expense === 0;
  const status = empty ? 'empty' : Calc.getNetStatus(summary.income, summary.expense).status;
  const unit = mode === 'month' ? '月' : '週';
  const monthly = monthBudgetTotal(monthKey);
  const budget = mode === 'month' ? monthly : Math.round((monthly * 7) / Calc.getMonthDateKeys(monthKey).length);
  const comparison = empty ? null : comparisonOf(mode, keys, elapsed, summary);
  const ctx = {
    mode,
    unit,
    keys,
    anchorKey,
    summary,
    status,
    budget,
    comparison,
    driver: empty ? null : driverOf(summary, comparison),
    streak: mode === 'month' ? Calc.getConsecutiveGoodMonths(monthKey) : Calc.getConsecutiveGoodWeeks(keys[0]),
    projection: mode === 'month' && current ? projectionOf(keys, todayKey, monthly) : null,
    over: mode === 'month' ? overBudgetOf(monthKey) : [],
    goal: mode === 'month' ? goalOf() : null,
  };
  const poolName = empty ? (current ? 'emptyNow' : 'emptyPast') : status;
  const [headline, advice] = pick(voice[poolName], `${seed}-${poolName}-${persona}`);
  const noun = periodNoun(mode, keys, current);
  const lead = headline.replace('{p}', noun);
  const sub = current && advice ? advice : null;
  const forecastOver = !!(ctx.projection && ctx.projection.over);
  return {
    mode,
    status,
    tone: status === 'danger' || forecastOver ? 'alert' : 'calm',
    label: forecastOver && status !== 'danger' ? '推估超支' : STATUS_LABEL[status],
    current,
    keys,
    lead,
    sub,
    details: details(ctx),
    clues: clues(ctx),
    seed: `${seed}-${poolName}-${persona}`,
  };
}
