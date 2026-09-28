import { Calc } from '../../core/calculations.js';
import { Data } from '../../core/data-model.js';

function initOverview() {
  if (!document.getElementById('overview-month-label')) return;

  const dateInput = document.getElementById('daily-date');

  function getAnchorDateKey() {
    return (dateInput && dateInput.value) || Data.toDateKey(new Date());
  }

  function render() {
    const anchorDateKey = getAnchorDateKey();
    const monthKey = Data.toMonthKey(anchorDateKey);
    const monthSummary = Calc.computeMonthSummary(monthKey);
    const weekSummary = Calc.computeWeekSummary(anchorDateKey);

    renderPeriodLabels(monthKey, weekSummary);
    renderStatGrid('month', monthSummary);
    renderStatGrid('week', weekSummary);
    renderBudgetSummaryLine(monthSummary);
    renderNecessityLine(monthSummary);
    renderCategoryRanking(monthSummary);
  }

  function renderPeriodLabels(monthKey, weekSummary) {
    const monthLabelEl = document.getElementById('overview-month-label');
    const weekLabelEl = document.getElementById('overview-week-label');
    const [y, m] = monthKey.split('-');
    monthLabelEl.textContent = `${y} 年 ${parseInt(m, 10)} 月整月`;
    weekLabelEl.textContent = `${formatShortDate(weekSummary.weekStart)} 〜 ${formatShortDate(weekSummary.weekEnd)}（週一至週日）`;
  }

  function renderStatGrid(prefix, summary) {
    setStat(`overview-${prefix}-income`, summary.income, 'income');
    setStat(`overview-${prefix}-expense`, summary.expense, 'expense');
    setStat(`overview-${prefix}-net`, summary.net, summary.status);
  }

  function setStat(elId, amount, statusOrType) {
    const el = document.getElementById(elId);
    if (!el) return;
    const sign = amount > 0 && statusOrType !== 'expense' ? '+' : '';
    el.textContent = `${sign}${formatAmount(amount)}`;

    el.classList.remove('text-positive', 'text-warning', 'text-danger');
    if (statusOrType === 'positive') el.classList.add('text-positive');
    else if (statusOrType === 'warning') el.classList.add('text-warning');
    else if (statusOrType === 'danger') el.classList.add('text-danger');
  }

  function renderBudgetSummaryLine(monthSummary) {
    const el = document.getElementById('overview-budget-summary');
    if (!el) return;

    if (monthSummary.overBudgetCount === 0 && monthSummary.watchBudgetCount === 0) {
      el.textContent = '目前所有分類都在預算內，狀態良好';
      el.className = 'budget-summary-line text-positive';
    } else {
      const parts = [];
      if (monthSummary.overBudgetCount > 0) parts.push(`${monthSummary.overBudgetCount} 個分類已超支`);
      if (monthSummary.watchBudgetCount > 0) parts.push(`${monthSummary.watchBudgetCount} 個分類接近上限`);
      el.textContent = parts.join('，');
      el.className = 'budget-summary-line ' + (monthSummary.overBudgetCount > 0 ? 'text-danger' : 'text-warning');
    }
  }

  function renderNecessityLine(monthSummary) {
    const el = document.getElementById('overview-necessity-line');
    if (!el) return;

    const { want, need, wantRatio } = monthSummary.necessityBreakdown;
    if (wantRatio === null) {
      el.style.display = 'none';
      return;
    }

    el.style.display = 'block';
    el.textContent = `已標記的支出中，非必要（想要）佔 ${wantRatio}%（想要 ${formatAmount(want)}／需要 ${formatAmount(need)}）`;
    el.className = 'overview-period-label';
  }

  function renderCategoryRanking(monthSummary) {
    const el = document.getElementById('overview-category-list');
    if (!el) return;

    const ranked = Calc.getSortedCategoryBreakdown(monthSummary.expenseByCategory).slice(0, 5);
    if (ranked.length === 0) {
      el.innerHTML = '<div class="entry-row__note">本月還沒有支出記錄</div>';
      return;
    }

    const maxAmount = ranked[0].amount || 1;

    el.innerHTML = ranked.map((item) => {
      const widthPercent = Math.max(4, Math.round((item.amount / maxAmount) * 100));
      return `
      <div class="category-rank-row">
        <span class="category-rank-row__name">${escapeHtml(item.category)}</span>
        <span class="category-rank-row__bar-track">
          <span class="category-rank-row__bar-fill" style="width: ${widthPercent}%;"></span>
        </span>
        <span class="category-rank-row__amount">${formatAmount(item.amount)}</span>
      </div>
    `;
    }).join('');
  }

  function formatAmount(amount) {
    return Number(amount || 0).toLocaleString('zh-Hant-TW');
  }

  function formatShortDate(dateKey) {
    const [, m, d] = dateKey.split('-');
    return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  render();
  Data.subscribe(render);
  if (dateInput) dateInput.addEventListener('change', render);
}

export function boot() {
  if (!Data || !Calc) {
    console.error('Life Ledger：收支總覽需要的模組沒載入成功（data-model.js 或 calculations.js）。'
      + '請確認 js 資料夾內檔案齊全。');
    return;
  }
  try {
    initOverview();
  } catch (err) {
    console.error('Life Ledger：收支總覽初始化失敗', err);
  }
}
