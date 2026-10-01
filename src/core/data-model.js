import { Storage } from './storage/storage.js';
import { CURRENT_SCHEMA, createDefaultLedger, detectSchema, migrateLedger } from './migrations.js';

const SCHEMA_VERSION = CURRENT_SCHEMA;
const LEDGER_KEY = 'yoworingo.ledger';
const LEGACY_DRAFT_KEY = 'lifeledger-draft-v1';

const MIGRATION_MESSAGES = {
  INVALID_LEDGER: '這個檔案的格式不是有效的 Life Ledger 資料',
  NEWER_SCHEMA: '這份資料是用較新版本的 RingoOS 建立的，請先更新再匯入',
};

function createDefaultStore() {
  return createDefaultLedger();
}

function generateId() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

let state = createDefaultStore();
const subscribers = [];
let watching = false;

function readLegacyDraft() {
  const raw = Storage.readLegacy(LEGACY_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('RingoOS: legacy draft is not valid JSON', err);
    return null;
  }
}

function watchOtherTabs() {
  if (watching || typeof Storage.subscribe !== 'function') return;
  watching = true;
  Storage.subscribe(({ keys }) => {
    if (keys.includes(LEDGER_KEY)) reloadFromStorage();
  });
}

function reloadFromStorage() {
  const doc = Storage.get(LEDGER_KEY, null);
  if (!doc) return false;
  try {
    state = migrateLedger(doc);
  } catch (err) {
    console.warn('RingoOS: ledger from another tab could not be read', err);
    return false;
  }
  subscribers.forEach((cb) => cb(state));
  return true;
}

function hydrate() {
  watchOtherTabs();
  const stored = Storage.get(LEDGER_KEY, null);
  const source = stored ? 'storage' : 'legacy';
  const doc = stored || readLegacyDraft();
  if (!doc) {
    state = createDefaultStore();
    Storage.set(LEDGER_KEY, state);
    return 'default';
  }
  try {
    state = migrateLedger(doc);
  } catch (err) {
    console.error('RingoOS: ledger could not be migrated, starting empty', err);
    Storage.set(`ledger-unreadable-${Date.now()}`, doc);
    state = createDefaultStore();
    Storage.set(LEDGER_KEY, state);
    return 'default';
  }
  if (source === 'legacy' || detectSchema(doc) !== CURRENT_SCHEMA) Storage.set(LEDGER_KEY, state);
  return source;
}

function getState() {
  return state;
}

function subscribe(callback) {
  subscribers.push(callback);
  return function unsubscribe() {
    const idx = subscribers.indexOf(callback);
    if (idx !== -1) subscribers.splice(idx, 1);
  };
}

function notify() {
  state.meta.lastModified = new Date().toISOString();
  saveDraft(state);
  subscribers.forEach((cb) => cb(state));
}

