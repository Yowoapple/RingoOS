import { Storage } from '../../core/storage/storage.js';
import { Calc } from '../../core/calculations.js';
import { Data } from '../../core/data-model.js';
import { Messages } from '../reminder/messages.js';
import { Persona } from '../reminder/persona.js';

const COLLAPSED_KEY = 'yoworingo.bubble-collapsed';
const SEVERITY = { danger: 3, warning: 2, positive: 1, empty: 0 };

function isCollapsed() {
  try {
    return Storage.get(COLLAPSED_KEY, null) === 'true';
  } catch (err) {
    return false;
  }
}

function setCollapsed(collapsed) {
  try {
    Storage.set(COLLAPSED_KEY, collapsed ? 'true' : 'false');
  } catch (err) {}
}

function initCharacterBubble() {
  if (!Data || !Calc || !Messages) return;

  const widget = document.getElementById('character-widget');
  const bubble = document.getElementById('character-bubble');
  const collapseBtn = document.getElementById('character-bubble-collapse');
  const peekBtn = document.getElementById('character-bubble-peek');
  const tagEl = document.getElementById('character-bubble-tag');
  const textEl = document.getElementById('character-bubble-text');
  const tabBtns = document.querySelectorAll('[data-bubble-period]');
  if (!widget || !bubble || !collapseBtn || !peekBtn) return;

  let currentPeriod = null;

  function computeMessages() {
    const dateInput = document.getElementById('daily-date');
    const anchorDateKey = (dateInput && dateInput.value) || Data.toDateKey(new Date());
    const monthKey = Data.toMonthKey(anchorDateKey);
    const personaType = (Persona && Persona.isEnabled()) ? Persona.getType() : 'neutral';

    const monthSummary = Calc.computeMonthSummary(monthKey);
    const weekSummary = Calc.computeWeekSummary(anchorDateKey);

    const monthExtras = {
      projection: Calc.getMidMonthProjection(monthKey),
      comparison: Calc.getMonthComparison(monthKey),
      streakCount: Calc.getConsecutiveGoodMonths(monthKey),
      personaType,
    };
    monthExtras.categoryDriver = Calc.getCategoryDriver(
      monthSummary.expenseByCategory,
      monthExtras.comparison.hasPrevious ? monthExtras.comparison.previousByCategory : null
    );

    const weekExtras = {
      comparison: Calc.getWeekComparison(anchorDateKey),
      streakCount: Calc.getConsecutiveGoodWeeks(anchorDateKey),
      personaType,
    };
    weekExtras.categoryDriver = Calc.getCategoryDriver(
      weekSummary.expenseByCategory,
      weekExtras.comparison.hasPrevious ? weekExtras.comparison.previousByCategory : null
    );

    return {
      month: Messages.getMonthMessage(monthSummary, monthExtras),
      week: Messages.getWeekMessage(weekSummary, weekExtras),
    };
  }

  function pickDefaultPeriod(messages) {
    const monthSeverity = SEVERITY[messages.month.status] || 0;
    const weekSeverity = SEVERITY[messages.week.status] || 0;
    return weekSeverity >= monthSeverity ? 'week' : 'month';
  }

  const STATUS_LABEL = {
    empty: '尚無記錄', positive: '狀態穩定', warning: '稍微留意', danger: '需要注意',
  };

  function render() {
    const messages = computeMessages();
    const period = currentPeriod || pickDefaultPeriod(messages);
    const msg = messages[period];

    tabBtns.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.bubblePeriod === period));

    bubble.classList.remove(
      'character-bubble--empty', 'character-bubble--positive',
      'character-bubble--warning', 'character-bubble--danger'
    );
    bubble.classList.add(`character-bubble--${msg.status}`);

    tagEl.textContent = STATUS_LABEL[msg.status];
    textEl.textContent = msg.text;
  }

  function renderAndReposition() {
    render();
    reposition();
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentPeriod = btn.dataset.bubblePeriod;
      renderAndReposition();
    });
  });

  function applyCollapsedState(collapsed) {
    bubble.classList.toggle('is-collapsed', collapsed);
    peekBtn.hidden = !collapsed;
  }

  collapseBtn.addEventListener('click', () => {
    applyCollapsedState(true);
    setCollapsed(true);
  });

  peekBtn.addEventListener('click', () => {
    applyCollapsedState(false);
    setCollapsed(false);
    reposition();
  });

  function reposition() {
    if (widget.hidden) {
      bubble.style.display = 'none';
      peekBtn.style.display = 'none';
      return;
    }
    bubble.style.display = '';
    peekBtn.style.display = '';

    const left = parseFloat(widget.style.left) || 0;
    const top = parseFloat(widget.style.top) || 0;
    const widgetWidth = widget.offsetWidth || 170;

    const bubbleLeft = left + widgetWidth * 0.55;
    const bubbleBottom = top + 14;
    const bubbleTop = bubbleBottom - bubble.offsetHeight - 16;

    bubble.style.left = `${bubbleLeft}px`;
    bubble.style.top = `${Math.max(0, bubbleTop)}px`;

    peekBtn.style.left = `${left + widgetWidth - 14}px`;
    peekBtn.style.top = `${top - 14}px`;
  }

  window.addEventListener('yoworingo:character-moved', reposition);
  window.addEventListener('yoworingo:character-toggle', reposition);
  window.addEventListener('resize', reposition);

  applyCollapsedState(isCollapsed());
  renderAndReposition();

  Data.subscribe(renderAndReposition);
  const dateInput = document.getElementById('daily-date');
  if (dateInput) {
    dateInput.addEventListener('change', () => {
      currentPeriod = null;
      renderAndReposition();
    });
  }
  window.addEventListener('yoworingo:persona-change', renderAndReposition);
}

export function boot() {
  try {
    initCharacterBubble();
  } catch (err) {
    console.error('Life Ledger：角色對話氣泡初始化失敗（不影響其他功能）', err);
  }
}
