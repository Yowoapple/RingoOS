import '@fontsource-variable/geist-mono';
import { createMotion, Animator } from '../../../src/motion/animator.js';
import { MotionSettings } from '../../../src/motion/presets.js';
import { APPS, renderIcon } from './icons.js';
import { createSegmented } from './segmented.js';
import { createOdometer, formatAmount } from './odometer.js';
import { createBarChart } from './chart.js';
import { createNotices } from './notices.js';
import { createIsland } from './island.js';
import { pressable } from './motion-kit.js';
import { createRowList } from './rows.js';
import { createDialogHost } from './dialog.js';
import { startPerfMeter } from './perf.js';
import { Fx } from './fx-tier.js';
import { createSettings } from './settings.js';
import { createLabDesktop } from './desktop.js';
import { createMenubar } from './menubar.js';
import { baseThickness, sampleGlassThickness, presetAccent, wallpaperAccent } from './wall-tone.js';

function usePreset(name) {
  MotionSettings.usePreset(name);
  if (name !== 'hyperos') return;
  MotionSettings.setSpring('dock', { response: 0.32, damping: 0.66 });
  MotionSettings.setSpring('focus', { response: 0.34, damping: 0.62 });
}

usePreset('hyperos');
Fx.boot();

const STATE_KEY = 'yoworingo.design-lab.v3';
const SOFT = { response: 0.55, damping: 0.62 };
let BUDGET = 24000;
const INCOME = 42000;
const CATEGORIES = {
  expense: ['餐飲', '交通', '居住', '娛樂', '醫療', '教育', '其他'],
  income: ['薪資', '獎金', '投資', '其他收入'],
};
const WEEK_LABELS = ['三', '四', '五', '六', '日', '一', '二'];
const WEEK_VALUES = [520, 890, 1240, 2310, 760, 640, 385];
const TODAY_INDEX = 6;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const FRAMES = {
  'daily-entry': { w: 470, h: 640 },
  overview: { w: 440, h: 640 },
  'life-reminder': { w: 400, h: 520 },
  calendar: { w: 560, h: 600 },
  weather: { w: 500, h: 600 },
  calculator: { w: 340, h: 540 },
  radio: { w: 500, h: 580 },
  settings: { w: 700, h: 560 },
};
const STUB_NOTES = {
  'life-reminder': '週報、月報與推薦卡片',
  calendar: '月曆、代辦與 QR 匯出',
  weather: '氣象署資料與動態天氣背景',
  calculator: '四則運算與鍵盤操作',
  radio: '唱片機與選台清單',
};

const root = document.documentElement;
const $ = (id) => document.getElementById(id);

