import { createMotion } from '../../motion/animator.js';
import { MotionSettings } from '../../motion/presets.js';
import { Data } from '../../core/data-model.js';
import { createRowList } from '../../ui/rows.js';
import { createStage } from '../../ui/stage.js';
import { createSelect } from '../../ui/controls.js';
import { createSegmented } from '../../ui/segmented.js';
import { createOdometer } from '../../ui/odometer.js';
import { Fx } from '../../ui/fx-tier.js';
import { DURATION_OPTIONS, REMINDER_OPTIONS, calendarText, download, effectiveDetail, fileName, qrSvg } from './ics.js';
import { parseTask } from './parse.js';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const WIDE_REM = 34;
const RAIL_REM = 52;
const TITLE_CELL_REM = 3.2;
const UPCOMING_DAYS = 14;
const CELLS = 42;
const LEAD = { response: 0.26, damping: 0.62 };
const TRAIL = { response: 0.46, damping: 0.74 };
const CHEVRON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.6 3l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle class="tk-ring" cx="10" cy="10" r="8.2" pathLength="1"/><circle class="tk-fill" cx="10" cy="10" r="9"/><path class="tk-tick" d="M6.2 10.3l2.6 2.6 5-5.4" pathLength="1"/></svg>';
const PIN = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10.6s3.4-3.1 3.4-5.6a3.4 3.4 0 0 0-6.8 0c0 2.5 3.4 5.6 3.4 5.6z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="6" cy="5" r="1.1" fill="currentColor"/></svg>';
const BELL = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.6a2.9 2.9 0 0 1 2.9 2.9v1.9l.9 1.4H2.2l.9-1.4V4.5A2.9 2.9 0 0 1 6 1.6zM4.9 9.4h2.2a1.1 1.1 0 0 1-2.2 0z" fill="currentColor"/></svg>';

