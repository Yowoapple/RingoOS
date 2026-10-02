import '@fontsource-variable/geist-mono';
import { Animator, createMotion } from '../motion/animator.js';
import { MotionSettings } from '../motion/presets.js';
import { Storage } from '../core/storage/storage.js';
import { Data } from '../core/data-model.js';
import { sanitizeSession, serializeSession } from '../wm/session.js';
import { scaledApps } from './apps.js';
import { APPS, renderIcon } from '../ui/icons.js';
import { Fx } from '../ui/fx-tier.js';
import { createIsland } from '../ui/island.js';
import { pressable } from '../ui/motion-kit.js';
import { createNotices } from '../ui/notices.js';
import { createNotifier } from './notifications.js';
import { createNotifyCenter } from './notify-center.js';
import { startTriggers } from './notify-triggers.js';
import { createDesktop } from './desktop.js';
import { createMenubar } from './menubar.js';
import { createAppearance } from './appearance.js';
import { createLedgerApp } from '../apps/ledger/ledger-app.js';
import { createOverviewApp } from '../apps/overview/overview-app.js';
import { createReminderApp } from '../apps/reminder/reminder-app.js';
import { createCalendarApp } from '../apps/calendar/calendar-app.js';
import { createDialogHost } from '../ui/dialog.js';
import { createWeatherApp } from '../apps/weather/weather-app.js';
import { glyph } from '../apps/weather/glyphs.js';
import { createCalculatorApp } from '../apps/calculator/calculator-app.js';
import { createRadioApp } from '../apps/radio/radio-app.js';
import { createSettingsApp } from '../apps/settings/settings-app.js';
import { createCompanion } from '../apps/companion/companion.js';
import { Calc } from '../core/calculations.js';