const state = {
  style: 'a',
  accent: 'auto',
  theme: 'dark',
  wall: 'mono',
  lab: window.innerWidth < 768 ? 'closed' : 'open',
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

function renderDates() {
  const now = new Date();
  const day = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];
  $('entry-date').textContent = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${day}`;
  $('overview-month').textContent = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  $('overview-range').textContent = `${pad(now.getMonth() + 1)}.01 — ${pad(now.getMonth() + 1)}.${pad(last)}`;
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

const chipPops = new WeakMap();

function popChip(chip) {
  if (MotionSettings.reduced) return;
  let motion = chipPops.get(chip);
  if (!motion) {
    motion = createMotion({ s: 1 }, { response: 0.36, damping: 0.4, restDelta: 0.0005 });
    motion.onUpdate(({ s }) => {
      chip.style.transform = Math.abs(s - 1) < 0.0005 ? '' : `scale(${s})`;
    });
    chipPops.set(chip, motion);
  }
  motion.set({ s: 0.9 });
  motion.to({ s: 1 }, { response: 0.36, damping: 0.4, velocity: { s: 2.4 } });
}

function wireChips(container, onPick) {
  container.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    container.querySelectorAll('.chip').forEach((other) => other.setAttribute('aria-checked', String(other === chip)));
    popChip(chip);
    if (onPick) onPick(chip.textContent);
  });
}

function pickedChip(container) {
  const chip = container.querySelector('.chip[aria-checked="true"]');
  return chip ? chip.textContent : '';
}

function rowContent(row) {
  const holder = document.createElement('template');
  holder.innerHTML = '<span class="row__time mono"></span><span class="row__main"><span class="row__cat"></span><span class="row__note"></span></span><span class="row__amt mono"></span>';
  const fragment = holder.content;
  const sign = row.type === 'income' ? '+' : '−';
  fragment.querySelector('.row__time').textContent = row.time;
  fragment.querySelector('.row__cat').textContent = row.category;
  fragment.querySelector('.row__note').textContent = row.note || '沒有備註';
  fragment.querySelector('.row__amt').textContent = `${sign}${formatAmount(row.amount)}`;
  return fragment;
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

function renderRows() {
  rowList.reset(ledger.rows);
  renderTotal();
}

function stubBody(app) {
  const body = document.createElement('div');
  body.className = 'win__body';
  body.innerHTML = '<div class="stub"><div class="stub__icon"></div><p class="stub__title"></p><p class="stub__note"></p><span class="tag">P3b · Next</span></div>';
  body.querySelector('.stub__icon').innerHTML = renderIcon(app.id);
  body.querySelector('.stub__title').textContent = app.title;
  body.querySelector('.stub__note').textContent = `${STUB_NOTES[app.id] || ''}。外框、開關、縮放、吸附已是正式版引擎，內容在下一階段重新設計`;
  return body;
}

function collectContent(app) {
  const source = document.querySelector(`.app-source[data-app-id="${app.id}"]`);
  if (!source) return { titlebar: [], body: [stubBody(app)], bodyClass: 'wm-window__body--stub' };
  const titlebar = source.querySelector(':scope > .app-source__titlebar');
  return {
    titlebar: titlebar ? Array.from(titlebar.children) : [],
    body: Array.from(source.children).filter((node) => node !== titlebar),
    bodyClass: app.id === 'settings' ? 'wm-window__body--settings' : null,
  };
}

renderDates();
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
  if (animate) budgetMotion.to({ f: ratio }, MotionSettings.reduced ? MotionSettings.spring('snap') : SOFT);
  else budgetMotion.set({ f: ratio });
}

const entrySeg = createSegmented($('entry-seg'), {
  onChange(index) {
    buildChips(document.querySelector('[data-chips="entry"]'), index === 0 ? CATEGORIES.expense : CATEGORIES.income);
  },
});

buildChips(document.querySelector('[data-chips="entry"]'), CATEGORIES.expense);
wireChips(document.querySelector('[data-chips="entry"]'));
wireChips(document.querySelector('[data-chips="island"]'));
let stageView = 'rows';
const rowList = createRowList($('entry-rows'), { render: rowContent, onDelete: handleDelete });
const stage = $('entry-stage');
const views = new Map(Array.from(stage.querySelectorAll('.list__view')).map((view) => [view.dataset.view, view]));
const stageHeight = createMotion({ h: 0 }, { response: 0.42, damping: 0.74, restDelta: 0.5 });
stageHeight.onUpdate(({ h }) => {
  stage.style.height = `${Math.max(0, h)}px`;
});
const viewMotions = new Map(Array.from(views.entries()).map(([name, view]) => {
  const motion = createMotion({ e: 1 }, { response: 0.3, damping: 0.8, restDelta: 0.002 });
  motion.onUpdate(({ e }) => {
    const t = Math.max(0, Math.min(1, e));
    view.style.opacity = t > 0.999 ? '' : String(t);
    view.style.transform = t > 0.999 ? '' : `translate3d(0, ${(1 - t) * 8}px, 0)`;
    view.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 4).toFixed(2)}px)` : '';
  });
  return [name, motion];
}));

function showView(name) {
  if (name === stageView || !views.has(name)) return;
  const from = views.get(stageView);
  const to = views.get(name);
  const start = stage.offsetHeight;
  stageView = name;
  document.querySelectorAll('[data-list-view]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.listView === name));
  });
  from.style.position = 'absolute';
  from.style.left = '0';
  from.style.right = '0';
  from.style.top = '0';
  to.hidden = false;
  stage.style.height = '';
  const end = to.offsetHeight;
  stage.style.overflow = 'hidden';
  if (MotionSettings.reduced) {
    from.hidden = true;
    from.style.position = '';
    stage.style.overflow = '';
    viewMotions.get(name).set({ e: 1 });
    return;
  }
  stageHeight.set({ h: start });
  stageHeight.to({ h: end }).then((done) => {
    if (!done) return;
    stage.style.height = '';
    stage.style.overflow = '';
  });
  viewMotions.get(stageView === name ? name : name).set({ e: 0 });
  viewMotions.get(name).to({ e: 1 }, { response: 0.36, damping: 0.78 });
  const leaving = from;
  const leavingName = Array.from(views.entries()).find(([, view]) => view === leaving)[0];
  viewMotions.get(leavingName).to({ e: 0 }, { response: 0.16, damping: 1 }).then(() => {
    if (views.get(stageView) === leaving) return;
    leaving.hidden = true;
    leaving.style.position = '';
    leaving.style.left = '';
    leaving.style.right = '';
    leaving.style.top = '';
    viewMotions.get(leavingName).set({ e: 1 });
  });
}

