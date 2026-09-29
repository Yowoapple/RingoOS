import '@fontsource-variable/geist-mono';
import { createMotion, Animator } from '../../../src/motion/animator.js';
import { MotionSettings } from '../../../src/motion/presets.js';
import { APPS, renderIcon } from './icons.js';
import { applyLens } from './lens.js';
import { createSegmented } from './segmented.js';
import { createOdometer, formatAmount } from './odometer.js';
import { createBarChart } from './chart.js';
import { createNotices } from './notices.js';
import { createCapsule } from './capsule.js';
import { flip, enter, pressable } from './motion-kit.js';
import { startPerfMeter } from './perf.js';

MotionSettings.usePreset('hyperos');

const STATE_KEY = 'yoworingo.design-lab';
const BUDGET = 24000;
const INCOME = 42000;
const CATEGORIES = {
  expense: ['餐飲', '交通', '居住', '娛樂', '醫療', '教育', '其他'],
  income: ['薪資', '獎金', '投資', '其他收入'],
};
const WEEK_LABELS = ['三', '四', '五', '六', '日', '一', '二'];
const WEEK_VALUES = [520, 890, 1240, 2310, 760, 640, 385];
const TODAY_INDEX = 6;

const root = document.documentElement;
const $ = (id) => document.getElementById(id);

const state = {
  style: 'a',
  accent: 'ultramarine',
  theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  wall: 'aurora',
  lab: 'open',
};

try {
  Object.assign(state, JSON.parse(window.localStorage.getItem(STATE_KEY) || '{}'));
} catch (err) {}
if (state.wall === 'photo') state.wall = 'aurora';

const ledger = {
  expense: 18420,
  rows: [
    { time: '12:40', category: '餐飲', note: '午餐便當', amount: 120, type: 'expense' },
    { time: '08:12', category: '餐飲', note: '早餐，豆漿蛋餅', amount: 65, type: 'expense' },
    { time: '07:58', category: '交通', note: '捷運儲值', amount: 200, type: 'expense' },
  ],
  rank: [
    { category: '餐飲', amount: 7860 },
    { category: '居住', amount: 6000 },
    { category: '交通', amount: 1920 },
  ],
};

function save() {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify({ ...state, wall: state.wall === 'photo' ? 'aurora' : state.wall }));
  } catch (err) {}
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function renderClock() {
  const now = new Date();
  const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  $('menubar-clock').textContent = `${now.getMonth() + 1}/${now.getDate()} 週${week}  ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];
  $('entry-date').textContent = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${day}`;
}

function buildChips(container, list) {
  container.textContent = '';
  list.forEach((name, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.setAttribute('role', 'radio');
    chip.setAttribute('aria-checked', String(i === 0));
    chip.textContent = name;
    container.appendChild(chip);
  });
}

function wireChips(container, onPick) {
  container.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    container.querySelectorAll('.chip').forEach((other) => other.setAttribute('aria-checked', String(other === chip)));
    if (onPick) onPick(chip.textContent);
  });
}

function pickedChip(container) {
  const chip = container.querySelector('.chip[aria-checked="true"]');
  return chip ? chip.textContent : '';
}

function rowElement(row) {
  const el = document.createElement('div');
  el.className = `row row--${row.type}`;
  const sign = row.type === 'income' ? '+' : '−';
  el.innerHTML = '<span class="row__time mono"></span><span class="row__main"><span class="row__cat"></span><span class="row__note"></span></span><span class="row__amt mono"></span>';
  el.querySelector('.row__time').textContent = row.time;
  el.querySelector('.row__cat').textContent = row.category;
  el.querySelector('.row__note').textContent = row.note || '沒有備註';
  el.querySelector('.row__amt').textContent = `${sign}${formatAmount(row.amount)}`;
  return el;
}

function todayTotal() {
  return ledger.rows.reduce((sum, row) => sum + (row.type === 'expense' ? -row.amount : row.amount), 0);
}

