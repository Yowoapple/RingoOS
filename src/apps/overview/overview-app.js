import { createMotion } from '../../motion/animator.js';
import { MotionSettings } from '../../motion/presets.js';
import { Data } from '../../core/data-model.js';
import { Calc } from '../../core/calculations.js';
import { createSegmented } from '../../ui/segmented.js';
import { createOdometer, formatAmount } from '../../ui/odometer.js';
import { createBarChart } from '../../ui/chart.js';
import { Fx } from '../../ui/fx-tier.js';
import { createDonut, createPaceChart, createTrend } from './charts.js';
import { monthKeysBack, paceSeries, slices } from './series.js';

const MODES = ['month', 'week'];
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
const RANK_LIMIT = 5;
const SOFT = { response: 0.6, damping: 0.72 };

function pad(n) {
  return String(n).padStart(2, '0');
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function today() {
  return startOfDay(new Date());
}

function parseKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function shortDate(dateKey) {
  const date = parseKey(dateKey);
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function signed(value) {
  if (value > 0) return `+${formatAmount(value)}`;
  if (value < 0) return `−${formatAmount(value)}`;
  return '0';
}

function spring(config) {
  return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
}

export function createOverviewApp({ root, periodTag, nowButton, prevButton, nextButton, onFind }) {
  const $ = (name) => root.querySelector(`[data-ov="${name}"]`);
  const heroLabel = $('hero-label');
  const rangeTag = $('range');
  const deltaEl = $('delta');
  const budgetFill = $('budget-fill');
  const budgetLegend = $('budget-legend');
  const budgetPct = $('budget-pct');
  const projectionEl = $('projection');
  const budgetLine = $('budget-line');
  const chartTitle = $('chart-title');
  const rankEmpty = $('rank-empty');
  const needBlock = $('need-block');
  const needPct = $('need-pct');
  const needAmt = $('need-amt');
  const wantAmt = $('want-amt');
  const splitNeed = $('split-need');
  const splitWant = $('split-want');

  let mode = 'month';
  let anchor = today();

  const expenseOdo = createOdometer($('expense'), { value: 0 });
  const incomeOdo = createOdometer($('income'), { value: 0, format: signed });
  const netOdo = createOdometer($('net'), { value: 0, format: signed });
  const savedOdo = createOdometer($('saved'), { value: 0, format: signed });
  const savedCell = $('saved-cell');
  const chart = createBarChart($('chart'), $('chart-labels'), { values: [], labels: [], todayIndex: -1, format: (v) => formatAmount(v) });
  const paceTitle = $('pace-title');
  const pacePrev = $('pace-prev');
  const paceNow = $('pace-now');
  const paceAxis = $('pace-axis');
  let paceKeys = [];
  const pace = createPaceChart($('pace'), { labelFor: (i) => (paceKeys[i] ? shortDate(paceKeys[i]) : '') });
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => pace.resize()).observe($('pace'));
  const donut = createDonut($('donut'), {
    onFind(categories) {
      const keys = periodKeys();
      if (onFind) onFind({ categories, range: { from: keys[0], to: keys[keys.length - 1], label: tagText(keys) } });
    },
  });
  const trend = createTrend($('trend'), {
    onPick(monthKey) {
      const [y, m] = monthKey.split('-').map(Number);
      const last = new Date(y, m, 0);
      anchor = last > today() ? today() : last;
      if (mode !== 'month') segment.select(0);
      else render({ stagger: true });
    },
  });

  const budgetMotion = createMotion({ f: 0 }, { response: 0.6, damping: 0.8, restDelta: 0.0005 });
  budgetMotion.onUpdate(({ f }) => {
    budgetFill.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`;
  });

  const splitMotion = createMotion({ n: 0.5 }, { response: 0.55, damping: 0.74, restDelta: 0.0005 });
  splitMotion.onUpdate(({ n }) => {
    const need = Math.max(0.02, Math.min(0.98, n));
    splitNeed.style.flexGrow = need.toFixed(4);
    splitWant.style.flexGrow = (1 - need).toFixed(4);
  });

  const segment = createSegmented($('mode'), {
    onChange(index) {
      mode = MODES[index];
      render({ stagger: true });
    },
  });

  function isCurrent() {
    const now = today();
    if (mode === 'month') return Data.toMonthKey(Data.toDateKey(anchor)) === Data.toMonthKey(Data.toDateKey(now));
    const week = Calc.getWeekDateKeys(Data.toDateKey(now));
    return week.includes(Data.toDateKey(anchor));
  }

  function periodKeys() {
    const key = Data.toDateKey(anchor);
    return mode === 'month' ? Calc.getMonthDateKeys(Data.toMonthKey(key)) : Calc.getWeekDateKeys(key);
  }

  function elapsedCount(keys) {
    const todayKey = Data.toDateKey(today());
    const index = keys.indexOf(todayKey);
    return index === -1 ? keys.length : index + 1;
  }

  function previousKeys(keys) {
    if (mode === 'week') return keys.map((key) => Calc.shiftDateKey(key, -7));
    return Calc.getMonthDateKeys(Calc.getPreviousMonthKey(Data.toMonthKey(keys[0])));
  }

  function renderDelta(keys, summary) {
    const count = elapsedCount(keys);
    const previous = previousKeys(keys);
    const whole = count === keys.length;
    const before = Calc.summarizeDateKeys(whole ? previous : previous.slice(0, count));
    const unit = mode === 'month' ? '上月' : '上週';
    const hasPrevious = Calc.summarizeDateKeys(previous);
    if (hasPrevious.income === 0 && hasPrevious.expense === 0) {
      deltaEl.hidden = true;
      return;
    }
    const diff = summary.expense - before.expense;
    const label = whole ? unit : `${unit}同期`;
    deltaEl.hidden = false;
    deltaEl.textContent = diff === 0 ? `和${label}一樣` : `比${label}${diff > 0 ? '多' : '少'} NT$ ${formatAmount(diff)}`;
    deltaEl.classList.toggle('is-up', diff > 0);
  }

  function renderBudget(keys, summary) {
    const monthKey = Data.toMonthKey(keys[0]);
    const budgets = Data.getMonthlyBudgets(monthKey);
    const monthly = Object.values(budgets).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const total = mode === 'month' ? monthly : Math.round((monthly * 7) / Calc.getMonthDateKeys(monthKey).length);
    if (total <= 0) {
      budgetLegend.textContent = '還沒設預算';
      budgetPct.textContent = '';
      budgetFill.classList.remove('is-over');
      budgetMotion.to({ f: 0 }, spring(SOFT));
      return;
    }
    const ratio = summary.expense / total;
    budgetLegend.textContent = mode === 'month' ? `預算 NT$ ${formatAmount(total)}` : `週預算約 NT$ ${formatAmount(total)}`;
    budgetPct.textContent = `${Math.round(ratio * 100)}%`;
    budgetFill.classList.toggle('is-over', ratio >= 1);
    budgetPct.classList.toggle('is-over', ratio >= 1);
    budgetMotion.to({ f: ratio }, spring(SOFT));
  }

  function renderNotes(keys) {
    projectionEl.hidden = true;
    budgetLine.hidden = true;
    if (mode !== 'month') return;
    const monthKey = Data.toMonthKey(keys[0]);
    const projection = Calc.getMidMonthProjection(monthKey);
    if (projection.applicable && projection.currentExpense > 0) {
      projectionEl.hidden = false;
      projectionEl.textContent = `照目前速度，月底約 NT$ ${formatAmount(projection.projectedExpense)}${projection.overProjected ? '，會超過預算' : ''}`;
      projectionEl.classList.toggle('is-over', projection.overProjected);
    }
    const summary = Calc.computeMonthSummary(monthKey);
    const budgeted = summary.budgetBreakdown.some((item) => item.budget > 0);
    if (!budgeted) return;
    budgetLine.hidden = false;
    const parts = [];
    if (summary.overBudgetCount > 0) parts.push(`${summary.overBudgetCount} 個分類超過預算`);
    if (summary.watchBudgetCount > 0) parts.push(`${summary.watchBudgetCount} 個分類接近上限`);
    budgetLine.textContent = parts.length ? parts.join('，') : '每個分類都還在預算內';
    budgetLine.classList.toggle('is-over', summary.overBudgetCount > 0);
  }

  function renderChart(keys, stagger) {
    const todayKey = Data.toDateKey(today());
    const values = keys.map((key) => Calc.summarizeDateKeys([key]).expense);
    const labels = mode === 'week'
      ? WEEK_LABELS.slice()
      : keys.map((key, i) => {
        const day = i + 1;
        return day === 1 || day % 5 === 0 ? String(day) : '';
      });
    chartTitle.textContent = mode === 'month' ? '每日支出' : '這週每天';
    chart.update({ values, labels, todayIndex: keys.indexOf(todayKey), stagger });
  }

  function renderPace(keys, intro) {
    const todayKey = Data.toDateKey(today());
    const daily = keys.map((key) => Calc.summarizeDateKeys([key]).expense);
    const previousDaily = previousKeys(keys).map((key) => Calc.summarizeDateKeys([key]).expense);
    const monthKey = Data.toMonthKey(keys[0]);
    const monthly = Object.values(Data.getMonthlyBudgets(monthKey)).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const budget = mode === 'month' ? monthly : Math.round((monthly * 7) / Calc.getMonthDateKeys(monthKey).length);
    paceKeys = keys;
    const current = isCurrent();
    if (mode === 'month') {
      const month = Number(monthKey.slice(5, 7));
      const prevMonth = Number(Calc.getPreviousMonthKey(monthKey).slice(5, 7));
      paceNow.textContent = current ? '本月' : `${month} 月`;
      pacePrev.textContent = current ? '上月' : `${prevMonth} 月`;
    } else {
      paceNow.textContent = current ? '本週' : '這週';
      pacePrev.textContent = current ? '上週' : '前一週';
    }
    paceTitle.textContent = mode === 'month' ? '累計支出' : '這週累計';
    const axis = paceAxis.children;
    axis[0].textContent = shortDate(keys[0]);
    axis[1].textContent = shortDate(keys[Math.floor((keys.length - 1) / 2)]);
    axis[2].textContent = shortDate(keys[keys.length - 1]);
    pace.update(paceSeries({ daily, previousDaily, todayIndex: keys.indexOf(todayKey), budget }), { intro });
  }

  function renderDonut(summary, intro) {
    const monthKey = Data.toMonthKey(periodKeys()[0]);
    const over = new Set(mode === 'month'
      ? Calc.computeMonthSummary(monthKey).budgetBreakdown.filter((item) => item.status === 'danger').map((item) => item.category)
      : []);
    const data = slices(summary.expenseByCategory, RANK_LIMIT);
    const current = isCurrent();
    const label = mode === 'month' ? (current ? '這個月' : `${Number(monthKey.slice(5, 7))} 月`) : (current ? '這週' : '那一週');
    donut.update(data, { label, intro, over });
    rankEmpty.hidden = data.items.length > 0;
    rankEmpty.textContent = mode === 'month' ? '這個月還沒有支出' : '這週還沒有支出';
  }

  function renderTrend(intro) {
    const active = Data.toMonthKey(Data.toDateKey(anchor));
    const latest = Data.toMonthKey(Data.toDateKey(today()));
    const recent = monthKeysBack(latest, 6);
    const end = recent.includes(active) ? latest : active;
    const months = monthKeysBack(end, 6).map((key) => {
      const sum = Calc.summarizeDateKeys(Calc.getMonthDateKeys(key));
      return { key, expense: sum.expense, income: sum.income, saved: sum.saved };
    });
    trend.update(months, active, { intro });
  }

  function renderNecessity(keys) {
    const { want, need, wantRatio } = Calc.getNecessityBreakdown(keys);
    if (wantRatio === null) {
      needBlock.hidden = true;
      return;
    }
    const firstShow = needBlock.hidden;
    needBlock.hidden = false;
    needPct.textContent = `想要 ${wantRatio}%`;
    needAmt.textContent = `需要 NT$ ${formatAmount(need)}`;
    wantAmt.textContent = `想要 NT$ ${formatAmount(want)}`;
    const target = need / (need + want);
    if (firstShow) splitMotion.set({ n: 0.5 });
    splitMotion.to({ n: target }, spring({ response: 0.55, damping: 0.74 }));
  }

  let tagSwap = null;
  let nowPop = null;

  function tagText(keys) {
    if (mode === 'month') {
      const date = parseKey(keys[0]);
      return `${date.getFullYear()}.${pad(date.getMonth() + 1)}`;
    }
    return `${shortDate(keys[0])} — ${shortDate(keys[6])}`;
  }

  function renderTag(keys) {
    const text = tagText(keys);
    const current = isCurrent();
    periodTag.classList.toggle('is-past', !current);
    nextButton.disabled = current;
    if (!tagSwap) {
      tagSwap = createMotion({ e: 1 }, { response: 0.3, damping: 1, restDelta: 0.002 });
      tagSwap.onUpdate(({ e }) => {
        const t = Math.max(0, Math.min(1, e));
        periodTag.style.opacity = t > 0.999 ? '' : String(t);
        periodTag.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 3).toFixed(2)}px)` : '';
      });
    }
    if (!periodTag.textContent || MotionSettings.reduced) {
      periodTag.textContent = text;
    } else if (periodTag.textContent !== text) {
      tagSwap.to({ e: 0 }, { response: 0.14, damping: 1 }).then(() => {
        periodTag.textContent = text;
        tagSwap.to({ e: 1 }, { response: 0.34, damping: 0.8 });
      });
    }
    nowButton.textContent = mode === 'month' ? '本月' : '本週';
    if (!nowPop) {
      nowPop = createMotion({ s: 0 }, { response: 0.36, damping: 0.55, restDelta: 0.002 });
      nowPop.onUpdate(({ s }) => {
        const t = Math.max(0, s);
        nowButton.style.opacity = String(Math.min(1, t));
        nowButton.style.transform = `scale(${0.6 + 0.4 * t})`;
        if (t < 0.01 && isCurrent()) nowButton.hidden = true;
      });
    }
    if (!current) {
      nowButton.hidden = false;
      nowPop.to({ s: 1 }, spring({ response: 0.36, damping: 0.55 }));
    } else if (!nowButton.hidden) {
      nowPop.to({ s: 0 }, { response: 0.2, damping: 1 });
    }
  }

  function render({ stagger = false } = {}) {
    const keys = periodKeys();
    const summary = Calc.summarizeDateKeys(keys);
    heroLabel.textContent = mode === 'month' ? '這個月支出' : '這週支出';
    rangeTag.textContent = `${shortDate(keys[0])} — ${shortDate(keys[keys.length - 1])}`;
    renderTag(keys);
    expenseOdo.set(summary.expense);
    incomeOdo.set(summary.income);
    netOdo.set(summary.net);
    const showSaved = summary.saved !== 0 || (Data.getState().settings.savingsGoals || []).length > 0;
    savedCell.hidden = !showSaved;
    savedCell.parentElement.classList.toggle('stats--3', showSaved);
    savedOdo.set(summary.saved);
    renderDelta(keys, summary);
    renderBudget(keys, summary);
    renderNotes(keys);
    renderChart(keys, stagger);
    renderPace(keys, false);
    renderDonut(summary, false);
    renderTrend(false);
    renderNecessity(keys);
  }

  function shift(direction) {
    if (direction > 0 && isCurrent()) return;
    if (mode === 'week') {
      anchor = parseKey(Calc.shiftDateKey(Data.toDateKey(anchor), direction * 7));
    } else {
      const target = new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
      const last = new Date(target.getFullYear(), target.getMonth() + 1, 0);
      anchor = last > today() ? today() : last;
    }
    if (isCurrent()) anchor = today();
    render({ stagger: true });
  }

  prevButton.addEventListener('click', () => shift(-1));
  nextButton.addEventListener('click', () => shift(1));
  nowButton.addEventListener('click', () => {
    anchor = today();
    render({ stagger: true });
  });

  Data.subscribe(() => render());

  render();

  return {
    refreshGlass: () => segment.refreshGlass(),
    measure: () => segment.measure(),
    show(nextMode, anchorKey) {
      const target = parseKey(anchorKey);
      anchor = target > today() ? today() : target;
      const index = MODES.indexOf(nextMode);
      if (index >= 0 && index !== segment.index) segment.select(index);
      else render({ stagger: true });
    },
    intro() {
      if (MotionSettings.reduced) return;
      const keys = periodKeys();
      const summary = Calc.summarizeDateKeys(keys);
      expenseOdo.set(summary.expense, { from: 0 });
      budgetMotion.set({ f: 0 });
      renderBudget(keys, summary);
      renderChart(keys, false);
      chart.grow();
      renderPace(keys, true);
      renderDonut(summary, true);
      renderTrend(true);
    },
    resize: () => pace.resize(),
  };
}
