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

export function createLedgerApp({ root, dateTag, todayButton, host, island }) {
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
  const recurring = createToggle($('recurring'), { checked: false });

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
    const holder = document.createElement('template');
    holder.innerHTML = '<span class="lg-mark" aria-hidden="true"></span><span class="row__main"><span class="row__cat"></span><span class="row__note"></span></span><span class="row__amt mono"></span>';
    const fragment = holder.content;
    const mark = fragment.querySelector('.lg-mark');
    if (row.recurring) {
      mark.classList.add('lg-mark--recurring');
      mark.innerHTML = '<svg viewBox="0 0 12 12"><path d="M9.3 4.4A3.6 3.6 0 0 0 2.6 5M2.7 7.6a3.6 3.6 0 0 0 6.7.6M9.5 2.6v1.9H7.6M2.5 9.4V7.5h1.9" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    } else if (row.necessity) {
      mark.classList.add(`lg-mark--${row.necessity}`);
    }
    fragment.querySelector('.row__cat').textContent = row.category;
    const note = fragment.querySelector('.row__note');
    note.textContent = row.note || (row.recurring ? '固定支出' : '');
    note.hidden = !note.textContent;
    fragment.querySelector('.row__amt').textContent = `${row.type === 'income' ? '+' : '−'}${formatAmount(row.amount)}`;
    return fragment;
  }

  function desiredRows() {
    const { income, expenses } = Data.getDayEntries(key());
    const rows = [
      ...income.map((entry) => ({ ...entry, type: 'income' })),
      ...expenses.map((entry) => ({ ...entry, type: 'expense' })),
    ];
    return rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function renderHeader(rows) {
    const net = rows.reduce((sum, row) => sum + (row.type === 'income' ? row.amount : -row.amount), 0);
    dayLabelEl.textContent = `${dayLabel(date)} · ${rows.length} 筆`;
    totalSign = net > 0 ? '+' : net < 0 ? '−' : '';
    totalOdo.set(Math.abs(net));
  }

  function signature(row) {
    return JSON.stringify([row.type, row.amount, row.category, row.note, row.recurring, row.necessity]);
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
    recurring.set(!!row.recurring);
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
    if (editing) {
      Data.updateEntry(editing.dateKey, editing.type, editing.id, { type, amount, category, note, recurring: recurring.checked, necessity });
      island.celebrate({ label: `已更新 · ${category}`, amount, income });
      exitEdit();
      return;
    }
    if (income) Data.addIncomeEntry(key(), { amount, category, note });
    else Data.addExpenseEntry(key(), { amount, category, note, recurring: recurring.checked, necessity });
    const label = sameDay(date, today()) ? `已記下 · ${category}` : `已補記 · ${date.getMonth() + 1}/${date.getDate()} ${category}`;
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

  return {
    refreshGlass: () => segment.refreshGlass(),
    measure: () => segment.measure(),
  };
}
