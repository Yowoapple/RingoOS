import '@fontsource-variable/geist-mono';
import { Animator, createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';
import { Storage } from '../core/storage/storage.js';
import { Data } from '../core/data-model.js';
import { sanitizeSession, serializeSession } from '../wm/session.js';
import { scaledApps } from '../system/apps.js';
import { APPS, renderIcon } from '../ui/icons.js';
import { Fx } from '../ui/fx-tier.js';
import { createIsland } from '../ui/island.js';
import { pressable } from '../ui/motion-kit.js';
import { createNotices } from '../ui/notices.js';
import { createDesktop } from './desktop.js';
import { createMenubar } from './menubar.js';
import { createSettings } from './settings.js';
import { createAppearance } from './appearance.js';
import { createLedgerApp } from '../apps/ledger/ledger-app.js';
import { createOverviewApp } from '../apps/overview/overview-app.js';
import { createReminderApp } from '../apps/reminder/reminder-app.js';
import { createCalendarApp } from '../apps/calendar/calendar-app.js';
import { createDialogHost } from '../ui/dialog.js';
import { createWeatherApp } from '../apps/weather/weather-app.js';
import { glyph } from '../apps/weather/glyphs.js';
import { createCalculatorApp } from '../apps/calculator/calculator-app.js';
import { Calc } from '../core/calculations.js';

const SESSION_KEY = 'yoworingo.v2.windows';
const MOTION_KEY = 'yoworingo.motion-style';
const REDUCED_KEY = 'yoworingo.reduced-motion';
const MAGNIFY_KEY = 'yoworingo.v2.dock-magnify';
const SAVE_DELAY = 300;
const ACCENT_NAMES = { apple: '青蘋果', signal: '信號橘', ultramarine: '群青' };
const MOVING_IN = {
  radio: '唱片機與選台清單',
};

const root = document.documentElement;
const $ = (id) => document.getElementById(id);

function usePreset(name) {
  MotionSettings.usePreset(name);
  if (name !== 'hyperos') return;
  MotionSettings.setSpring('dock', { response: 0.32, damping: 0.66 });
  MotionSettings.setSpring('focus', { response: 0.34, damping: 0.62 });
}

function domReady() {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

function todayKey() {
  return Data.toDateKey(new Date());
}

function stubBody(app) {
  const body = document.createElement('div');
  body.className = 'win__body';
  body.innerHTML = '<div class="stub"><div class="stub__icon"></div><p class="stub__title"></p><p class="stub__note"></p><span class="tag">2.0 · Moving in</span></div>';
  body.querySelector('.stub__icon').innerHTML = renderIcon(app.id);
  body.querySelector('.stub__title').textContent = app.title;
  body.querySelector('.stub__note').textContent = `${MOVING_IN[app.id] || ''}。在那之前，請繼續使用 1.0`;
  return body;
}

function collectContent(app) {
  const source = document.querySelector(`.app-source[data-app-id="${app.id}"]`);
  if (!source) return { titlebar: [], body: [stubBody(app)], bodyClass: 'wm-window__body--stub' };
  const titlebar = source.querySelector(':scope > .app-source__titlebar');
  return {
    titlebar: titlebar ? Array.from(titlebar.children) : [],
    body: Array.from(source.children).filter((node) => node !== titlebar),
    bodyClass: { settings: 'wm-window__body--settings', calendar: 'wm-window__body--calendar', calculator: 'wm-window__body--calculator' }[app.id] || null,
  };
}

function readReduced() {
  const stored = Storage.get(REDUCED_KEY, 'system');
  if (stored === 'on') return true;
  if (stored === 'off') return false;
  return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function shake(element) {
  if (MotionSettings.reduced) return;
  const motion = createMotion({ x: 0 }, { response: 0.3, damping: 0.3, restDelta: 0.05 });
  motion.onUpdate(({ x }) => {
    element.style.transform = Math.abs(x) < 0.05 ? '' : `translate3d(${x}px, 0, 0)`;
  });
  motion.to({ x: 0 }, { velocity: { x: 600 } });
}

function start() {
  usePreset(Storage.get(MOTION_KEY, 'hyperos') === 'ios' ? 'ios' : 'hyperos');
  MotionSettings.setReduced(readReduced());
  Fx.boot();

  const appearance = createAppearance({
    root,
    regions() {
      const bar = $('menubar').getBoundingClientRect();
      const dockBg = document.querySelector('.dock__bg');
      const dock = dockBg ? dockBg.getBoundingClientRect() : { left: 0, top: window.innerHeight - 80, width: window.innerWidth, height: 80 };
      return { bar: { x: 0, y: 0, w: window.innerWidth, h: bar.height }, dock: { x: dock.left, y: dock.top, w: dock.width, h: dock.height } };
    },
  });

  const sizes = new Map(scaledApps(appearance.scale).map((app) => [app.id, app]));
  const ratio = Math.max(0.75, appearance.scale / 1.3);
  sizes.get('daily-entry').size = { w: Math.round(820 * ratio), h: Math.round(660 * ratio) };
  sizes.get('overview').size = { w: Math.round(780 * ratio), h: Math.round(620 * ratio) };
  sizes.get('life-reminder').size = { w: Math.round(800 * ratio), h: Math.round(600 * ratio) };
  sizes.get('calendar').size = { w: Math.round(940 * ratio), h: Math.round(640 * ratio) };
  sizes.get('weather').size = { w: Math.round(880 * ratio), h: Math.round(640 * ratio) };
  sizes.get('calculator').size = { w: Math.round(760 * ratio), h: Math.round(580 * ratio) };
  const apps = APPS.map((app) => ({
    id: app.id,
    title: app.title,
    frame: { ...sizes.get(app.id).size },
    min: { ...sizes.get(app.id).min },
    divider: app.id === 'settings',
    content: collectContent(app),
  }));
  const titles = new Map(APPS.map((app) => [app.id, app.title]));

  const desktop = createDesktop({ desk: $('desk'), areaEl: $('wm-area'), dockEl: $('dock'), wallEl: $('wall'), apps, renderIcon });
  const { wm, store, dock } = desktop;
  const magnify = parseFloat(Storage.get(MAGNIFY_KEY, 'NaN'));
  if (Number.isFinite(magnify)) dock.setMagnify(magnify);
  $('app-sources').remove();

  const notices = createNotices($('notices'), renderIcon);
  const menubar = createMenubar({ root: $('menubar'), store, titles, onOpen: (id) => wm.open(id) });

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
  const chips = document.querySelector('[data-chips="island"]');
  chips.textContent = '';
  Data.getState().settings.expenseCategories.slice(0, 4).forEach((name, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.setAttribute('role', 'radio');
    chip.setAttribute('aria-checked', String(i === 0));
    chip.textContent = name;
    chips.appendChild(chip);
  });
  chips.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    chips.querySelectorAll('.chip').forEach((other) => other.setAttribute('aria-checked', String(other === chip)));
  });
  $('island-cancel').addEventListener('click', () => island.close());
  $('island-panel').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $('island-amount');
    const amount = Number(String(input.value).replace(/[^\d]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      shake(input.closest('.island__amount'));
      input.focus();
      return;
    }
    const picked = chips.querySelector('.chip[aria-checked="true"]');
    const category = picked ? picked.textContent : '其他';
    Data.addExpenseEntry(todayKey(), { amount, category, note: '' });
    island.celebrate({ label: `已記下 · ${category}`, amount, income: false });
    input.value = '';
  });

  const ledger = createLedgerApp({
    root: $('ledger'),
    dateTag: $('ledger-date'),
    todayButton: $('ledger-today'),
    host: $('desk'),
    island,
  });

  const overview = createOverviewApp({
    root: $('overview'),
    periodTag: $('overview-period'),
    nowButton: $('overview-now'),
    prevButton: $('overview-prev'),
    nextButton: $('overview-next'),
  });

  const reminder = createReminderApp({
    root: $('reminder'),
    host: $('desk'),
    voiceEl: document.querySelector('[data-rm-voice]'),
    periodTag: $('reminder-period'),
    nowButton: $('reminder-now'),
    prevButton: $('reminder-prev'),
    nextButton: $('reminder-next'),
    onReveal({ mode, anchorKey }) {
      overview.show(mode, anchorKey);
      wm.open('overview');
    },
    onCompose() {
      wm.open('daily-entry');
    },
  });

  const dialogs = createDialogHost($('desk'));
  const calendar = createCalendarApp({
    root: $('calendar'),
    host: $('desk'),
    island,
    dialogs,
    periodTag: $('calendar-period'),
    todayButton: $('calendar-today'),
    prevButton: $('calendar-prev'),
    nextButton: $('calendar-next'),
  });

  const mbWeather = document.querySelector('.mb-weather');
  const weather = createWeatherApp({
    root: $('weather'),
    host: $('desk'),
    island,
    dialogs,
    placeButton: $('weather-place'),
    refreshButton: $('weather-refresh'),
    updatedTag: $('weather-updated'),
    onData(info) {
      if (!mbWeather) return;
      if (!info) {
        mbWeather.hidden = true;
        return;
      }
      const icon = mbWeather.querySelector('svg');
      const current = icon ? icon.dataset.glyph : null;
      if (current !== info.current.glyph) {
        const holder = document.createElement('span');
        holder.innerHTML = glyph(info.current.glyph, 'wx-g mb-weather__glyph');
        if (icon) icon.replaceWith(holder.firstElementChild);
        else mbWeather.prepend(holder.firstElementChild);
      }
      mbWeather.querySelector('.mb-temp').textContent = `${Math.round(info.temperature)}°`;
      mbWeather.setAttribute('aria-label', `${info.location.name} ${info.current.text} ${Math.round(info.temperature)} 度`);
      mbWeather.hidden = false;
    },
    onAlert({ text }) {
      island.toast({ text, action: '查看', duration: 6000, onAction: () => wm.open('weather') });
    },
  });

  const calculator = createCalculatorApp({
    root: $('calculator'),
    island,
    dialogs,
    isActive: () => store.focusedId === 'calculator' && store.get('calculator').state === 'open',
    onRecord(amount) {
      const input = $('island-amount');
      input.value = String(amount);
      if (island.mode === 'open') input.focus({ preventScroll: true });
      else island.open();
    },
  });

  function syncReminders() {
    const open = Calc.getUpcomingTaskSummary().count;
    menubar.setReminders(open);
    desktop.setBadge('calendar', open);
  }
  Data.subscribe(syncReminders);
  syncReminders();

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.hidden = true;
  document.body.appendChild(fileInput);

  const settings = createSettings({
    root: $('settings'),
    state: appearance.state,
    menuHost: $('desk'),
    scale: appearance.scale,
    hasPhoto: () => appearance.hasPhoto,
    dock: {
      get magnify() { return dock.magnify; },
      setMagnify(value) {
        dock.setMagnify(value);
        Storage.set(MAGNIFY_KEY, String(value));
      },
    },
    onChange(key, value) {
      if (key === 'motion') {
        const next = value === 'ios' ? 'ios' : 'hyperos';
        usePreset(next);
        Storage.set(MOTION_KEY, next);
      } else if (key === 'reduced') {
        MotionSettings.setReduced(value);
        Storage.set(REDUCED_KEY, value ? 'on' : 'off');
      } else if (key === 'scale') {
        appearance.setScale(value);
      } else if (key === 'wall' && (value === 'upload' || (value === 'photo' && !appearance.hasPhoto))) {
        fileInput.click();
        syncSettings();
      } else {
        appearance.set(key, value);
      }
    },
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    appearance.setPhoto(file).catch((err) => {
      notices.push({ app: 'settings', title: '桌布沒有換成功', body: err.message, meta: '設定' });
    });
  });

  function syncSettings() {
    settings.sync({ ...appearance.state, scale: appearance.scale });
    const state = appearance.state;
    settings.setAccentHint(state.accent === 'auto' ? `跟隨桌布 · 目前是${ACCENT_NAMES[appearance.autoAccent]}` : '');
  }
  appearance.subscribe(syncSettings);
  Fx.subscribe(syncSettings);
  syncSettings();

  store.subscribe(({ type, id }) => {
    if ((type === 'open' || type === 'restore') && id === 'settings') settings.refreshGlass();
    if ((type === 'open' || type === 'restore') && id === 'daily-entry') ledger.refreshGlass();
    if ((type === 'open' || type === 'restore') && id === 'overview') {
      overview.refreshGlass();
      overview.intro();
    }
    if ((type === 'open' || type === 'restore') && id === 'calendar') calendar.intro();
    if ((type === 'open' || type === 'restore') && id === 'weather') weather.intro();
    if ((type === 'open' || type === 'restore') && id === 'calculator') calculator.intro();
    if ((type === 'open' || type === 'restore') && id === 'life-reminder') {
      reminder.refreshGlass();
      reminder.intro();
    }
  });

  let saveTimer = 0;
  const saveSession = () => {
    window.clearTimeout(saveTimer);
    saveTimer = 0;
    Storage.set(SESSION_KEY, serializeSession(store));
  };
  wm.restoreSession(sanitizeSession(Storage.get(SESSION_KEY, null), APPS.map((app) => app.id)));
  store.subscribe(() => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveSession, SAVE_DELAY);
  });
  window.addEventListener('pagehide', saveSession);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && saveTimer) saveSession();
  });

  document.querySelectorAll('[data-press]').forEach(pressable);

  if (Storage.getMode() === 'memory') {
    notices.push({ app: 'settings', title: '資料庫暫時打不開', body: '這次的變更不會被儲存，請關掉其他 RingoOS 分頁後重新整理', meta: '系統' });
  }

  console.info('%cRingoOS%c 2.0 by YoWoRingo', 'font-weight:700;font-size:14px', 'color:#8b8f9a');
  if (new URLSearchParams(window.location.search).has('debug')) {
    window.__ringo = { Animator, MotionSettings, Storage, Data, wm, store, dock, appearance, island, overview, reminder, calendar, weather, calculator };
  }
}

Promise.all([Storage.init().then(() => {
  Storage.importLegacyPrefs();
  Data.hydrate();
}), domReady()]).then(start).catch((err) => console.error('RingoOS: boot failed', err));
