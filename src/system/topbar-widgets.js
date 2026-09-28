import { Storage } from '../core/storage/storage.js';
import { Calc } from '../core/calculations.js';
import { Character } from '../apps/character/character.js';
import { Data } from '../core/data-model.js';
import { Dock } from './dock.js';
import { Radio } from '../apps/radio/radio.js';
import { Weather } from '../apps/weather/weather.js';

const STORAGE_KEY = 'yoworingo.topbar-widgets';
const KEYS = ['clock', 'weather', 'music', 'calendarBell', 'budgetDot', 'savingsRing', 'quickAdd', 'moodAvatar'];
const DEFAULTS = {
  clock: true,
  weather: true,
  music: true,
  calendarBell: false,
  budgetDot: true,
  savingsRing: false,
  quickAdd: true,
  moodAvatar: false,
};

function loadPrefs() {
  try {
    const raw = Storage.get(STORAGE_KEY, null);
    const stored = raw ? JSON.parse(raw) : {};
    return { ...DEFAULTS, ...stored };
  } catch (err) {
    return { ...DEFAULTS };
  }
}

let prefs = { ...DEFAULTS };

function hydrate() {
  prefs = loadPrefs();
}

function isEnabled(key) {
  return !!prefs[key];
}

function setEnabled(key, enabled) {
  prefs[key] = !!enabled;
  try { Storage.set(STORAGE_KEY, JSON.stringify(prefs)); } catch (err) {}
  window.dispatchEvent(new CustomEvent('yoworingo:topbar-widgets-change'));
}

export const TopbarWidgets = { KEYS, hydrate, isEnabled, setEnabled };

function bringToFront(windowEl) {
  const allWindows = document.querySelectorAll('.window');
  let maxZ = 10;
  allWindows.forEach((w) => {
    const z = parseInt(w.style.zIndex || '10', 10);
    if (z > maxZ) maxZ = z;
  });
  windowEl.style.zIndex = String(maxZ + 1);
}

function openAppWindow(windowId) {
  const el = document.querySelector(`.window[data-window-id="${windowId}"]`);
  if (!el) return;
  if (Dock && Dock.isDocked(windowId)) {
    Dock.restoreWindow(windowId);
  } else if (el.style.display === 'none') {
    el.style.display = '';
    bringToFront(el);
  } else {
    bringToFront(el);
  }
}