function applyToLedger(row, direction) {
  renderTotal();
  if (row.type !== 'expense') return;
  ledger.expense += row.amount * direction;
  expenseOdo.set(ledger.expense);
  chart.add(TODAY_INDEX, row.amount * direction);
  renderOverview();
}

function handleDelete(row, index, { silent } = {}) {
  const at = ledger.rows.indexOf(row);
  if (at >= 0) ledger.rows.splice(at, 1);
  applyToLedger(row, -1);
  if (rowList.size === 0) showView('empty');
  if (silent) return;
  island.toast({ text: `已刪除 · ${row.note || row.category}`, action: '復原', onAction: () => restoreRow(row, index) });
}

function restoreRow(row, index) {
  if (stageView !== 'rows') showView('rows');
  const at = Math.min(index, ledger.rows.length);
  ledger.rows.splice(at, 0, row);
  rowList.restore(row, at);
  applyToLedger(row, 1);
}

renderRows();renderRank();
renderOverview({ animate: false });

const LAB_APPS = APPS.map((app) => ({
  id: app.id,
  title: app.title,
  frame: FRAMES[app.id],
  min: { w: 320, h: 320 },
  divider: app.id === 'settings',
  content: collectContent(app),
}));
const TITLES = new Map(APPS.map((app) => [app.id, app.title]));

const desktop = createLabDesktop({
  desk: $('desk'),
  areaEl: $('wm-area'),
  dockEl: $('dock'),
  wallEl: $('wall'),
  apps: LAB_APPS,
  renderIcon,
});
const { wm, store } = desktop;
$('app-sources').remove();

const menubar = createMenubar({
  root: $('menubar'),
  store,
  titles: TITLES,
  onOpen: (id) => wm.open(id),
});

function handleSetting(key, value) {
  if (key === 'motion') {
    usePreset(value === 'ios' ? 'ios' : 'hyperos');
    return;
  }
  if (key === 'reduced') {
    MotionSettings.setReduced(value);
    return;
  }
  if (key === 'budget') {
    BUDGET = value;
    $('ov-budget-legend').textContent = `預算 NT$ ${formatAmount(value)}`;
    renderOverview();
    return;
  }
  if (state[key] === value) return;
  state[key] = value;
  applyState();
  save();
}

const settings = createSettings({
  root: $('settings'),
  state,
  menuHost: $('desk'),
  dock: desktop.dock,
  onChange: handleSetting,
});

store.subscribe(({ type, id }) => {
  if (type !== 'open' && type !== 'restore') return;
  if (id === 'settings') settings.refreshGlass();
  if (id === 'daily-entry') entrySeg.refreshGlass();
});

function syncFxButtons() {
  const names = { full: '完整', lite: '精簡', solid: '實色' };
  document.querySelectorAll('[data-fx-choice]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.fxChoice === Fx.choice));
  });
  $('lab-fx-auto').textContent = `自動 · ${names[Fx.auto]}`;
}

document.querySelectorAll('[data-fx-choice]').forEach((button) => {
  button.addEventListener('click', () => Fx.set(button.dataset.fxChoice));
});
Fx.subscribe(() => {
  syncFxButtons();
  settings.sync(state);
});
syncFxButtons();

const dialogs = createDialogHost($('desk'));
let loadTimer = 0;

function simulateLoad(result) {
  window.clearTimeout(loadTimer);
  showView('loading');
  loadTimer = window.setTimeout(() => showView(result === 'error' ? 'error' : rowList.size ? 'rows' : 'empty'), 900);
}

document.querySelectorAll('[data-list-view]').forEach((button) => {
  button.addEventListener('click', () => {
    window.clearTimeout(loadTimer);
    const view = button.dataset.listView;
    if (view === 'rows') showView(rowList.size ? 'rows' : 'empty');
    else showView(view);
  });
});