const SESSION_KEY = 'yoworingo.v2.windows';
const MOTION_KEY = 'yoworingo.motion-style';
const REDUCED_KEY = 'yoworingo.reduced-motion';
const MAGNIFY_KEY = 'yoworingo.v2.dock-magnify';
const SAVE_DELAY = 300;
const DESKTOP_KEY = 'yoworingo.v2.desktop';
const WIDGETS = ['island', 'weather', 'radio', 'bell', 'clock'];
const MOVING_IN = {};

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
  sizes.get('radio').size = { w: Math.round(920 * ratio), h: Math.round(640 * ratio) };
  sizes.get('settings').size = { w: Math.round(940 * ratio), h: Math.round(700 * ratio) };
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
  let center = null;
  const menubar = createMenubar({ root: $('menubar'), store, titles, onOpen: (id) => wm.open(id), onBell: (event) => center && center.toggle({ keyboard: event.detail === 0 }) });
  let activateItem = () => {};
  const notifier = createNotifier({
    onShow(item) {
      if (center && center.open) return;
      if (window.innerWidth < 768) {
        if (island.mode === 'idle') island.toast({ text: item.title, action: '查看', duration: 5000, onAction: () => notifier.activate(item.id) });
        return;
      }
      notices.push({ app: item.app, title: item.title, body: item.body, meta: titles.get(item.app) || '系統', onClick: () => notifier.activate(item.id) });
    },
    onActivate: (item) => activateItem(item),
  });
  center = createNotifyCenter({
    host: $('desk'),
    bell: menubar.bellButton,
    notifier,
    renderIcon,
    appTitle: (id) => titles.get(id) || '系統',
  });
  const syncUnread = () => menubar.setUnread(notifier.unread);
  notifier.subscribe(syncUnread);
  syncUnread();
  const triggers = startTriggers(notifier);

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
    findButton: $('ledger-find'),
    host: $('desk'),
    island,
    isActive: () => store.focusedId === 'daily-entry' && store.get('daily-entry').state === 'open',
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
      wm.summon('overview');
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

  let settingsRef = null;
  let companionRef = null;
  let lastWeather = null;
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
      triggers.weather(info);
      lastWeather = info;
      if (companionRef) companionRef.setWeather(info);
      if (settingsRef) settingsRef.sync();
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

  const radio = createRadioApp({ root: $('radio'), area: $('wm-area'), island, dialogs, store, wm, menubar });

  activateItem = (item) => {
    const target = item.target || {};
    if (item.app === 'overview' && target.mode) overview.show(target.mode, target.anchorKey);
    if (item.app === 'calendar' && target.dateKey) calendar.show(target.dateKey);
    if (APPS.some((app) => app.id === item.app)) wm.summon(item.app);
  };

  function readDesktop() {
    const saved = Storage.get(DESKTOP_KEY, null) || {};
    return {
      dockMode: saved.dockMode === 'minimized' ? 'minimized' : 'launcher',
      dockAutoHide: !!saved.dockAutoHide,
      widgets: { ...Object.fromEntries(WIDGETS.map((key) => [key, true])), ...(saved.widgets || {}) },
    };
  }
  let desktopState = readDesktop();
  function applyDesktop() {
    dock.setMode(desktopState.dockMode);
    dock.setAutoHide(desktopState.dockAutoHide);
    const hidden = WIDGETS.filter((key) => desktopState.widgets[key] === false);
    if (hidden.length) root.dataset.mbHide = hidden.join(' ');
    else delete root.dataset.mbHide;
  }
  const desktopPrefs = {
    get: () => ({ ...desktopState, widgets: { ...desktopState.widgets } }),
    set(patch) {
      desktopState = { ...desktopState, ...patch, widgets: { ...desktopState.widgets, ...(patch.widgets || {}) } };
      Storage.set(DESKTOP_KEY, desktopState);
      applyDesktop();
    },
    setMagnify(value) {
      dock.setMagnify(value);
      Storage.set(MAGNIFY_KEY, String(value));
    },
  };
  applyDesktop();

  const previousMonth = Calc.getPreviousMonthKey(Data.toMonthKey(todayKey()));
  Data.applyMonthlyAutoSavings(previousMonth, Calc.computeMonthSummary(previousMonth).net);

  function announcePosted(posted) {
    if (!posted.length) return;
    const total = posted.reduce((sum, p) => sum + p.amount, 0);
    island.toast({
      text: posted.length === 1 ? `已入帳 · ${posted[0].name}` : `已入帳 · ${posted.length} 筆固定支出`,
      amount: total,
      strike: false,
      action: '復原',
      duration: 6000,
      onAction() {
        posted.forEach((p) => Data.removeEntry(p.dateKey, 'expense', p.entryId));
      },
    });
  }

  function runRecurring() {
    if (!Data.hasDueRecurring()) return;
    const work = () => {
      Data.reloadFromStorage();
      return Data.postDueRecurring();
    };
    if (navigator.locks && navigator.locks.request) {
      navigator.locks.request('yoworingo-recurring', work).then(announcePosted).catch(() => {});
    } else {
      announcePosted(work());
    }
  }
  window.setTimeout(runRecurring, 1400);
  window.setInterval(runRecurring, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') runRecurring();
  });

  function syncReminders() {
    desktop.setBadge('calendar', Calc.getUpcomingTaskSummary().count);
  }
  Data.subscribe(syncReminders);
  syncReminders();

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.hidden = true;
  document.body.appendChild(fileInput);
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    appearance.setPhoto(file).catch((err) => {
      island.toast({ text: '桌布沒有換成功', note: err.message, duration: 4200 });
    });
  });

  const companion = createCompanion({ desk: $('desk'), menubar: $('menubar'), store, wm, island, notifier });
  companionRef = companion;
  if (lastWeather) companion.setWeather(lastWeather);

  const settings = createSettingsApp({
    root: $('settings'),
    ctx: {
      appearance,
      dock,
      desktopPrefs,
      companion,
      notifier,
      island,
      dialogs,
      weather,
      radio,
      menuHost: $('desk'),
      pickPhoto: () => fileInput.click(),
      setMotionPreset(value) {
        const next = value === 'ios' ? 'ios' : 'hyperos';
        usePreset(next);
        Storage.set(MOTION_KEY, next);
      },
      setReduced(mode) {
        Storage.set(REDUCED_KEY, mode);
        MotionSettings.setReduced(readReduced());
      },
    },
  });

  settingsRef = settings;

  store.subscribe(({ type, id }) => {
    if ((type === 'open' || type === 'restore') && id === 'settings') settings.intro();
    if ((type === 'open' || type === 'restore') && id === 'daily-entry') ledger.refreshGlass();
    if ((type === 'open' || type === 'restore') && id === 'overview') {
      overview.refreshGlass();
      overview.intro();
    }
    if ((type === 'open' || type === 'restore') && id === 'calendar') calendar.intro();
    if ((type === 'open' || type === 'restore') && id === 'weather') weather.intro();
    if ((type === 'open' || type === 'restore') && id === 'calculator') calculator.intro();
    if ((type === 'open' || type === 'restore') && id === 'radio') {
      radio.refreshGlass();
      radio.intro();
    }
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
    window.__ringo = { Animator, MotionSettings, Storage, Data, wm, store, dock, appearance, island, ledger, overview, reminder, calendar, weather, calculator, radio, notifier, center, triggers, notices, settings, companion };
  }
}

Promise.all([Storage.init().then(() => {
  Storage.importLegacyPrefs();
  Data.hydrate();
}), domReady()]).then(start).catch((err) => console.error('RingoOS: boot failed', err));