function initTopbarWidgets() {

  const els = {
    quickAddBtn: document.getElementById('topbar-quick-add-btn'),
    quickAddPopover: document.getElementById('topbar-quick-add-popover'),
    budgetDot: document.getElementById('topbar-budget-dot'),
    savingsRing: document.getElementById('topbar-savings-ring'),
    savingsRingFg: document.getElementById('topbar-savings-ring-fg'),
    moodAvatar: document.getElementById('topbar-mood-avatar'),
    moodAvatarImg: document.getElementById('topbar-mood-avatar-img'),
    divider1: document.getElementById('topbar-divider-1'),
    calendarBell: document.getElementById('topbar-calendar-bell'),
    calendarBadge: document.getElementById('topbar-calendar-badge'),
    music: document.getElementById('topbar-music'),
    musicLabel: document.getElementById('topbar-music-label'),
    weather: document.getElementById('topbar-weather'),
    weatherIcon: document.getElementById('topbar-weather-icon'),
    weatherTemp: document.getElementById('topbar-weather-temp'),
    clock: document.getElementById('topbar-clock'),
    divider2: document.getElementById('topbar-divider-2'),
  };
  if (!els.clock) return;

  function renderClock() {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    els.clock.textContent = `${now.getMonth() + 1}月${now.getDate()}日 週${weekdays[now.getDay()]} ${hh}:${mm}`;
    els.clock.hidden = !isEnabled('clock');
  }

  function renderWeather() {
    if (!Weather) { els.weather.hidden = true; return; }
    Weather.getWeather(false).then((data) => {
      if (!data || !data.current) { els.weather.hidden = true; return; }
      els.weatherIcon.src = data.current.iconFile;
      els.weatherIcon.alt = data.current.weatherText;
      els.weatherTemp.textContent = `${Math.round(data.current.temperature)}°`;
      els.weather.hidden = !isEnabled('weather');
      safeRender(renderDividers, '分隔線');
    }).catch(() => { els.weather.hidden = true; safeRender(renderDividers, '分隔線'); });
  }
  if (els.weather) {
    els.weather.addEventListener('click', () => openAppWindow('weather'));
  }

  function renderMusic() {
    if (!Radio) { els.music.hidden = true; return; }
    const state = Radio.getState();
    const shouldShow = isEnabled('music') && state.isPlaying && state.currentStation;
    els.music.hidden = !shouldShow;
    if (shouldShow) els.musicLabel.textContent = state.currentStation.name;
    safeRender(renderDividers, '分隔線');
  }
  if (els.music) {
    els.music.addEventListener('click', () => openAppWindow('radio'));
    if (Radio) Radio.subscribe(() => safeRender(renderMusic, '音樂'));
  }

  function renderCalendarBell() {
    if (!Calc || !Data) { els.calendarBell.hidden = true; return; }
    const summary = Calc.getUpcomingTaskSummary();
    els.calendarBell.hidden = !isEnabled('calendarBell');
    els.calendarBadge.hidden = summary.count === 0;
    els.calendarBadge.textContent = summary.count > 99 ? '99+' : String(summary.count);
  }
  if (els.calendarBell) {
    els.calendarBell.addEventListener('click', () => openAppWindow('calendar'));
  }

  function renderBudgetDot() {
    if (!Calc || !Data) { els.budgetDot.hidden = true; return; }
    const monthKey = Data.toMonthKey(Data.toDateKey(new Date()));
    const breakdown = Calc.getMonthBudgetBreakdown(monthKey);
    const withBudget = breakdown.filter((b) => b.status !== 'no-budget');
    let status = 'no-budget';
    if (withBudget.some((b) => b.status === 'danger')) status = 'danger';
    else if (withBudget.some((b) => b.status === 'warning')) status = 'warning';
    else if (withBudget.length > 0) status = 'safe';

    const dot = els.budgetDot.querySelector('.topbar__dot');
    dot.className = `topbar__dot topbar__dot--${status}`;
    els.budgetDot.hidden = !isEnabled('budgetDot');
  }
  if (els.budgetDot) {
    els.budgetDot.addEventListener('click', () => openAppWindow('overview'));
  }

  const RING_CIRCUMFERENCE = 2 * Math.PI * 12;
  function renderSavingsRing() {
    if (!Data) { els.savingsRing.hidden = true; return; }
    const goals = Data.getState().settings.savingsGoals || [];
    if (goals.length === 0) { els.savingsRing.hidden = true; return; }
    const goal = goals.find((g) => g.deadline) || goals[0];
    const ratio = goal.targetAmount > 0 ? Math.max(0, Math.min(1, goal.currentAmount / goal.targetAmount)) : 0;
    els.savingsRingFg.setAttribute('stroke-dasharray', `${ratio * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`);
    els.savingsRing.hidden = !isEnabled('savingsRing');
    els.savingsRing.title = `${goal.title}：${Math.round(ratio * 100)}%`;
  }
  if (els.savingsRing) {
    els.savingsRing.addEventListener('click', () => {
      openAppWindow('settings');
      const tabBtn = document.querySelector('[data-settings-tab="budget-goals"]');
      if (tabBtn) tabBtn.click();
    });
  }

  function renderMoodAvatar() {
    if (!Character) { els.moodAvatar.hidden = true; return; }
    const info = Character.getCurrentIdleFile();
    els.moodAvatarImg.src = info.file;
    els.moodAvatar.hidden = !isEnabled('moodAvatar');
  }

  let quickAddType = 'expense';

  function populateQuickAddCategories() {
    if (!Data) return;
    const select = document.getElementById('quick-add-category');
    const state = Data.getState();
    const categories = quickAddType === 'income' ? state.settings.incomeCategories : state.settings.expenseCategories;
    select.innerHTML = categories.map((c) => `<option value="${c}">${c}</option>`).join('');
  }

  function setQuickAddType(type) {
    quickAddType = type;
    document.getElementById('quick-add-type-expense').classList.toggle('is-active', type === 'expense');
    document.getElementById('quick-add-type-income').classList.toggle('is-active', type === 'income');
    populateQuickAddCategories();
  }

  function renderQuickAdd() {
    els.quickAddBtn.hidden = !isEnabled('quickAdd');
  }

  if (els.quickAddBtn) {
    document.getElementById('quick-add-type-expense').addEventListener('click', () => setQuickAddType('expense'));
    document.getElementById('quick-add-type-income').addEventListener('click', () => setQuickAddType('income'));

    els.quickAddBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const willShow = els.quickAddPopover.hidden;
      els.quickAddPopover.hidden = !willShow;
      if (willShow) {
        setQuickAddType('expense');
        document.getElementById('quick-add-amount').focus();
      }
    });

    document.addEventListener('click', (event) => {
      if (els.quickAddPopover.hidden) return;
      if (event.target.closest('.topbar__quick-add')) return;
      els.quickAddPopover.hidden = true;
    });

    document.getElementById('quick-add-submit').addEventListener('click', () => {
      if (!Data) return;
      const amountInput = document.getElementById('quick-add-amount');
      const amount = Number(amountInput.value);
      const category = document.getElementById('quick-add-category').value;
      if (!amount || amount <= 0 || !category) return;

      const dateKey = Data.toDateKey(new Date());
      if (quickAddType === 'income') {
        Data.addIncomeEntry(dateKey, { amount, category });
      } else {
        Data.addExpenseEntry(dateKey, { amount, category });
      }
      amountInput.value = '';
      els.quickAddPopover.hidden = true;
    });
  }

  function renderDividers() {
    const actionsVisible = !els.quickAddBtn.hidden || !els.budgetDot.hidden || !els.savingsRing.hidden || !els.moodAvatar.hidden;
    const statusVisible = !els.calendarBell.hidden || !els.music.hidden || !els.weather.hidden || !els.clock.hidden;
    if (els.divider1) els.divider1.hidden = !(actionsVisible && statusVisible);
    if (els.divider2) els.divider2.hidden = !statusVisible;
  }

  function safeRender(fn, label) {
    try {
      fn();
    } catch (err) {
      console.error(`Life Ledger：頂部選單列「${label}」渲染失敗（不影響其他小工具）`, err);
    }
  }

  function renderAll() {
    safeRender(renderClock, '時間');
    safeRender(renderWeather, '天氣');
    safeRender(renderMusic, '音樂');
    safeRender(renderCalendarBell, '日程提醒');
    safeRender(renderBudgetDot, '預算燈號');
    safeRender(renderSavingsRing, '儲蓄目標');
    safeRender(renderMoodAvatar, '心情頭像');
    safeRender(renderQuickAdd, '快速記一筆');
    safeRender(renderDividers, '分隔線');
  }

  renderAll();
  window.setInterval(renderClock, 30 * 1000);
  if (Weather) {
    window.setInterval(renderWeather, Weather.REFRESH_INTERVAL_MS || 30 * 60 * 1000);
  }
  if (Data) Data.subscribe(() => { renderCalendarBell(); renderBudgetDot(); renderSavingsRing(); renderMoodAvatar(); renderDividers(); });
  window.addEventListener('yoworingo:topbar-widgets-change', renderAll);
}

export function boot() {
  try {
    initTopbarWidgets();
  } catch (err) {
    console.error('Life Ledger：頂部選單列小工具初始化失敗（不影響其他功能）', err);
  }
}