$('entry-retry').addEventListener('click', () => simulateLoad('ok'));

$('set-clear').addEventListener('click', async () => {
  const count = rowList.size;
  if (!count) {
    island.toast({ text: '今天沒有可以清除的紀錄' });
    return;
  }
  const ok = await dialogs.confirm({
    source: $('set-clear'),
    frame: document.querySelector('.wm-window[data-app-id="settings"] .wm-window__frame'),
    title: '清除今天的示範資料？',
    text: `今天的 ${count} 筆紀錄會被移除，4 秒內可以在靈動島復原。`,
    confirmLabel: '清除',
  });
  if (!ok) return;
  const snapshot = ledger.rows.slice();
  rowList.removeAll().then(() => {
    island.toast({
      text: `已清除 ${count} 筆紀錄`,
      action: '復原',
      onAction: () => snapshot.forEach((row, i) => window.setTimeout(() => restoreRow(row, i), MotionSettings.reduced ? 0 : i * 60)),
    });
  });
});

function syncReminders(count) {
  menubar.setReminders(count);
  desktop.setBadge('calendar', count);
}

function addEntry({ type, amount, category, note }) {
  const now = new Date();
  const row = { time: `${pad(now.getHours())}:${pad(now.getMinutes())}`, category, note, amount, type };
  if (stageView !== 'rows') showView('rows');
  rowList.prepend(row);
  ledger.rows.unshift(row);
  applyToLedger(row, 1);
  island.celebrate({ label: `已記下 · ${category}`, amount, income: type === 'income' });
  if (type === 'expense' && ledger.expense / BUDGET >= 0.8) {
    window.setTimeout(() => notices.push({ app: 'overview', title: '預算快用完了', body: `本月已用 ${Math.round((ledger.expense / BUDGET) * 100)}%，還剩 NT$ ${formatAmount(BUDGET - ledger.expense)}` }), 900);
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

const island = createIsland({
  root: $('island'),
  pill: $('island-pill'),
  label: $('island-label'),
  panel: $('island-panel'),
  activity: $('island-activity'),
  onOpen() {
    $('island-amount').focus({ preventScroll: true });
  },
});

$('island-cancel').addEventListener('click', () => island.close());
$('island-panel').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('island-amount');
  const amount = readAmount(input);
  if (amount <= 0) {
    shake(input.closest('.island__amount'));
    return;
  }
  addEntry({ type: 'expense', amount, category: pickedChip(document.querySelector('[data-chips="island"]')), note: '' });
  input.value = '';
});

let photoUrl = null;
let toneToken = 0;

function applyTones({ bar, dock }) {
  root.style.setProperty('--bar-alpha', bar.alpha.toFixed(2));
  root.style.setProperty('--dock-alpha', dock.alpha.toFixed(2));
  root.dataset.barSolid = bar.solid ? '1' : '0';
}

function toneRegions() {
  const bar = $('menubar').getBoundingClientRect();
  const dockBg = $('dock').querySelector('.dock__bg');
  const dock = dockBg ? dockBg.getBoundingClientRect() : { left: 0, top: window.innerHeight - 80, width: window.innerWidth, height: 80 };
  return {
    bar: { x: 0, y: 0, w: window.innerWidth, h: bar.height },
    dock: { x: dock.left, y: dock.top, w: dock.width, h: dock.height },
  };
}

let autoAccent = presetAccent(state.wall);

function applyAccent() {
  const resolved = state.accent === 'auto' ? autoAccent : state.accent;
  root.dataset.accent = resolved;
  const names = { apple: '青蘋果', signal: '信號橘', ultramarine: '群青' };
  $('lab-accent-auto').textContent = `自動 · ${names[autoAccent]}`;
  settings.setAccentHint(state.accent === 'auto' ? `跟隨桌布 · 目前是${names[autoAccent]}` : '');
}

function refreshTones() {
  const mine = ++toneToken;
  if (state.wall !== 'photo' || !photoUrl) {
    applyTones(baseThickness(state.theme));
    autoAccent = presetAccent(state.wall);
    applyAccent();
    return;
  }
  sampleGlassThickness(photoUrl, toneRegions(), state.theme).then((tones) => {
    if (mine === toneToken) applyTones(tones);
  }).catch(() => {
    if (mine === toneToken) applyTones(baseThickness(state.theme));
  });
  wallpaperAccent(photoUrl).then((name) => {
    if (mine !== toneToken) return;
    autoAccent = name;
    applyAccent();
  }).catch(() => {});
}

let toneTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(toneTimer);
  toneTimer = window.setTimeout(refreshTones, 200);
});

function applyState() {
  root.dataset.style = state.style;
  root.dataset.theme = state.theme;
  root.dataset.wall = state.wall;
  root.dataset.lab = state.lab;
  document.querySelectorAll('[data-set]').forEach((button) => {
    button.setAttribute('aria-pressed', String(state[button.dataset.set] === button.dataset.value));
  });
  $('lab-toggle').textContent = state.lab === 'open' ? '收起' : '展開';
  $('lab-toggle').setAttribute('aria-expanded', String(state.lab === 'open'));
  island.relayout();
  entrySeg.measure();
  refreshTones();
  settings.sync(state);
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
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = URL.createObjectURL(file);
  root.style.setProperty('--wall-photo', `url("${photoUrl}")`);
  state.wall = 'photo';
  applyState();
});

$('lab-toggle').addEventListener('click', () => {
  state.lab = state.lab === 'open' ? 'closed' : 'open';
  applyState();
  save();
});

$('lab-radio').addEventListener('click', () => {
  const next = !menubar.playing;
  menubar.setPlaying(next);
  $('lab-radio').setAttribute('aria-pressed', String(next));
});

$('lab-remind').addEventListener('click', () => {
  syncReminders(menubar.reminders + 1);
});

$('lab-notify').addEventListener('click', () => notices.push({ app: 'life-reminder', title: '這禮拜花得比上週少', body: '少了 NT$ 1,240，餐飲省最多，繼續保持' }));

function placeWindows() {
  const area = wm.area;
  const unit = parseFloat(getComputedStyle(root).fontSize) || 20.8;
  const labSpace = state.lab === 'open' && window.innerWidth >= 1100 ? 15 * unit + 1.8 * unit - area.left : 0;
  const gap = 28;
  const entry = FRAMES['daily-entry'];
  const overview = FRAMES.overview;
  const total = entry.w + gap + overview.w;
  const x = Math.max(labSpace + 16, labSpace + (area.w - labSpace - total) / 2);
  store.setFrame('daily-entry', { x, y: 10, w: entry.w, h: Math.min(entry.h, area.h - 22) });
  store.setFrame('overview', { x: x + entry.w + gap, y: 38, w: overview.w, h: Math.min(overview.h, area.h - 50) });
}

let introTimers = [];

function later(fn, ms) {
  introTimers.push(window.setTimeout(fn, ms));
}

function intro() {
  introTimers.forEach((id) => window.clearTimeout(id));
  introTimers = [];
  const running = store.all().filter((record) => record.state !== 'closed').map((record) => record.id);
  running.forEach((id, i) => later(() => wm.close(id), i * 50));
  const start = running.length ? 560 + running.length * 50 : 240;
  later(() => {
    placeWindows();
    wm.open('daily-entry');
  }, start);
  later(() => {
    expenseOdo.set(ledger.expense, { from: 0 });
    budgetMotion.set({ f: 0 });
    wm.open('overview');
  }, start + 170);
  later(() => chart.grow(), start + 380);
  later(() => renderOverview(), start + 420);
  later(() => notices.push({ app: 'calendar', title: '10:00 牙醫回診', body: '還有 30 分鐘，記得帶健保卡', meta: '日曆' }), start + 1300);
  later(() => syncReminders(Math.max(1, menubar.reminders)), start + 1450);
  later(() => notices.push({ app: 'weather', title: '午後有雷陣雨', body: '14 點後降雨機率 70%，出門帶傘', meta: '天氣' }), start + 2100);
}

$('lab-replay').addEventListener('click', intro);

document.querySelectorAll('[data-press]').forEach(pressable);

window.setInterval(renderDates, 60000);
applyState();
startPerfMeter($('lab-perf'));

intro();

console.info('%cRingoOS%c design lab', 'font-weight:700;font-size:14px', 'color:#8b8f9a');
if (new URLSearchParams(window.location.search).has('debug')) {
  window.__ringoLab = { Animator, MotionSettings, entrySeg, wm, store, dock: desktop.dock, menubar };
}