function saveDraft(store) {
  Storage.set(LEDGER_KEY, store);
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toMonthKey(dateKey) {
  return dateKey.slice(0, 7);
}

function ensureDay(dateKey) {
  if (!state.days[dateKey]) {
    state.days[dateKey] = { income: [], expenses: [], tasks: [] };
  } else if (!state.days[dateKey].tasks) {
    state.days[dateKey].tasks = [];
  }
  return state.days[dateKey];
}

function addIncomeEntry(dateKey, { amount, category, note }) {
  const day = ensureDay(dateKey);
  day.income.push({ id: generateId(), amount, category, note: note || '', createdAt: Date.now() });
  notify();
  dispatchEntryEvent('yoworingo:entry-added', 'income');
}

function addExpenseEntry(dateKey, { amount, category, note, recurring, necessity }) {
  const day = ensureDay(dateKey);
  day.expenses.push({
    id: generateId(),
    amount,
    category,
    note: note || '',
    recurring: !!recurring,
    necessity: necessity || null,
    createdAt: Date.now(),
  });
  notify();
  dispatchEntryEvent('yoworingo:entry-added', 'expense');
}

function removeEntry(dateKey, type, entryId) {
  const day = state.days[dateKey];
  if (!day) return;
  const list = type === 'income' ? day.income : day.expenses;
  const idx = list.findIndex((e) => e.id === entryId);
  if (idx !== -1) {
    list.splice(idx, 1);
    notify();
    dispatchEntryEvent('yoworingo:entry-removed', type);
  }
}

function listFor(day, type) {
  return type === 'income' ? day.income : day.expenses;
}

function shapeEntry(type, entry) {
  const base = {
    id: entry.id,
    amount: entry.amount,
    category: entry.category,
    note: entry.note || '',
  };
  if (entry.createdAt !== undefined) base.createdAt = entry.createdAt;
  if (type === 'expense') {
    base.recurring = !!entry.recurring;
    base.necessity = entry.necessity || null;
  }
  return base;
}

function restoreEntry(dateKey, type, entry, index) {
  if (!entry || !entry.id) return false;
  const day = ensureDay(dateKey);
  const list = listFor(day, type);
  if (list.some((e) => e.id === entry.id)) return false;
  const at = Math.max(0, Math.min(Number.isInteger(index) ? index : list.length, list.length));
  list.splice(at, 0, shapeEntry(type, entry));
  notify();
  dispatchEntryEvent('yoworingo:entry-added', type);
  return true;
}

function updateEntry(dateKey, type, entryId, patch) {
  const day = state.days[dateKey];
  if (!day) return null;
  const list = listFor(day, type);
  const idx = list.findIndex((e) => e.id === entryId);
  if (idx === -1) return null;
  const nextType = patch.type === 'income' || patch.type === 'expense' ? patch.type : type;
  const merged = { ...list[idx], ...patch, id: entryId };
  const updated = shapeEntry(nextType, merged);
  if (nextType === type) {
    list[idx] = updated;
  } else {
    list.splice(idx, 1);
    listFor(day, nextType).push(updated);
  }
  notify();
  return { type: nextType, entry: updated };
}

function getEntryIndex(dateKey, type, entryId) {
  const day = state.days[dateKey];
  if (!day) return -1;
  return listFor(day, type).findIndex((e) => e.id === entryId);
}

function dispatchEntryEvent(eventName, entryType) {
  try {
    window.dispatchEvent(new CustomEvent(eventName, { detail: { entryType } }));
  } catch (err) {}
}

function getDayEntries(dateKey) {
  return state.days[dateKey] || { income: [], expenses: [], tasks: [] };
}

function setMonthlyBudget(monthKey, category, amount) {
  if (!state.settings.monthlyBudgets[monthKey]) {
    state.settings.monthlyBudgets[monthKey] = {};
  }
  state.settings.monthlyBudgets[monthKey][category] = amount;
  notify();
}

function getMonthlyBudgets(monthKey) {
  return state.settings.monthlyBudgets[monthKey] || {};
}

function addSavingsGoal({ title, targetAmount, deadline }) {
  state.settings.savingsGoals.push({
    id: generateId(),
    title,
    targetAmount,
    currentAmount: 0,
    deadline: deadline || null,
    autoSavePercent: null,
    lastAutoSaveMonth: null,
    deposits: [],
  });
  notify();
}

function updateSavingsGoalAmount(goalId, currentAmount) {
  const goal = state.settings.savingsGoals.find((g) => g.id === goalId);
  if (goal) {
    goal.currentAmount = currentAmount;
    notify();
  }
}

function depositToGoal(goalId, amount) {
  const goal = state.settings.savingsGoals.find((g) => g.id === goalId);
  if (!goal || !amount || amount <= 0) return;
  goal.currentAmount += amount;
  if (!goal.deposits) goal.deposits = [];
  goal.deposits.push({ date: new Date().toISOString(), amount, type: 'manual', monthKey: null });
  notify();
  dispatchEntryEvent('yoworingo:goal-deposit', 'manual');
}

function setGoalAutoSavePercent(goalId, percent) {
  const goal = state.settings.savingsGoals.find((g) => g.id === goalId);
  if (!goal) return;
  goal.autoSavePercent = percent > 0 ? percent : null;
  notify();
}

function applyMonthlyAutoSavings(monthKey, netAmount) {
  let changed = false;
  let deposited = false;
  state.settings.savingsGoals.forEach((goal) => {
    if (!goal.autoSavePercent) return;
    if (goal.lastAutoSaveMonth === monthKey) return;

    if (netAmount > 0) {
      const amount = Math.round((netAmount * goal.autoSavePercent) / 100);
      if (amount > 0) {
        goal.currentAmount += amount;
        if (!goal.deposits) goal.deposits = [];
        goal.deposits.push({ date: new Date().toISOString(), amount, type: 'auto', monthKey });
        deposited = true;
      }
    }
    goal.lastAutoSaveMonth = monthKey;
    changed = true;
  });
  if (changed) notify();
  if (deposited) dispatchEntryEvent('yoworingo:goal-deposit', 'auto');
}

function removeSavingsGoal(goalId) {
  const idx = state.settings.savingsGoals.findIndex((g) => g.id === goalId);
  if (idx !== -1) {
    state.settings.savingsGoals.splice(idx, 1);
    notify();
  }
}

function getDayTasks(dateKey) {
  const day = state.days[dateKey];
  return (day && day.tasks) || [];
}

function addTask(dateKey, text, time) {
  const trimmed = (text || '').trim();
  if (!trimmed) return;
  const day = ensureDay(dateKey);
  const task = { id: generateId(), text: trimmed, done: false, time: time || null, createdAt: Date.now() };
  day.tasks.push(task);
  notify();
  return task.id;
}

function getTaskIndex(dateKey, taskId) {
  return getDayTasks(dateKey).findIndex((t) => t.id === taskId);
}

function restoreTask(dateKey, task, index) {
  if (!task || !task.id) return false;
  const day = ensureDay(dateKey);
  if (day.tasks.some((t) => t.id === task.id)) return false;
  const at = Math.max(0, Math.min(day.tasks.length, Number.isInteger(index) ? index : day.tasks.length));
  day.tasks.splice(at, 0, { ...task });
  notify();
  return true;
}

function setTaskTime(dateKey, taskId, time) {
  const day = state.days[dateKey];
  if (!day || !day.tasks) return;
  const task = day.tasks.find((t) => t.id === taskId);
  if (task) {
    task.time = time || null;
    notify();
  }
}

function updateTaskDetails(dateKey, taskId, patch) {
  const day = state.days[dateKey];
  if (!day || !day.tasks) return;
  const task = day.tasks.find((t) => t.id === taskId);
  if (!task) return;
  Object.assign(task, patch);
  notify();
}

function toggleTask(dateKey, taskId) {
  const day = state.days[dateKey];
  if (!day || !day.tasks) return;
  const task = day.tasks.find((t) => t.id === taskId);
  if (task) {
    task.done = !task.done;
    notify();
  }
}

function removeTask(dateKey, taskId) {
  const day = state.days[dateKey];
  if (!day || !day.tasks) return;
  const idx = day.tasks.findIndex((t) => t.id === taskId);
  if (idx !== -1) {
    day.tasks.splice(idx, 1);
    notify();
  }
}

function getDayIndicators(dateKey) {
  const day = state.days[dateKey];
  if (!day) return { hasMoney: false, taskTotal: 0, taskDone: 0 };
  const hasMoney = (day.income && day.income.length > 0) || (day.expenses && day.expenses.length > 0);
  const tasks = day.tasks || [];
  return { hasMoney, taskTotal: tasks.length, taskDone: tasks.filter((t) => t.done).length };
}

function getTaskReminderLookaheadDays() {
  const value = state.settings.taskReminderLookaheadDays;
  return typeof value === 'number' ? value : 1;
}

function setTaskReminderLookaheadDays(days) {
  state.settings.taskReminderLookaheadDays = Math.max(0, Math.min(7, Number(days) || 0));
  notify();
}

const FALLBACK_CATEGORY = { income: '其他收入', expense: '其他' };

function addCategory(type, name) {
  const list = type === 'income' ? state.settings.incomeCategories : state.settings.expenseCategories;
  if (!list.includes(name)) {
    list.push(name);
    notify();
  }
}

function countEntriesUsingCategory(type, category) {
  let count = 0;
  Object.values(state.days).forEach((day) => {
    const list = type === 'income' ? day.income : day.expenses;
    list.forEach((entry) => {
      if (entry.category === category) count += 1;
    });
  });
  return count;
}

function removeCategory(type, category) {
  const fallback = FALLBACK_CATEGORY[type];
  if (category === fallback) {
    return { ok: false, reason: 'fallback' };
  }

  const list = type === 'income' ? state.settings.incomeCategories : state.settings.expenseCategories;
  const idx = list.indexOf(category);
  if (idx === -1) {
    return { ok: false, reason: 'not-found' };
  }

  Object.values(state.days).forEach((day) => {
    const entryList = type === 'income' ? day.income : day.expenses;
    entryList.forEach((entry) => {
      if (entry.category === category) entry.category = fallback;
    });
  });

  Object.values(state.settings.monthlyBudgets).forEach((monthBudgets) => {
    delete monthBudgets[category];
  });

  list.splice(idx, 1);
  notify();
  return { ok: true };
}

function replaceStore(newStore) {
  try {
    state = migrateLedger(newStore);
  } catch (err) {
    throw new Error(MIGRATION_MESSAGES[err.message] || MIGRATION_MESSAGES.INVALID_LEDGER);
  }
  notify();
}

export const Data = {
  SCHEMA_VERSION,
  hydrate,
  reloadFromStorage,
  createDefaultStore,
  generateId,
  getState,
  subscribe,
  notify,
  toDateKey,
  toMonthKey,
  ensureDay,
  addIncomeEntry,
  addExpenseEntry,
  removeEntry,
  restoreEntry,
  updateEntry,
  getEntryIndex,
  getDayEntries,
  getDayTasks,
  addTask,
  getTaskIndex,
  restoreTask,
  setTaskTime,
  updateTaskDetails,
  toggleTask,
  removeTask,
  getDayIndicators,
  getTaskReminderLookaheadDays,
  setTaskReminderLookaheadDays,
  setMonthlyBudget,
  getMonthlyBudgets,
  addSavingsGoal,
  updateSavingsGoalAmount,
  depositToGoal,
  setGoalAutoSavePercent,
  applyMonthlyAutoSavings,
  removeSavingsGoal,
  addCategory,
  removeCategory,
  countEntriesUsingCategory,
  replaceStore,
};
