import { createMotion } from '../../motion/animator.js';
import { MotionSettings } from '../../motion/presets.js';
import { Data } from '../../core/data-model.js';
import { createSegmented } from '../../ui/segmented.js';
import { createToggle } from '../../ui/controls.js';
import { createRowList } from '../../ui/rows.js';
import { createStage } from '../../ui/stage.js';
import { createMonthGrid } from '../../ui/month-grid.js';
import { createDatePicker } from '../../ui/datepicker.js';
import { createOdometer, formatAmount } from '../../ui/odometer.js';
import { Fx } from '../../ui/fx-tier.js';
import { renderEntryRow } from './row-view.js';
import { createLedgerFind } from './ledger-find.js';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const WEEK_TAG = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const TYPES = ['expense', 'income'];

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

function dayLabel(date) {
  const diff = Math.round((today() - date) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  return `${date.getMonth() + 1}/${date.getDate()}（${WEEK[date.getDay()]}）`;
}

function parseAmount(text) {
  const cleaned = String(text).replace(/[^\d.]/g, '');
  const value = parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : 0;
}

export function createLedgerApp({ root, dateTag, todayButton, findButton, host, island, isActive = () => false }) {
  const $ = (name) => root.querySelector(`[data-ledger="${name}"]`);
  const form = $('form');
  const amountInput = $('amount');
  const amountBox = amountInput.closest('.amount');
  const chips = $('chips');
  const noteInput = $('note');
  const extras = $('extras');
  const needGroup = $('necessity');
  const submit = $('submit');
  const cancel = $('cancel');
  const stageEl = $('stage');
  const listEl = $('rows');
  const dayLabelEl = $('day-label');
  const totalEl = $('day-total');

  let date = today();
  let type = 'expense';
  const pickedCategory = { expense: null, income: null };
  let necessity = null;
  let editing = null;
  const restoring = new Set();
  const lastSeen = new Map();
  let totalSign = '';

  const totalOdo = createOdometer(totalEl, { value: 0, format: (value) => `${totalSign}NT$ ${formatAmount(value)}` });
  const stage = createStage(stageEl, { initial: 'rows' });
  const dayBox = $('day');
  const dayInput = $('day-input');
  const dayReveal = createMotion({ v: 0 }, { response: 0.42, damping: 0.62, restDelta: 0.002 });
  dayReveal.onUpdate(({ v }) => {
    const t = Math.max(0, Math.min(1, v));
    dayBox.style.opacity = String(t);
    dayBox.style.transform = t > 0.999 && v <= 1.001 ? '' : `translate3d(${((1 - t) * -8).toFixed(2)}px, 0, 0) scale(${(0.86 + 0.14 * v).toFixed(4)})`;
    dayBox.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 4).toFixed(2)}px)` : '';
  });

  function defaultDay() {
    return date.getDate();
  }

  function readDay() {
    const value = parseInt(dayInput.value, 10);
    return Number.isFinite(value) ? Math.min(31, Math.max(1, value)) : defaultDay();
  }

  function showDay(on, { instant = false } = {}) {
    if (on) {
      if (!dayInput.value) dayInput.value = String(defaultDay());
      if (dayBox.hidden) {
        dayBox.hidden = false;
        if (instant || MotionSettings.reduced) dayReveal.set({ v: 1 });
        else {
          dayReveal.set({ v: 0 });
          dayReveal.to({ v: 1 }, { response: 0.42, damping: 0.62 });
        }
      }
      return;
    }
    if (dayBox.hidden) return;
    if (instant || MotionSettings.reduced) {
      dayReveal.set({ v: 0 });
      dayBox.hidden = true;
      return;
    }
    dayReveal.to({ v: 0 }, { response: 0.2, damping: 1 }).then((done) => {
      if (done) dayBox.hidden = true;
    });
  }

  function nudgeDay(delta) {
    let value = readDay() + delta;
    if (value > 31) value = 1;
    if (value < 1) value = 31;
    dayInput.value = String(value);
  }

  dayInput.addEventListener('input', () => {
    const digits = dayInput.value.replace(/\D/g, '').slice(0, 2);
    dayInput.value = digits;
    if (Number(digits) > 31) dayInput.value = '31';
  });
  dayInput.addEventListener('blur', () => {
    dayInput.value = String(readDay());
  });
  dayInput.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      nudgeDay(event.key === 'ArrowUp' ? 1 : -1);
    }
  });
  dayInput.addEventListener('wheel', (event) => {
    if (document.activeElement !== dayInput) return;
    event.preventDefault();
    nudgeDay(event.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  const recurring = createToggle($('recurring'), { checked: false, onChange: (on) => showDay(on) });

  const segment = createSegmented($('type'), {
    onChange(index) {
      type = TYPES[index];
      renderChips();
      syncExtras();
    },
  });

  const swap = createMotion({ e: 1, dir: 1 }, { response: 0.36, damping: 0.8, restDelta: { e: 0.002, dir: 0.01 } });
  swap.onUpdate(({ e, dir }) => {
    const t = Math.max(0, Math.min(1, e));
    listEl.style.opacity = t > 0.999 ? '' : String(t);
    listEl.style.transform = t > 0.999 ? '' : `translate3d(${(1 - t) * 18 * dir}px, 0, 0)`;
    listEl.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 3).toFixed(2)}px)` : '';
  });

  function key() {
    return Data.toDateKey(date);
  }

  function categories(kind) {
    const settings = Data.getState().settings;
    return kind === 'income' ? settings.incomeCategories : settings.expenseCategories;
  }

  function currentCategory() {
    const list = categories(type);
    const picked = pickedCategory[type];
    return list.includes(picked) ? picked : list[0];
  }

  function popChip(chip) {
    if (MotionSettings.reduced || !chip) return;
    const motion = createMotion({ s: 0.9 }, { response: 0.36, damping: 0.4, restDelta: 0.0005 });
    motion.onUpdate(({ s }) => {
      chip.style.transform = Math.abs(s - 1) < 0.0005 ? '' : `scale(${s})`;
    });
    motion.to({ s: 1 }, { response: 0.36, damping: 0.4, velocity: { s: 2.4 } });
  }

  function renderChips() {
    const selected = currentCategory();
    chips.textContent = '';
    categories(type).forEach((name) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.setAttribute('role', 'radio');
      chip.setAttribute('aria-checked', String(name === selected));
      chip.dataset.category = name;
      chip.textContent = name;
      chips.appendChild(chip);
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'chip chip--add';
    add.dataset.add = '1';
    add.setAttribute('aria-label', '新增分類');
    add.textContent = '＋ 分類';
    chips.appendChild(add);
  }

  function startAddCategory(button) {
    const wrap = document.createElement('span');
    wrap.className = 'chip chip--input';
    const input = document.createElement('input');
    input.className = 'chip__input';
    input.maxLength = 12;
    input.placeholder = '新分類';
    input.setAttribute('aria-label', '新分類名稱');
    wrap.appendChild(input);
    button.replaceWith(wrap);
    popChip(wrap);
    input.focus();
    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      const name = input.value.trim();
      if (commit && name) {
        Data.addCategory(type, name);
        pickedCategory[type] = name;
      }
      renderChips();
      if (commit && name) popChip(chips.querySelector(`[data-category="${CSS.escape(name)}"]`));
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finish(true);
        amountInput.focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    });
    input.addEventListener('blur', () => finish(true));
  }

  chips.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip || chip.classList.contains('chip--input')) return;
    if (chip.dataset.add) {
      startAddCategory(chip);
      return;
    }
    pickedCategory[type] = chip.dataset.category;
    chips.querySelectorAll('[data-category]').forEach((other) => other.setAttribute('aria-checked', String(other === chip)));
    popChip(chip);
  });

  function syncNecessity() {
    needGroup.querySelectorAll('[data-value]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.value === necessity));
    });
  }

  needGroup.addEventListener('click', (event) => {
    const button = event.target.closest('[data-value]');
    if (!button) return;
    necessity = necessity === button.dataset.value ? null : button.dataset.value;
    syncNecessity();
    popChip(button);
  });

  function syncExtras() {
    extras.hidden = type !== 'expense';
  }

  function renderRow(row) {
    return renderEntryRow(row);
  }

  function desiredRows() {
    const { income, expenses } = Data.getDayEntries(key());
    const transfers = Data.getTransfers([key()]).map((t) => ({
      id: t.id,
      type: 'transfer',
      transferType: t.type,
      amount: t.amount,
      signed: t.signed,
      goalId: t.goalId,
      goalTitle: t.goalTitle,
      createdAt: Date.parse(t.date) || 0,
    }));
    const rows = [
      ...income.map((entry) => ({ ...entry, type: 'income' })),
      ...expenses.map((entry) => ({ ...entry, type: 'expense' })),
      ...transfers,
    ];
    return rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function renderHeader(rows) {
    const net = rows.reduce((sum, row) => sum + (row.type === 'income' ? row.amount : row.type === 'expense' ? -row.amount : 0), 0);
    dayLabelEl.textContent = `${dayLabel(date)} · ${rows.length} 筆`;
    totalSign = net > 0 ? '+' : net < 0 ? '−' : '';
    totalOdo.set(Math.abs(net));
  }

  function signature(row) {
    return JSON.stringify([row.type, row.amount, row.category, row.note, row.recurring, row.necessity, row.goalTitle, row.signed]);
  }

  function reconcile() {
    const rows = desiredRows();
    const ids = new Set(rows.map((row) => row.id));
    rowList.ids().forEach((id) => {
      if (!ids.has(id)) rowList.removeId(id);
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
    stage.show(rows.length ? 'rows' : 'empty');
    renderHeader(rows);
  }

  function handleDelete(row) {
    const dateKey = key();
    if (row.type === 'transfer') {
      const snapshot = Data.removeGoalTransfer(row.goalId, row.id);
      lastSeen.delete(row.id);
      if (!snapshot) return;
      if (snapshot.blocked) {
        restoring.add(row.id);
        reconcile();
        island.toast({ text: '要先取消後來的取出', duration: 3200 });
        return;
      }
      island.toast({
        text: `${row.signed < 0 ? '已取消取出' : '已取消存入'} · ${row.goalTitle}`,
        amount: row.amount,
        income: row.signed < 0,
        action: '復原',
        onAction() {
          restoring.add(row.id);
          Data.restoreGoalTransfer(snapshot);
        },
      });
      return;
    }
    const index = Data.getEntryIndex(dateKey, row.type, row.id);
    if (index < 0) return;
    const entry = Data.getDayEntries(dateKey)[row.type === 'income' ? 'income' : 'expenses'][index];
    if (editing && editing.id === row.id) exitEdit();
    Data.removeEntry(dateKey, row.type, row.id);
    lastSeen.delete(row.id);
    island.toast({
      text: `已刪除 · ${row.category}`,
      amount: row.amount,
      income: row.type === 'income',
      action: '復原',
      onAction() {
        restoring.add(row.id);
        Data.restoreEntry(dateKey, row.type, entry, index);
      },
    });
  }

  const rowList = createRowList(listEl, {
    render: renderRow,
    onDelete: handleDelete,
    onSelect(row) {
      if (row && row.type === 'transfer') {
        if (editing) exitEdit({ keepSelection: true });
        return;
      }
      if (row) enterEdit(row);
      else if (editing) exitEdit({ keepSelection: true });
    },
  });

  function resetForm() {
    amountInput.value = '';
    noteInput.value = '';
    necessity = null;
    syncNecessity();
    recurring.set(false);
    showDay(false, { instant: true });
    dayInput.value = '';
  }

  function enterEdit(row) {
    editing = { dateKey: key(), type: row.type, id: row.id };
    root.classList.add('is-editing');
    if (type !== row.type) segment.select(TYPES.indexOf(row.type));
    type = row.type;
    pickedCategory[type] = row.category;
    renderChips();
    syncExtras();
    amountInput.value = String(row.amount);
    noteInput.value = row.note || '';
    necessity = row.necessity || null;
    syncNecessity();
    const template = row.recurringId ? Data.getRecurringTemplate(row.recurringId) : null;
    dayInput.value = template ? String(template.day) : '';
    editing.recurringId = template ? template.id : null;
    recurring.set(!!row.recurring);
    showDay(!!row.recurring, { instant: true });
    submit.textContent = '更新這筆';
    cancel.hidden = false;
  }

  function exitEdit({ keepSelection = false } = {}) {
    if (!editing) return;
    editing = null;
    root.classList.remove('is-editing');
    submit.textContent = '記下這筆';
    cancel.hidden = true;
    resetForm();
    if (!keepSelection) rowList.clearSelection();
  }

  function adoptAsTemplate(dateKey, entryId, { amount, category, note, necessity: need, day }) {
    Data.addRecurring({
      name: note || category,
      amount,
      category,
      day,
      necessity: need,
      postedEntry: { monthKey: Data.toMonthKey(dateKey), dateKey, entryId },
    });
  }

  function shake(element) {
    if (MotionSettings.reduced) return;
    const motion = createMotion({ x: 0 }, { response: 0.3, damping: 0.3, restDelta: 0.05 });
    motion.onUpdate(({ x }) => {
      element.style.transform = Math.abs(x) < 0.05 ? '' : `translate3d(${x}px, 0, 0)`;
    });
    motion.to({ x: 0 }, { velocity: { x: 600 } });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const amount = parseAmount(amountInput.value);
    if (!amount) {
      shake(amountBox);
      amountInput.focus();
      return;
    }
    const category = currentCategory();
    const note = noteInput.value.trim();
    const income = type === 'income';
    const fixed = !income && recurring.checked;
    const day = readDay();
    if (editing) {
      const linked = editing.recurringId;
      Data.updateEntry(editing.dateKey, editing.type, editing.id, { type, amount, category, note, recurring: fixed, necessity, recurringId: fixed ? linked : null });
      if (fixed && linked) Data.updateRecurring(linked, { day, amount, category, name: note || category, necessity });
      else if (fixed) adoptAsTemplate(editing.dateKey, editing.id, { amount, category, note, necessity, day });
      island.celebrate({ label: fixed && !linked ? `已更新 · 每月 ${day} 號固定支出` : `已更新 · ${category}`, amount, income });
      exitEdit();
      return;
    }
    if (income) Data.addIncomeEntry(key(), { amount, category, note });
    else {
      const entryId = Data.addExpenseEntry(key(), { amount, category, note, recurring: fixed, necessity });
      if (fixed) adoptAsTemplate(key(), entryId, { amount, category, note, necessity, day });
    }
    let label = sameDay(date, today()) ? `已記下 · ${category}` : `已補記 · ${date.getMonth() + 1}/${date.getDate()} ${category}`;
    if (fixed) label = `已記下 · 每月 ${day} 號自動入帳`;
    island.celebrate({ label, amount, income });
    resetForm();
    amountInput.focus();
  });

  cancel.addEventListener('click', () => exitEdit());

  let tagSwap = null;
  let todayPop = null;

  function renderTag() {
    const text = `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${WEEK_TAG[date.getDay()]}`;
    const past = !sameDay(date, today());
    dateTag.classList.toggle('is-past', past);
    if (!tagSwap) {
      tagSwap = createMotion({ e: 1 }, { response: 0.3, damping: 1, restDelta: 0.002 });
      tagSwap.onUpdate(({ e }) => {
        const t = Math.max(0, Math.min(1, e));
        dateTag.style.opacity = t > 0.999 ? '' : String(t);
        dateTag.style.filter = t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * 3).toFixed(2)}px)` : '';
      });
    }
    if (!dateTag.textContent || MotionSettings.reduced) {
      dateTag.textContent = text;
    } else if (dateTag.textContent !== text) {
      tagSwap.to({ e: 0 }, { response: 0.14, damping: 1 }).then(() => {
        dateTag.textContent = text;
        tagSwap.to({ e: 1 }, { response: 0.34, damping: 0.8 });
      });
    }
    if (!todayPop) {
      todayPop = createMotion({ s: 0 }, { response: 0.36, damping: 0.55, restDelta: 0.002 });
      todayPop.onUpdate(({ s }) => {
        const t = Math.max(0, s);
        todayButton.style.opacity = String(Math.min(1, t));
        todayButton.style.transform = `scale(${0.6 + 0.4 * t})`;
        if (t < 0.01 && sameDay(date, today())) todayButton.hidden = true;
      });
    }
    if (past) {
      todayButton.hidden = false;
      todayPop.to({ s: 1 }, MotionSettings.reduced ? MotionSettings.spring('focus') : { response: 0.36, damping: 0.55 });
    } else if (!todayButton.hidden) {
      todayPop.to({ s: 0 }, { response: 0.2, damping: 1 });
    }
  }

  function setDate(next, source) {
    const target = startOfDay(next);
    if (sameDay(target, date)) return;
    const dir = target > date ? 1 : -1;
    date = target;
    exitEdit();
    if (source !== 'grid') grid.set(date);
    if (source !== 'picker') picker.set(date);
    renderTag();
    lastSeen.clear();
    rowList.reset([]);
    reconcileQuiet();
    if (!MotionSettings.reduced) {
      swap.set({ e: 0, dir });
      swap.to({ e: 1 }, { response: 0.36, damping: 0.8 });
    }
  }

  function reconcileQuiet() {
    const rows = desiredRows();
    rowList.reset(rows);
    rows.forEach((row) => lastSeen.set(row.id, signature(row)));
    stage.show(rows.length ? 'rows' : 'empty');
    renderHeader(rows);
  }

  const grid = createMonthGrid($('calendar'), {
    value: date,
    marks: (day) => Data.getDayIndicators(Data.toDateKey(day)).hasMoney,
    onSelect: (day) => setDate(day, 'grid'),
  });

  const picker = createDatePicker({
    trigger: dateTag,
    host,
    value: date,
    onChange: (day) => setDate(day, 'picker'),
  });

  todayButton.addEventListener('click', () => setDate(today(), 'button'));

  Data.subscribe(() => {
    reconcile();
    grid.refresh();
  });

  renderChips();
  syncExtras();
  syncNecessity();
  renderTag();
  reconcileQuiet();

  const finder = findButton ? createLedgerFind({
    ledgerRoot: root,
    button: findButton,
    host,
    island,
    onToggle(on) {
      if (on) exitEdit();
      dateTag.closest('.date-pick').classList.toggle('is-finding', on);
    },
  }) : null;

  window.addEventListener('keydown', (event) => {
    if (!finder || !isActive()) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      finder.open();
    }
  });

  return {
    refreshGlass: () => segment.refreshGlass(),
    measure: () => segment.measure(),
    find: (filters) => finder && finder.open(filters),
    closeFind: () => finder && finder.close(),
  };
}