function renderTotal() {
  const total = todayTotal();
  $('entry-total').textContent = `${total < 0 ? '−' : '+'}NT$ ${formatAmount(total)}`;
}

function renderRank() {
  const rank = $('ov-rank');
  rank.textContent = '';
  const max = Math.max(...ledger.rank.map((entry) => entry.amount));
  ledger.rank.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'rank__row';
    row.innerHTML = '<span></span><span class="rank__track"><span class="rank__fill"></span></span><span class="mono"></span>';
    row.children[0].textContent = entry.category;
    row.querySelector('.rank__fill').style.transform = `scaleX(${entry.amount / max})`;
    row.children[2].textContent = formatAmount(entry.amount);
    rank.appendChild(row);
  });
}

const notices = createNotices($('notices'), renderIcon);
const expenseOdo = createOdometer($('ov-expense'), { value: ledger.expense });
const chart = createBarChart($('ov-chart'), $('ov-chart-labels'), {
  values: WEEK_VALUES,
  labels: WEEK_LABELS,
  todayIndex: TODAY_INDEX,
  format: (value) => formatAmount(value),
});

const budgetMotion = createMotion({ f: ledger.expense / BUDGET }, { response: 0.6, damping: 0.8, restDelta: 0.0005 });
budgetMotion.onUpdate(({ f }) => {
  const fill = $('ov-budget-fill');
  fill.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`;
  fill.classList.toggle('is-warn', f >= 0.8);
});

function renderOverview({ animate = true } = {}) {
  const ratio = ledger.expense / BUDGET;
  $('ov-budget-pct').textContent = `${Math.round(ratio * 100)}%`;
  const net = INCOME - ledger.expense;
  $('ov-net').textContent = `${net >= 0 ? '+' : '−'}${formatAmount(net)}`;
  if (animate) budgetMotion.to({ f: ratio }, MotionSettings.spring('snap'));
  else budgetMotion.set({ f: ratio });
}

const entrySeg = createSegmented($('entry-seg'), {
  onChange(index) {
    buildChips(document.querySelector('[data-chips="entry"]'), index === 0 ? CATEGORIES.expense : CATEGORIES.income);
  },
  onLayout(lens) {
    applyLens(lens, state.style === 'a');
  },
});

buildChips(document.querySelector('[data-chips="entry"]'), CATEGORIES.expense);
wireChips(document.querySelector('[data-chips="entry"]'));
wireChips(document.querySelector('[data-chips="capsule"]'));

function addEntry({ type, amount, category, note }) {
  const now = new Date();
  const row = { time: `${pad(now.getHours())}:${pad(now.getMinutes())}`, category, note, amount, type };
  const container = $('entry-rows');
  const existing = Array.from(container.children);
  const el = rowElement(row);
  flip(existing, () => container.prepend(el));
  enter(el, -14);
  ledger.rows.unshift(row);
  renderTotal();
  if (type === 'expense') {
    ledger.expense += amount;
    expenseOdo.set(ledger.expense);
    chart.add(TODAY_INDEX, amount);
    renderOverview();
  }
  notices.push({
    app: type === 'expense' ? 'daily-entry' : 'overview',
    title: `已記下 NT$ ${formatAmount(amount)}`,
    body: `${category}${note ? `，${note}` : ''}`,
  });
  if (type === 'expense' && ledger.expense / BUDGET >= 0.8) {
    window.setTimeout(() => notices.push({ app: 'overview', title: '預算快用完了', body: `本月已用 ${Math.round((ledger.expense / BUDGET) * 100)}%，還剩 NT$ ${formatAmount(BUDGET - ledger.expense)}` }), 600);
  }
}

function readAmount(input) {
  const value = Number(String(input.value).replace(/[^\d]/g, ''));
  return Number.isFinite(value) ? value : 0;
}

function shake(element) {
  const motion = createMotion({ x: 0 }, { response: 0.3, damping: 0.3, restDelta: 0.05 });
  motion.onUpdate(({ x }) => {
    element.style.transform = Math.abs(x) < 0.05 ? '' : `translate3d(${x}px, 0, 0)`;
  });
  if (!MotionSettings.reduced) motion.to({ x: 0 }, { velocity: { x: 600 } });
  element.focus();
}

$('entry-add').addEventListener('click', () => {
  const input = $('entry-amount');
  const amount = readAmount(input);
  if (amount <= 0) {
    shake(input.closest('.amount'));
    return;
  }
  addEntry({
    type: entrySeg.index === 0 ? 'expense' : 'income',
    amount,
    category: pickedChip(document.querySelector('[data-chips="entry"]')),
    note: $('entry-note').value.trim(),
  });
  input.value = '';
  $('entry-note').value = '';
});

const capsule = createCapsule({
  root: $('capsule'),
  pill: $('capsule-pill'),
  panel: $('capsule-panel'),
  onOpen() {
    window.setTimeout(() => $('capsule-amount').focus(), 120);
  },
});

$('capsule-cancel').addEventListener('click', () => capsule.set(false));
$('capsule-panel').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('capsule-amount');
  const amount = readAmount(input);
  if (amount <= 0) {
    shake(input.closest('.capsule__amount'));
    return;
  }
  addEntry({ type: 'expense', amount, category: pickedChip(document.querySelector('[data-chips="capsule"]')), note: '' });
  input.value = '';
  capsule.set(false);
});

const windows = Array.from(document.querySelectorAll('.win'));
const windowMotions = new Map(windows.map((win) => {
  const motion = createMotion({ s: 1, o: 1, y: 0 }, { response: 0.5, damping: 0.8, restDelta: { s: 0.0005, o: 0.001, y: 0.05 } });
  motion.onUpdate(({ s, o, y }) => {
    const idle = Math.abs(s - 1) < 0.0005 && Math.abs(y) < 0.05;
    win.style.transform = idle ? '' : `translate3d(0, ${y}px, 0) scale(${s})`;
    win.style.opacity = o >= 0.999 ? '' : String(Math.max(0, o));
  });
  return [win, motion];
}));

const dockItems = new Map();

function focusWindow(win) {
  windows.forEach((other) => other.classList.toggle('is-focused', other === win));
  $('menubar-app').textContent = win.querySelector('.win__title').textContent;
  dockItems.forEach((item, id) => item.el.classList.toggle('is-focused', id === win.dataset.app));
  const motion = windowMotions.get(win);
  if (!MotionSettings.reduced) {
    motion.set({ s: 0.992 });
    motion.to({ s: 1 }, MotionSettings.spring('focus'));
  }
}

windows.forEach((win) => win.addEventListener('pointerdown', () => {
  if (!win.classList.contains('is-focused')) focusWindow(win);
}));

function buildDock() {
  const dock = $('dock');
  const label = $('dock-label');
  APPS.forEach((app) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'dock__item';
    el.setAttribute('aria-label', app.title);
    el.innerHTML = `${renderIcon(app.id)}<span class="dock__dot"></span>`;
    dock.appendChild(el);
    const motion = createMotion({ y: 0, s: 1 }, { response: 0.3, damping: 0.75, restDelta: { y: 0.05, s: 0.0005 } });
    motion.onUpdate(({ y, s }) => {
      el.style.transform = Math.abs(y) < 0.05 && Math.abs(s - 1) < 0.0005 ? '' : `translate3d(0, ${y}px, 0) scale(${s})`;
    });
    const win = windows.find((w) => w.dataset.app === app.id);
    if (win) el.classList.add('is-running');
    el.addEventListener('pointerenter', () => {
      if (!MotionSettings.reduced) motion.to({ y: -7, s: 1.08 }, MotionSettings.spring('dock'));
      label.textContent = app.title;
      label.style.transform = `translate(calc(${el.offsetLeft + el.offsetWidth / 2}px - 50%), 0)`;
      label.classList.add('is-visible');
    });
    el.addEventListener('pointerleave', () => {
      motion.to({ y: 0, s: 1 }, MotionSettings.spring('dock'));
      label.classList.remove('is-visible');
    });
    el.addEventListener('pointerdown', () => motion.to({ s: 0.9 }, { response: 0.16, damping: 1 }));
    el.addEventListener('pointerup', () => motion.to({ s: 1.08 }, MotionSettings.spring('dock')));
    el.addEventListener('click', () => {
      if (!MotionSettings.reduced) motion.to({ y: 0 }, { response: 0.42, damping: 0.35, velocity: { y: -420 } });
      if (win) focusWindow(win);
      else notices.push({ app: app.id, title: app.title, body: '這個實驗頁只放了記帳與總覽兩個視窗，圖示是新設計的草稿。' });
    });
    dockItems.set(app.id, { el, motion });
  });
  dockItems.get('daily-entry').el.classList.add('is-focused');
}

function renderRows() {
  const container = $('entry-rows');
  container.textContent = '';
  ledger.rows.forEach((row) => container.appendChild(rowElement(row)));
  renderTotal();
}

function applyState() {
  root.dataset.style = state.style;
  root.dataset.accent = state.accent;
  root.dataset.theme = state.theme;
  root.dataset.wall = state.wall;
  root.dataset.lab = state.lab;
  document.querySelectorAll('[data-set]').forEach((button) => {
    button.setAttribute('aria-pressed', String(state[button.dataset.set] === button.dataset.value));
  });
  $('lab-toggle').textContent = state.lab === 'open' ? '收起' : '展開';
  $('lab-toggle').setAttribute('aria-expanded', String(state.lab === 'open'));
  applyLens(entrySeg.lens, state.style === 'a');
  capsule.relayout();
  entrySeg.measure();
}

document.querySelectorAll('[data-set]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.value === 'photo') {
      $('lab-photo-input').click();
      return;
    }
    state[button.dataset.set] = button.dataset.value;
    applyState();
    save();
  });
});

$('lab-photo-input').addEventListener('change', (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  root.style.setProperty('--wall-photo', `url("${URL.createObjectURL(file)}")`);
  state.wall = 'photo';
  applyState();
});

$('lab-toggle').addEventListener('click', () => {
  state.lab = state.lab === 'open' ? 'closed' : 'open';
  applyState();
  save();
});

function intro() {
  windows.forEach((win, i) => {
    const motion = windowMotions.get(win);
    if (MotionSettings.reduced) {
      motion.set({ o: 0 });
      motion.to({ o: 1 }, MotionSettings.spring('open'));
      return;
    }
    motion.set({ s: 0.94, o: 0, y: 18 });
    window.setTimeout(() => motion.to({ s: 1, o: 1, y: 0 }, MotionSettings.spring('open')), 80 + i * 90);
  });
  expenseOdo.set(ledger.expense, { from: 0 });
  budgetMotion.set({ f: 0 });
  window.setTimeout(() => renderOverview(), 250);
  window.setTimeout(() => chart.grow(), 200);
  window.setTimeout(() => notices.push({ app: 'calendar', title: '10:00 牙醫回診', body: '還有 30 分鐘，記得帶健保卡', meta: '日曆' }), 1100);
  window.setTimeout(() => notices.push({ app: 'weather', title: '午後有雷陣雨', body: '14 點後降雨機率 70%，出門帶傘', meta: '天氣' }), 1900);
}

$('lab-replay').addEventListener('click', intro);
$('lab-notify').addEventListener('click', () => notices.push({ app: 'life-reminder', title: '這禮拜花得比上週少', body: '少了 NT$ 1,240，餐飲省最多，繼續保持' }));

document.querySelectorAll('[data-press]').forEach(pressable);

buildDock();
renderRows();
renderRank();
renderOverview({ animate: false });
renderClock();
window.setInterval(renderClock, 15000);
applyState();
startPerfMeter($('lab-perf'));
intro();

console.info('%cRingoOS%c design lab', 'font-weight:700;font-size:14px', 'color:#8b8f9a');
if (new URLSearchParams(window.location.search).has('debug')) {
  window.__ringoLab = { Animator, entrySeg };
}
