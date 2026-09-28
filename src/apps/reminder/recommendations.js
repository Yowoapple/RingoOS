import { Calc } from '../../core/calculations.js';
import { Data } from '../../core/data-model.js';
import { Messages } from './messages.js';
import { Persona } from './persona.js';

const STATUS_LABEL = {
  empty: '尚無記錄',
  positive: '狀態穩定',
  warning: '稍微留意',
  danger: '需要注意',
};

function initRecommendations() {
  const monthCard = document.getElementById('month-recommend-card');
  if (!monthCard) return;

  const dateInput = document.getElementById('daily-date');

  function getAnchorDateKey() {
    return (dateInput && dateInput.value) || Data.toDateKey(new Date());
  }

  function getPersonaType() {
    if (!Persona || !Persona.isEnabled()) return 'neutral';
    return Persona.getType();
  }

  function getMostRelevantGoalFragment() {
    const goals = Data.getState().settings.savingsGoals;
    if (!goals || goals.length === 0) return null;

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

    const projection = Calc.getGoalProjection(best);
    return Messages.buildGoalFragment(projection, best.title);
  }

  function render() {
    const anchorDateKey = getAnchorDateKey();
    const monthKey = Data.toMonthKey(anchorDateKey);
    const monthSummary = Calc.computeMonthSummary(monthKey);
    const weekSummary = Calc.computeWeekSummary(anchorDateKey);
    const projection = Calc.getMidMonthProjection(monthKey);
    const personaType = getPersonaType();

    const monthExtras = {
      projection,
      comparison: Calc.getMonthComparison(monthKey),
      streakCount: Calc.getConsecutiveGoodMonths(monthKey),
      personaType,
    };
    monthExtras.categoryDriver = Calc.getCategoryDriver(
      monthSummary.expenseByCategory,
      monthExtras.comparison.hasPrevious ? monthExtras.comparison.previousByCategory : null
    );
    monthExtras.goalFragment = getMostRelevantGoalFragment();

    const weekExtras = {
      comparison: Calc.getWeekComparison(anchorDateKey),
      streakCount: Calc.getConsecutiveGoodWeeks(anchorDateKey),
      personaType,
    };
    weekExtras.categoryDriver = Calc.getCategoryDriver(
      weekSummary.expenseByCategory,
      weekExtras.comparison.hasPrevious ? weekExtras.comparison.previousByCategory : null
    );

    const monthMsg = Messages.getMonthMessage(monthSummary, monthExtras);
    const weekMsg = Messages.getWeekMessage(weekSummary, weekExtras);

    applyCard('month', monthMsg);
    applyCard('week', weekMsg);
  }

  function applyCard(prefix, msg) {
    const card = document.getElementById(`${prefix}-recommend-card`);
    const tag = document.getElementById(`${prefix}-recommend-tag`);
    const text = document.getElementById(`${prefix}-recommend-text`);

    card.classList.remove(
      'recommend-card--empty',
      'recommend-card--positive',
      'recommend-card--warning',
      'recommend-card--danger'
    );
    card.classList.add(`recommend-card--${msg.status}`);

    tag.textContent = STATUS_LABEL[msg.status];
    text.textContent = msg.text;
  }

  render();
  Data.subscribe(render);
  if (dateInput) dateInput.addEventListener('change', render);
  window.addEventListener('yoworingo:persona-change', render);
}

export function boot() {
  if (!Data || !Calc || !Messages) {
    console.error('Life Ledger：生活提醒需要的模組沒載入成功'
      + '（data-model.js / calculations.js / messages.js）。請確認 js 資料夾內檔案齊全。');
    return;
  }
  try {
    initRecommendations();
  } catch (err) {
    console.error('Life Ledger：生活提醒初始化失敗', err);
  }
}