function pad(n) {
  return String(n).padStart(2, '0');
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function today() {
  return startOfDay(new Date());
}

function sameDay(a, b) {
  return a.getTime() === b.getTime();
}

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function gridStart(view) {
  return addDays(view, -((view.getDay() + 6) % 7));
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function blur(t, max) {
  return t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * max).toFixed(2)}px)` : '';
}

function spring(config) {
  return MotionSettings.reduced ? MotionSettings.spring('focus') : config;
}

function rem() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

function relative(date) {
  const diff = Math.round((date - today()) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  if (diff === 2) return '後天';
  return diff > 0 ? `${diff} 天後` : `${-diff} 天前`;
}

function order(tasks) {
  const rank = (task) => (task.time ? `0${task.time}` : '1');
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => (Number(a.task.done) - Number(b.task.done)) || rank(a.task).localeCompare(rank(b.task)) || a.index - b.index)
    .map(({ task }) => task);
}

export function createCalendarApp({ root, host, island, dialogs, periodTag, todayButton, prevButton, nextButton }) {
  const win = root.closest('.wm-window');
  const $ = (name) => root.querySelector(`[data-cal="${name}"]`);
  const gridEl = $('grid');
  const wrap = gridEl.parentElement;
  const ringEl = $('ring');
  const upcomingEl = $('upcoming');
  const upcomingEmpty = $('upcoming-empty');
  const relEl = $('day-rel');
  const dateEl = $('day-date');
  const pickButton = $('pick');
  const addForm = $('add');
  const addInput = $('add-input');
  const addTime = $('add-time');
  const listEl = $('rows');
  const emptyTitle = $('empty-title');
  const exportBar = $('export');
  const exportCount = $('export-count');

  let selected = today();
  let view = monthStart(selected);
  let wide = false;
  let rail = false;
  let picking = false;
  const picked = new Set();
  let expandedId = null;
  const restoring = new Set();
  const lastSeen = new Map();
  const busy = new Set();

  const stage = createStage($('stage'), { initial: 'rows' });
  const dayNum = createOdometer($('day-num'), { value: selected.getDate(), format: (v) => pad(Math.round(v)) });

  function key(date = selected) {
    return Data.toDateKey(date);
  }

  const slide = createMotion({ e: 1, dir: 1 }, { response: 0.4, damping: 0.78, restDelta: { e: 0.002, dir: 0.01 } });
  slide.onUpdate(({ e, dir }) => {
    const t = clamp01(e);
    wrap.style.opacity = t > 0.999 ? '' : String(t);
    wrap.style.transform = t > 0.999 ? '' : `translate3d(${(1 - e) * 26 * dir}px, 0, 0)`;
    wrap.style.filter = blur(t, 4);
  });

  const listSwap = createMotion({ e: 1, dir: 1 }, { response: 0.36, damping: 0.8, restDelta: { e: 0.002, dir: 0.01 } });
  listSwap.onUpdate(({ e, dir }) => {
    const t = clamp01(e);
    listEl.style.opacity = t > 0.999 ? '' : String(t);
    listEl.style.transform = t > 0.999 ? '' : `translate3d(${(1 - t) * 18 * dir}px, 0, 0)`;
    listEl.style.filter = blur(t, 3);
  });

  const ring = createMotion({ l: 0, t: 0, r: 0, b: 0, o: 0 }, { response: 0.4, damping: 0.75, restDelta: { l: 0.05, t: 0.05, r: 0.05, b: 0.05, o: 0.002 } });
  ring.onUpdate(({ l, t, r, b, o }) => {
    const w = Math.max(0, r - l);
    const h = Math.max(0, b - t);
    ringEl.style.transform = `translate3d(${l}px, ${t}px, 0)`;
    ringEl.style.width = `${w}px`;
    ringEl.style.height = `${h}px`;
    ringEl.style.opacity = String(clamp01(o));
  });

  function cellFor(date) {
    return gridEl.querySelector(`[data-key="${key(date)}"]`);
  }

  function ringBox(cell) {
    const inset = rem() * 0.12;
    return { l: cell.offsetLeft + inset, t: cell.offsetTop + inset, r: cell.offsetLeft + cell.offsetWidth - inset, b: cell.offsetTop + cell.offsetHeight - inset };
  }

  function placeRing(animate) {
    const cell = cellFor(selected);
    if (!cell || !cell.offsetWidth) {
      ring.to({ o: 0 }, { response: 0.2, damping: 1 });
      return;
    }
    const box = ringBox(cell);
    if (!animate || MotionSettings.reduced || ring.get('o') < 0.05) {
      ring.set(box);
      ring.to({ o: 1 }, { response: 0.25, damping: 1 });
      return;
    }
    const right = box.l > ring.get('l');
    const down = box.t > ring.get('t');
    ring.to({ r: box.r }, right ? LEAD : TRAIL);
    ring.to({ l: box.l }, right ? TRAIL : LEAD);
    ring.to({ b: box.b }, down ? LEAD : TRAIL);
    ring.to({ t: box.t }, down ? TRAIL : LEAD);
    ring.to({ o: 1 }, { response: 0.25, damping: 1 });
  }

  function upcomingKeys() {
    const lookahead = Data.getTaskReminderLookaheadDays();
    const keys = new Set();
    for (let i = 0; i <= lookahead; i += 1) keys.add(key(addDays(today(), i)));
    return keys;
  }

  function showTitles() {
    const cell = gridEl.firstElementChild;
    return !!cell && cell.offsetWidth >= TITLE_CELL_REM * rem() && cell.offsetHeight >= 3.4 * rem();
  }

  function renderGrid() {
    const focusedKey = document.activeElement && gridEl.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    const start = gridStart(view);
    const now = today();
    const urgent = upcomingKeys();
    const titles = root.classList.contains('show-titles');
    gridEl.textContent = '';
    for (let i = 0; i < CELLS; i += 1) {
      const date = addDays(start, i);
      const dateKey = key(date);
      const tasks = Data.getDayTasks(dateKey);
      const pending = tasks.filter((task) => !task.done);
      const indicators = Data.getDayIndicators(dateKey);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal-cell';
      cell.dataset.key = dateKey;
      cell.setAttribute('role', 'gridcell');
      cell.tabIndex = sameDay(date, selected) ? 0 : -1;
      if (date.getMonth() !== view.getMonth()) cell.classList.add('is-out');
      if (sameDay(date, now)) cell.classList.add('is-today');
      if (sameDay(date, selected)) cell.setAttribute('aria-selected', 'true');
      if (date.getDay() === 0 || date.getDay() === 6) cell.classList.add('is-weekend');
      if (pending.length && urgent.has(dateKey)) cell.classList.add('is-urgent');
      const label = [`${date.getMonth() + 1} 月 ${date.getDate()} 日`];
      if (pending.length) label.push(`${pending.length} 件代辦`);
      cell.setAttribute('aria-label', label.join('，'));
      const num = document.createElement('span');
      num.className = 'cal-cell__num mono';
      num.textContent = String(date.getDate());
      cell.appendChild(num);
      const dots = document.createElement('span');
      dots.className = 'cal-cell__dots';
      if (indicators.hasMoney) dots.insertAdjacentHTML('beforeend', '<i class="cal-dot cal-dot--money"></i>');
      if (tasks.length) dots.insertAdjacentHTML('beforeend', `<i class="cal-dot cal-dot--task${pending.length ? '' : ' is-done'}"></i>`);
      cell.appendChild(dots);
      if (titles && tasks.length) {
        const items = document.createElement('span');
        items.className = 'cal-cell__items';
        order(tasks).slice(0, 2).forEach((task) => {
          const item = document.createElement('span');
          item.className = `cal-cell__item${task.done ? ' is-done' : ''}`;
          item.textContent = task.text;
          if (task.time) item.title = `${task.time} ${task.text}`;
          items.appendChild(item);
        });
        if (tasks.length > 2) {
          const more = document.createElement('span');
          more.className = 'cal-cell__more mono';
          more.textContent = `+${tasks.length - 2}`;
          items.appendChild(more);
        }
        cell.appendChild(items);
      }
      gridEl.appendChild(cell);
    }
    if (focusedKey) {
      const again = gridEl.querySelector(`[data-key="${focusedKey}"]`);
      if (again) again.focus({ preventScroll: true });
    }
  }

  function renderTag() {
    const now = today();
    const current = view.getFullYear() === now.getFullYear() && view.getMonth() === now.getMonth();
    periodTag.textContent = `${view.getFullYear()}.${pad(view.getMonth() + 1)}`;
    periodTag.classList.toggle('is-past', !current);
    const away = !current || !sameDay(selected, now);
    todayButton.hidden = !away;
  }

  function shiftMonth(step, animate = true) {
    view = new Date(view.getFullYear(), view.getMonth() + step, 1);
    renderGrid();
    renderTag();
    placeRing(false);
    if (animate && !MotionSettings.reduced) {
      slide.set({ e: 0, dir: Math.sign(step) });
      slide.to({ e: 1 }, { response: 0.4, damping: 0.78 });
    }
  }

  function renderHeader() {
    dayNum.set(selected.getDate());
    relEl.textContent = relative(selected);
    dateEl.textContent = `${selected.getMonth() + 1} 月 · 週${WEEK[selected.getDay()]}`;
    root.classList.toggle('is-today', sameDay(selected, today()));
  }

  function setDate(next, { focus = false } = {}) {
    const target = startOfDay(next);
    if (sameDay(target, selected)) {
      if (focus) focusCell();
      return;
    }
    const dir = target > selected ? 1 : -1;
    selected = target;
    stopPicking();
    collapse(true);
    const start = gridStart(view);
    const inGrid = target >= start && target < addDays(start, CELLS);
    if (!inGrid || target.getMonth() !== view.getMonth()) {
      const step = (target.getFullYear() - view.getFullYear()) * 12 + target.getMonth() - view.getMonth();
      view = monthStart(target);
      renderGrid();
      placeRing(false);
      if (!MotionSettings.reduced) {
        slide.set({ e: 0, dir: Math.sign(step) || dir });
        slide.to({ e: 1 }, { response: 0.4, damping: 0.78 });
      }
    } else {
      gridEl.querySelectorAll('[aria-selected]').forEach((cell) => {
        cell.removeAttribute('aria-selected');
        cell.tabIndex = -1;
      });
      const cell = cellFor(target);
      cell.setAttribute('aria-selected', 'true');
      cell.tabIndex = 0;
      placeRing(true);
    }
    renderTag();
    renderHeader();
    upcomingEl.querySelectorAll('.cal-up').forEach((group) => group.classList.toggle('is-selected', group.dataset.key === key()));
    lastSeen.clear();
    reconcileQuiet();
    if (!MotionSettings.reduced) {
      listSwap.set({ e: 0, dir });
      listSwap.to({ e: 1 }, { response: 0.36, damping: 0.8 });
    }
    if (focus) focusCell();
  }

  function focusCell() {
    const cell = cellFor(selected);
    if (cell) cell.focus({ preventScroll: true });
  }

  gridEl.addEventListener('click', (event) => {
    const cell = event.target.closest('.cal-cell');
    if (!cell) return;
    setDate(new Date(`${cell.dataset.key}T00:00:00`));
  });

  gridEl.addEventListener('keydown', (event) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (moves[event.key] !== undefined) {
      event.preventDefault();
      setDate(addDays(selected, moves[event.key]), { focus: true });
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      setDate(new Date(selected.getFullYear(), selected.getMonth() + (event.key === 'PageUp' ? -1 : 1), Math.min(selected.getDate(), 28)), { focus: true });
    } else if (event.key === 'Home') {
      event.preventDefault();
      setDate(today(), { focus: true });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      addInput.focus();
    }
  });

  function rowOf(task) {
    return { ...task, type: task.done ? 'task-done' : 'task' };
  }

  function metaHtml(task) {
    const detail = effectiveDetail(task);
    const bits = [];
    if (detail.location.trim()) bits.push(`<span class="tk-meta__bit">${PIN}<span></span></span>`);
    if (task.time && detail.reminderLead !== 'none') bits.push(`<span class="tk-meta__bit">${BELL}<span></span></span>`);
    return bits;
  }

  function animateCheck(button, toDone) {
    const rowEl = button.closest('.row');
    const fill = button.querySelector('.tk-fill');
    const tick = button.querySelector('.tk-tick');
    const text = rowEl.querySelector('.tk-text');
    const strike = rowEl.querySelector('.tk-strike');
    if (MotionSettings.reduced) return Promise.resolve();
    const motion = createMotion({ f: toDone ? 0 : 1, k: toDone ? 0 : 1, s: toDone ? 0 : 1 }, { response: 0.3, damping: 1, restDelta: 0.002 });
    motion.onUpdate(({ f, k, s }) => {
      fill.style.transform = `scale(${Math.max(0, f)})`;
      fill.style.opacity = String(clamp01(f * 3));
      tick.style.strokeDashoffset = String(1 - clamp01(k));
      strike.style.transform = `scaleX(${clamp01(s)})`;
      strike.style.transformOrigin = toDone ? 'left center' : 'right center';
      text.style.opacity = String(1 - 0.45 * clamp01(s));
    });
    button.classList.add('is-animating');
    if (toDone) {
      motion.to({ f: 1 }, { response: 0.34, damping: 0.5 });
      window.setTimeout(() => motion.to({ k: 1 }, { response: 0.26, damping: 1 }), 110);
      window.setTimeout(() => motion.to({ s: 1 }, { response: 0.4, damping: 0.82 }), 70);
      return new Promise((resolve) => window.setTimeout(resolve, 520));
    }
    motion.to({ k: 0 }, { response: 0.18, damping: 1 });
    motion.to({ s: 0 }, { response: 0.3, damping: 0.9 });
    window.setTimeout(() => motion.to({ f: 0 }, { response: 0.24, damping: 1 }), 60);
    return new Promise((resolve) => window.setTimeout(resolve, 320));
  }

  function renderRow(row) {
    const holder = document.createElement('template');
    holder.innerHTML = `<button type="button" class="tk-check" data-row-own>${CHECK}</button><span class="tk-main"><span class="tk-line"><span class="tk-time mono"></span><span class="tk-text"><span class="tk-label"></span><i class="tk-strike" aria-hidden="true"></i></span></span><span class="tk-meta"></span></span><span class="tk-side"><span class="tk-pick" aria-hidden="true"></span><span class="tk-chev">${CHEVRON}</span></span>`;
    const fragment = holder.content;
    const check = fragment.querySelector('.tk-check');
    check.setAttribute('aria-pressed', String(!!row.done));
    check.setAttribute('aria-label', row.done ? `取消完成：${row.text}` : `標記完成：${row.text}`);
    const time = fragment.querySelector('.tk-time');
    time.textContent = row.time || '整天';
    time.classList.toggle('is-allday', !row.time);
    fragment.querySelector('.tk-label').textContent = row.text;
    const meta = fragment.querySelector('.tk-meta');
    const detail = effectiveDetail(row);
    const bits = metaHtml(row);
    if (bits.length) {
      meta.innerHTML = bits.join('');
      const spans = meta.querySelectorAll('.tk-meta__bit > span');
      let i = 0;
      if (detail.location.trim()) spans[i++].textContent = detail.location.trim();
      if (row.time && detail.reminderLead !== 'none') spans[i].textContent = REMINDER_OPTIONS.find((o) => o.value === detail.reminderLead)?.label || '';
    } else {
      meta.hidden = true;
    }
    check.addEventListener('click', (event) => {
      event.stopPropagation();
      if (busy.has(row.id)) return;
      busy.add(row.id);
      const dateKey = key();
      animateCheck(check, !row.done).then(() => {
        busy.delete(row.id);
        Data.toggleTask(dateKey, row.id);
      });
    });
    return fragment;
  }

  function signature(task) {
    const d = effectiveDetail(task);
    return JSON.stringify([task.text, task.time, task.done, d.location, d.reminderLead]);
  }

  function desired() {
    return order(Data.getDayTasks(key())).map(rowOf);
  }

  function handleDelete(row) {
    const dateKey = key();
    const index = Data.getTaskIndex(dateKey, row.id);
    if (index < 0) return;
    const task = { ...Data.getDayTasks(dateKey)[index] };
    if (expandedId === row.id) collapse(true);
    picked.delete(row.id);
    Data.removeTask(dateKey, row.id);
    lastSeen.delete(row.id);
    island.toast({
      text: `已刪除 · ${row.text.length > 12 ? `${row.text.slice(0, 12)}…` : row.text}`,
      action: '復原',
      onAction() {
        restoring.add(row.id);
        Data.restoreTask(dateKey, task, index);
      },
    });
  }

  const rowList = createRowList(listEl, {
    render: renderRow,
    onDelete: handleDelete,
    onSelect(row) {
      if (picking) {
        if (row) {
          togglePick(row.id);
          queueMicrotask(() => rowList.clearSelection());
        }
        return;
      }
      if (row) expand(row.id);
      else collapse();
    },
  });

  function reconcile() {
    const rows = desired();
    const ids = new Set(rows.map((row) => row.id));
    rowList.ids().forEach((id) => {
      if (!ids.has(id)) {
        if (expandedId === id) collapse(true);
        rowList.removeId(id);
      }
    });
    rows.forEach((row, index) => {
      if (rowList.has(row.id)) {
        if (lastSeen.get(row.id) !== signature(row)) rowList.update(row);
      } else {
        rowList.insertAt(row, index, restoring.has(row.id) ? 'left' : 'top');
        restoring.delete(row.id);
      }
      lastSeen.set(row.id, signature(row));
    });
    rowList.order(rows.map((row) => row.id));
    afterRows(rows);
  }

  function reconcileQuiet() {
    const rows = desired();
    rowList.reset(rows);
    rows.forEach((row) => lastSeen.set(row.id, signature(row)));
    afterRows(rows);
  }

  function afterRows(rows) {
    stage.show(rows.length ? 'rows' : 'empty');
    emptyTitle.textContent = `${relative(selected) === '今天' ? '今天' : '這天'}沒有代辦`;
    pickButton.hidden = rows.length < 1;
    syncPicks();
    if (expandedId) {
      const el = rowList.element(expandedId);
      if (el && el.nextElementSibling !== detail.el) el.after(detail.el);
      if (el) detail.bind(rows.find((row) => row.id === expandedId));
    }
  }

  const detail = createDetail();

  function createDetail() {
    const el = document.createElement('div');
    el.className = 'tk-detail';
    el.dataset.rowOwn = '';
    el.innerHTML = '<div class="tk-detail__inner">'
      + '<div class="tk-detail__grid">'
      + '<div class="tk-field tk-field--wide"><span class="tk-field__label">時間</span><div class="tk-when">'
      + '<div class="seg tk-when__seg" role="tablist" aria-label="整天或指定時間" data-d="when"><span class="seg__platter" aria-hidden="true"><span class="seg__blob"></span></span><span class="seg__lens" aria-hidden="true"></span><button type="button" class="seg__btn" role="tab" aria-selected="true">整天</button><button type="button" class="seg__btn" role="tab" aria-selected="false">指定時間</button></div>'
      + '<div class="tk-clock" data-d="clock" hidden><input class="tk-clock__part mono" data-d="hh" inputmode="numeric" maxlength="2" autocomplete="off" aria-label="小時，0 到 23"><span class="tk-clock__colon mono" aria-hidden="true">:</span><input class="tk-clock__part mono" data-d="mm" inputmode="numeric" maxlength="2" autocomplete="off" aria-label="分鐘，0 到 59"><span class="tk-clock__hint">24 小時制</span></div>'
      + '</div></div>'
      + '<div class="tk-field" data-d="reminder-wrap"><span class="tk-field__label">提醒</span><div class="sel" data-d="reminder"><button type="button" class="sel__btn" aria-label="提醒"><span class="sel__value"></span><svg class="sel__chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 4.8L6 7.3l2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div>'
      + '<div class="tk-field" data-d="duration-wrap"><span class="tk-field__label">時長</span><div class="sel" data-d="duration"><button type="button" class="sel__btn" aria-label="時長"><span class="sel__value"></span><svg class="sel__chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 4.8L6 7.3l2.5-2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div>'
      + '<div class="tk-field tk-field--wide"><span class="tk-field__label">地點</span><input class="field" data-d="location" placeholder="選填" aria-label="地點" autocomplete="off"></div>'
      + '<div class="tk-field tk-field--wide"><span class="tk-field__label">備註</span><textarea class="field tk-field__note" data-d="description" rows="2" placeholder="選填" aria-label="備註"></textarea></div>'
      + '</div>'
      + '<div class="tk-detail__actions"><button type="button" class="btn btn--secondary" data-d="phone">加到手機</button><button type="button" class="btn btn--danger" data-d="delete">刪除</button></div>'
      + '</div>';
    const q = (name) => el.querySelector(`[data-d="${name}"]`);
    const inner = el.querySelector('.tk-detail__inner');
    const clock = q('clock');
    const hhInput = q('hh');
    const mmInput = q('mm');
    const location = q('location');
    const description = q('description');
    let task = null;
    let dateKey = null;
    const duration = createSelect(q('duration'), {
      options: DURATION_OPTIONS,
      value: '30',
      menuHost: host,
      onChange: (value) => { if (task) Data.updateTaskDetails(dateKey, task.id, { durationChoice: value }); },
    });
    const reminder = createSelect(q('reminder'), {
      options: REMINDER_OPTIONS,
      value: 'none',
      menuHost: host,
      onChange: (value) => { if (task) Data.updateTaskDetails(dateKey, task.id, { reminderLead: value }); },
    });
    let quiet = false;
    let commitTimer = 0;
    const clockMotion = createMotion({ e: 0 }, { response: 0.42, damping: 0.7, restDelta: 0.002 });
    clockMotion.onUpdate(({ e }) => {
      const t = clamp01(e);
      clock.style.opacity = String(t);
      clock.style.transform = t > 0.999 ? '' : `translate3d(${(1 - e) * -10}px, 0, 0) scale(${0.92 + 0.08 * t})`;
      clock.style.filter = blur(t, 4);
      if (e < 0.01 && !clock.dataset.on) clock.hidden = true;
    });

    function showClock(on, animate = true) {
      if (on === !!clock.dataset.on) return;
      if (on) {
        clock.dataset.on = '1';
        clock.hidden = false;
        if (!animate || MotionSettings.reduced) clockMotion.set({ e: 1 });
        else clockMotion.to({ e: 1 }, { response: 0.42, damping: 0.66 });
      } else {
        delete clock.dataset.on;
        if (!animate || MotionSettings.reduced) {
          clockMotion.set({ e: 0 });
          clock.hidden = true;
        } else {
          clockMotion.to({ e: 0 }, { response: 0.2, damping: 1 });
        }
      }
    }

    function pop(input) {
      if (MotionSettings.reduced) return;
      const motion = createMotion({ s: 0.9 }, { response: 0.3, damping: 0.45, restDelta: 0.0005 });
      motion.onUpdate(({ s }) => {
        input.style.transform = Math.abs(s - 1) < 0.0005 ? '' : `scale(${s})`;
      });
      motion.to({ s: 1 }, { response: 0.3, damping: 0.45, velocity: { s: 2 } });
    }

    function partsOf(time) {
      const [h, m] = (time || '09:00').split(':');
      return { h: Number(h), m: Number(m) };
    }

    function writeClock(time) {
      const { h, m } = partsOf(time);
      if (document.activeElement !== hhInput) hhInput.value = pad(h);
      if (document.activeElement !== mmInput) mmInput.value = pad(m);
    }

    function readClock() {
      const h = Math.max(0, Math.min(23, Number(hhInput.value.replace(/\D/g, '')) || 0));
      const m = Math.max(0, Math.min(59, Number(mmInput.value.replace(/\D/g, '')) || 0));
      return `${pad(h)}:${pad(m)}`;
    }

    function commitClock(delay = 0) {
      window.clearTimeout(commitTimer);
      const run = () => {
        if (!task || !clock.dataset.on) return;
        const time = readClock();
        hhInput.value = time.slice(0, 2);
        mmInput.value = time.slice(3);
        if (time !== task.time) Data.setTaskTime(dateKey, task.id, time);
      };
      if (delay) commitTimer = window.setTimeout(run, delay);
      else run();
    }

    function defaultTime() {
      const now = new Date();
      if (dateKey === Data.toDateKey(now) && now.getHours() < 23) return `${pad(now.getHours() + 1)}:00`;
      return '09:00';
    }

    const when = createSegmented(q('when'), {
      onChange(index) {
        if (quiet || !task) return;
        if (index === 0) {
          window.clearTimeout(commitTimer);
          showClock(false);
          Data.setTaskTime(dateKey, task.id, null);
          return;
        }
        const time = defaultTime();
        writeClock(time);
        showClock(true);
        Data.setTaskTime(dateKey, task.id, time);
        window.setTimeout(() => hhInput.focus({ preventScroll: true }), MotionSettings.reduced ? 0 : 180);
      },
    });

    function nudge(input, direction) {
      const hour = input === hhInput;
      const current = Number(input.value.replace(/\D/g, '')) || 0;
      let next;
      if (hour) next = (current + direction + 24) % 24;
      else {
        const snapped = direction > 0 ? Math.floor(current / 5) * 5 + 5 : Math.ceil(current / 5) * 5 - 5;
        next = (snapped + 60) % 60;
      }
      input.value = pad(next);
      pop(input);
      commitClock(450);
    }

    [hhInput, mmInput].forEach((input) => {
      input.addEventListener('focus', () => input.select());
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 2);
        if (input.value.length < 2) return;
        const max = input === hhInput ? 23 : 59;
        if (Number(input.value) > max) {
          input.value = String(max);
          pop(input);
        }
        commitClock(600);
        if (input === hhInput) {
          mmInput.focus();
          mmInput.select();
        }
      });
      input.addEventListener('change', () => commitClock());
      input.addEventListener('blur', () => commitClock());
      input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          nudge(input, event.key === 'ArrowUp' ? 1 : -1);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          input.blur();
        } else if (event.key === ':' && input === hhInput) {
          event.preventDefault();
          mmInput.focus();
        }
      });
      input.addEventListener('wheel', (event) => {
        if (document.activeElement !== input && !input.matches(':hover')) return;
        event.preventDefault();
        nudge(input, event.deltaY < 0 ? 1 : -1);
      }, { passive: false });
    });
    location.addEventListener('change', () => { if (task) Data.updateTaskDetails(dateKey, task.id, { location: location.value }); });
    description.addEventListener('change', () => { if (task) Data.updateTaskDetails(dateKey, task.id, { description: description.value }); });
    q('delete').addEventListener('click', () => {
      if (!task) return;
      handleDelete({ ...task });
    });
    q('phone').addEventListener('click', (event) => {
      if (!task) return;
      showPhone(event.currentTarget, dateKey, task);
    });

    const motion = createMotion({ h: 0, e: 0 }, { response: 0.42, damping: 0.78, restDelta: { h: 0.5, e: 0.002 } });
    let natural = 0;
    let shown = false;
    motion.onUpdate(({ h, e }) => {
      el.style.height = shown && h >= natural - 0.5 && e > 0.998 ? '' : `${Math.max(0, h)}px`;
      const t = clamp01(e);
      inner.style.opacity = String(t);
      inner.style.transform = t > 0.999 ? '' : `translate3d(0, ${(1 - t) * -6}px, 0)`;
      inner.style.filter = blur(t, 4);
      if (!shown && h < 0.5) el.remove();
    });

    function fill(next, nextKey) {
      task = next;
      dateKey = nextKey;
      const d = effectiveDetail(next);
      const timed = !!next.time;
      if (when.index !== (timed ? 1 : 0)) {
        quiet = true;
        when.select(timed ? 1 : 0);
        quiet = false;
      }
      showClock(timed, false);
      if (timed) writeClock(next.time);
      if (document.activeElement !== location) location.value = d.location;
      if (document.activeElement !== description) description.value = d.description;
      duration.set(d.durationChoice);
      reminder.set(d.reminderLead);
      q('duration-wrap').hidden = !next.time;
    }

    return {
      el,
      bind(next) {
        if (next) fill(next, key());
      },
      open(next, anchor) {
        anchor.after(el);
        fill(next, key());
        shown = true;
        el.style.height = 'auto';
        when.refreshGlass();
        natural = el.offsetHeight;
        if (MotionSettings.reduced) {
          motion.set({ h: natural, e: 1 });
          return;
        }
        motion.set({ h: Math.min(motion.get('h'), natural), e: motion.get('e') });
        motion.to({ h: natural }, { response: 0.46, damping: 0.72 });
        window.setTimeout(() => { if (shown) motion.to({ e: 1 }, { response: 0.34, damping: 0.8 }); }, 60);
      },
      close(instant) {
        if (!shown) return;
        shown = false;
        commitClock();
        duration.close();
        reminder.close();
        natural = el.offsetHeight;
        if (instant || MotionSettings.reduced) {
          motion.set({ h: 0, e: 0 });
          el.remove();
          return;
        }
        motion.set({ h: natural, e: motion.get('e') });
        motion.to({ e: 0 }, { response: 0.16, damping: 1 });
        window.setTimeout(() => motion.to({ h: 0 }, { response: 0.36, damping: 0.86 }), 40);
      },
    };
  }

  function expand(id) {
    const rowEl = rowList.element(id);
    const task = Data.getDayTasks(key()).find((t) => t.id === id);
    if (!rowEl || !task) return;
    if (expandedId && expandedId !== id) detail.close(true);
    expandedId = id;
    detail.open(task, rowEl);
  }

  function collapse(instant = false) {
    if (!expandedId) return;
    expandedId = null;
    detail.close(instant);
    rowList.clearSelection();
  }

  function showPhone(source, dateKey, task) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const text = calendarText([{ dateKey, task }]);
    const card = document.createElement('div');
    card.className = 'qr-card';
    card.innerHTML = `<div class="qr-card__code">${qrSvg(text)}</div><p class="qr-card__hint">用手機相機掃描，加到手機的日曆；也可以下載檔案</p>`;
    dialogs.present({
      source,
      frame: win,
      title: task.text,
      text: `${y}.${pad(m)}.${pad(d)} 週${WEEK[new Date(y, m - 1, d).getDay()]} · ${task.time || '整天'}`,
      content: card,
      width: 17,
      actions: [
        { label: '下載 .ics', className: 'btn--secondary', close: false, onClick: () => download(text, fileName(task.text, dateKey)) },
        { label: '完成', className: 'btn--primary', value: true, focus: true },
      ],
    });
  }

  const exportMotion = createMotion({ e: 0 }, { response: 0.42, damping: 0.72, restDelta: 0.002 });
  exportMotion.onUpdate(({ e }) => {
    const t = clamp01(e);
    exportBar.style.opacity = String(t);
    exportBar.style.transform = `translate3d(0, ${(1 - e) * 14}px, 0) scale(${0.94 + 0.06 * t})`;
    exportBar.style.filter = blur(t, 4);
    if (e < 0.01 && !(picking && picked.size)) exportBar.hidden = true;
  });
  const countOdo = createOdometer(exportCount, { value: 0, format: (v) => `已選 ${Math.round(v)} 筆` });

  function syncPicks() {
    rowList.ids().forEach((id) => {
      const el = rowList.element(id);
      if (el) el.classList.toggle('is-picked', picking && picked.has(id));
    });
    root.classList.toggle('is-picking', picking);
    pickButton.textContent = picking ? '完成' : '多選匯出';
    pickButton.classList.toggle('is-on', picking);
    const show = picking && picked.size > 0;
    countOdo.set(picked.size);
    if (show) {
      exportBar.hidden = false;
      exportMotion.to({ e: 1 }, spring({ response: 0.42, damping: 0.66 }));
    } else if (!exportBar.hidden) {
      exportMotion.to({ e: 0 }, { response: 0.2, damping: 1 });
    }
  }

  function togglePick(id) {
    if (picked.has(id)) picked.delete(id);
    else picked.add(id);
    syncPicks();
  }

  function stopPicking() {
    if (!picking) return;
    picking = false;
    picked.clear();
    syncPicks();
  }

  pickButton.addEventListener('click', () => {
    if (picking) {
      stopPicking();
      return;
    }
    collapse();
    picking = true;
    syncPicks();
  });
  $('export-cancel').addEventListener('click', stopPicking);
  $('export-go').addEventListener('click', () => {
    const dateKey = key();
    const tasks = Data.getDayTasks(dateKey).filter((task) => picked.has(task.id));
    if (!tasks.length) return;
    download(calendarText(tasks.map((task) => ({ dateKey, task }))), `代辦-${dateKey}-${tasks.length}筆.ics`);
    stopPicking();
  });

  const chipMotion = createMotion({ s: 0 }, { response: 0.36, damping: 0.55, restDelta: 0.002 });
  chipMotion.onUpdate(({ s }) => {
    const t = clamp01(s);
    addTime.style.opacity = String(t);
    addTime.style.transform = `scale(${0.5 + 0.5 * Math.max(0, s)})`;
    addTime.style.marginRight = `${(t - 1) * addTime.offsetWidth}px`;
    if (s < 0.01 && !addTime.dataset.on) addTime.hidden = true;
  });

  function syncAddTime() {
    const { time } = parseTask(addInput.value);
    if (time) {
      const changed = addTime.textContent !== time;
      addTime.textContent = time;
      if (!addTime.dataset.on) {
        addTime.dataset.on = '1';
        addTime.hidden = false;
        chipMotion.set({ s: 0 });
        chipMotion.to({ s: 1 }, spring({ response: 0.36, damping: 0.55 }));
      } else if (changed && !MotionSettings.reduced) {
        chipMotion.set({ s: 0.86 });
        chipMotion.to({ s: 1 }, { response: 0.3, damping: 0.5 });
      }
    } else if (addTime.dataset.on) {
      delete addTime.dataset.on;
      chipMotion.to({ s: 0 }, { response: 0.2, damping: 1 });
    }
  }

  function shake(element) {
    if (MotionSettings.reduced) return;
    const motion = createMotion({ x: 0 }, { response: 0.3, damping: 0.3, restDelta: 0.05 });
    motion.onUpdate(({ x }) => {
      element.style.transform = Math.abs(x) < 0.05 ? '' : `translate3d(${x}px, 0, 0)`;
    });
    motion.to({ x: 0 }, { velocity: { x: 520 } });
  }

  addInput.addEventListener('input', syncAddTime);
  addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const { time, text } = parseTask(addInput.value);
    if (!text) {
      shake(addForm);
      addInput.focus();
      return;
    }
    stopPicking();
    Data.addTask(key(), text, time);
    addInput.value = '';
    syncAddTime();
    addInput.focus();
  });

  function renderUpcoming(intro = false) {
    const start = today();
    upcomingEl.textContent = '';
    let count = 0;
    for (let i = 0; i < UPCOMING_DAYS; i += 1) {
      const date = addDays(start, i);
      const pending = order(Data.getDayTasks(key(date))).filter((task) => !task.done);
      if (!pending.length) continue;
      const group = document.createElement('button');
      group.type = 'button';
      group.className = 'cal-up';
      group.dataset.key = key(date);
      group.innerHTML = '<span class="cal-up__head"><span class="cal-up__rel"></span><span class="cal-up__date mono"></span></span><span class="cal-up__list"></span>';
      group.querySelector('.cal-up__rel').textContent = relative(date);
      group.querySelector('.cal-up__date').textContent = `${date.getMonth() + 1}/${date.getDate()} 週${WEEK[date.getDay()]}`;
      const list = group.querySelector('.cal-up__list');
      pending.slice(0, 3).forEach((task) => {
        const item = document.createElement('span');
        item.className = 'cal-up__item';
        item.innerHTML = '<span class="cal-up__time mono"></span><span class="cal-up__text"></span>';
        item.querySelector('.cal-up__time').textContent = task.time || '整天';
        item.querySelector('.cal-up__text').textContent = task.text;
        list.appendChild(item);
      });
      if (pending.length > 3) {
        const more = document.createElement('span');
        more.className = 'cal-up__more';
        more.textContent = `還有 ${pending.length - 3} 件`;
        list.appendChild(more);
      }
      group.classList.toggle('is-selected', sameDay(date, selected));
      upcomingEl.appendChild(group);
      if (intro && !MotionSettings.reduced) {
        const motion = createMotion({ e: 0 }, { response: 0.44, damping: 0.72, restDelta: 0.002 });
        motion.onUpdate(({ e }) => {
          const t = clamp01(e);
          group.style.opacity = t > 0.999 ? '' : String(t);
          group.style.transform = t > 0.999 ? '' : `translate3d(${(1 - e) * -10}px, 0, 0)`;
          group.style.filter = blur(t, 4);
        });
        motion.set({ e: 0 });
        window.setTimeout(() => motion.to({ e: 1 }, { response: 0.44, damping: 0.72 }), 80 + count * 45);
      }
      count += 1;
    }
    upcomingEmpty.hidden = count > 0;
  }

  upcomingEl.addEventListener('click', (event) => {
    const group = event.target.closest('.cal-up');
    if (!group) return;
    setDate(new Date(`${group.dataset.key}T00:00:00`));
  });

  function introGrid() {
    if (MotionSettings.reduced) return;
    Array.from(gridEl.children).forEach((cell, i) => {
      const row = Math.floor(i / 7);
      const col = i % 7;
      const motion = createMotion({ e: 0 }, { response: 0.46, damping: 0.68, restDelta: 0.002 });
      motion.onUpdate(({ e }) => {
        const t = clamp01(e);
        cell.style.opacity = t > 0.999 ? '' : String(t);
        cell.style.transform = t > 0.999 ? '' : `scale(${0.86 + 0.14 * e})`;
      });
      motion.set({ e: 0 });
      window.setTimeout(() => motion.to({ e: 1 }, { response: 0.46, damping: 0.68 }), 30 + (row + col) * 16);
    });
    ring.set({ o: 0 });
    window.setTimeout(() => placeRing(false), 260);
  }

  function measure() {
    const width = root.clientWidth;
    if (!width) return;
    const unit = rem();
    const nextWide = width >= WIDE_REM * unit;
    const nextRail = width >= RAIL_REM * unit;
    const changed = nextWide !== wide || nextRail !== rail;
    wide = nextWide;
    rail = nextRail;
    root.classList.toggle('is-wide', wide);
    root.classList.toggle('is-rail', rail);
    if (win) win.classList.toggle('is-rail', rail);
    const titles = showTitles();
    const titleChanged = titles !== root.classList.contains('show-titles');
    root.classList.toggle('show-titles', titles);
    if (changed || titleChanged) renderGrid();
    placeRing(false);
  }

  prevButton.addEventListener('click', () => shiftMonth(-1));
  nextButton.addEventListener('click', () => shiftMonth(1));
  todayButton.addEventListener('click', () => {
    const now = today();
    if (!sameDay(selected, now)) setDate(now);
    else if (view.getMonth() !== now.getMonth() || view.getFullYear() !== now.getFullYear()) {
      const step = (now.getFullYear() - view.getFullYear()) * 12 + now.getMonth() - view.getMonth();
      view = monthStart(now);
      shiftMonth(0, false);
      if (!MotionSettings.reduced) {
        slide.set({ e: 0, dir: Math.sign(step) });
        slide.to({ e: 1 }, { response: 0.4, damping: 0.78 });
      }
    }
  });

  Data.subscribe(() => {
    renderGrid();
    placeRing(false);
    reconcile();
    renderUpcoming();
  });

  new ResizeObserver(measure).observe(root);

  renderGrid();
  renderTag();
  renderHeader();
  reconcileQuiet();
  renderUpcoming();
  measure();

  return {
    measure,
    intro() {
      measure();
      window.setTimeout(measure, 80);
      introGrid();
      renderUpcoming(true);
      dayNum.set(selected.getDate(), { from: 0 });
    },
    show(dateKey) {
      setDate(new Date(`${dateKey}T00:00:00`));
    },
  };
}
