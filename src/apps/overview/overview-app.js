import { createMotion } from '../../motion/animator.js';
import { MotionSettings } from '../../motion/presets.js';
import { Data } from '../../core/data-model.js';
import { Calc } from '../../core/calculations.js';
import { createSegmented } from '../../ui/segmented.js';
import { createOdometer, formatAmount } from '../../ui/odometer.js';
import { createBarChart } from '../../ui/chart.js';
import { Fx } from '../../ui/fx-tier.js';

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

export function createOverviewApp({ root, periodTag, nowButton, prevButton, nextButton }) {
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
  const rankEl = $('rank');
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

  const rankRows = new Map();

  function rankRow(category) {
    const row = document.createElement('div');
    row.className = 'rank__row';
    row.innerHTML = '<span class="rank__name"></span><span class="rank__track"><span class="rank__fill"></span></span><span class="rank__amt mono"></span>';
    row.querySelector('.rank__name').textContent = category;
    const fill = row.querySelector('.rank__fill');
    const width = createMotion({ f: 0 }, { response: 0.55, damping: 0.72, restDelta: 0.0005 });
    width.onUpdate(({ f }) => {
      fill.style.transform = `scaleX(${Math.max(0, f)})`;
    });
    fill.style.transform = 'scaleX(0)';
    const shift = createMotion({ y: 0, o: 1 }, { response: 0.5, damping: 0.74, restDelta: { y: 0.3, o: 0.003 } });
    shift.onUpdate(({ y, o }) => {
      const t = Math.max(0, Math.min(1, o));
      const settled = Math.abs(y) < 0.3 && t > 0.997;
      row.style.transform = settled ? '' : `translate3d(0, ${y}px, 0) scale(${0.96 + 0.04 * t})`;
      row.style.opacity = t > 0.997 ? '' : String(t);
      row.style.filter = t < 0.97 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 4).toFixed(2)}px)` : '';
    });
    return { row, fill, width, shift, amt: row.querySelector('.rank__amt') };
  }

  function renderRank(summary) {
    const monthKey = Data.toMonthKey(periodKeys()[0]);
    const over = new Set(mode === 'month'
      ? Calc.computeMonthSummary(monthKey).budgetBreakdown.filter((item) => item.status === 'danger').map((item) => item.category)
      : []);
    const ranked = Calc.getSortedCategoryBreakdown(summary.expenseByCategory).filter((item) => item.amount > 0).slice(0, RANK_LIMIT);
    const before = new Map();
    rankRows.forEach((entry, category) => before.set(category, entry.row.getBoundingClientRect().top));
    const keep = new Set(ranked.map((item) => item.category));
    rankRows.forEach((entry, category) => {
      if (keep.has(category)) return;
      entry.width.stop();
      entry.shift.stop();
      entry.row.remove();
      rankRows.delete(category);
    });
    const max = ranked.length ? ranked[0].amount : 1;
    ranked.forEach((item, i) => {
      let entry = rankRows.get(item.category);
      const fresh = !entry;
      if (fresh) {
        entry = rankRow(item.category);
        rankRows.set(item.category, entry);
      }
      rankEl.appendChild(entry.row);
      entry.amt.textContent = formatAmount(item.amount);
      entry.row.classList.toggle('is-over', over.has(item.category));
      const run = () => entry.width.to({ f: item.amount / max }, spring({ response: 0.55, damping: 0.72 }));
      if (fresh && !MotionSettings.reduced) {
        entry.shift.set({ y: 8, o: 0 });
        window.setTimeout(() => {
          entry.shift.to({ y: 0, o: 1 }, { response: 0.42, damping: 0.72 });
          run();
        }, 40 + i * 36);
      } else {
        run();
      }
    });
    rankRows.forEach((entry, category) => {
      if (!before.has(category) || MotionSettings.reduced) return;
      const delta = before.get(category) - entry.row.getBoundingClientRect().top;
      if (Math.abs(delta) < 0.5) return;
      entry.shift.set({ y: entry.shift.get('y') + delta, o: entry.shift.get('o') });
      entry.shift.to({ y: 0, o: 1 }, { response: 0.5, damping: 0.74 });
    });
    rankEmpty.hidden = ranked.length > 0;
    rankEmpty.textContent = mode === 'month' ? '這個月還沒有支出' : '這週還沒有支出';
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
    renderRank(summary);
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
    },
  };
}
