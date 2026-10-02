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

function buildExpense({ amount, category, note, recurring, necessity, recurringId }) {
  const entry = {
    id: generateId(),
    amount,
    category,
    note: note || '',
    recurring: !!recurring,
    necessity: necessity || null,
    createdAt: Date.now(),
  };
  if (recurringId) entry.recurringId = recurringId;
  return entry;
}

function addExpenseEntry(dateKey, fields) {
  const day = ensureDay(dateKey);
  const entry = buildExpense(fields);
  day.expenses.push(entry);
  notify();
  dispatchEntryEvent('yoworingo:entry-added', 'expense');
  return entry.id;
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
    if (entry.recurringId) base.recurringId = entry.recurringId;
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

function moveEntry(fromDateKey, type, entryId, toDateKey, patch = {}) {
  if (fromDateKey === toDateKey) return updateEntry(fromDateKey, type, entryId, patch);
  const day = state.days[fromDateKey];
  if (!day) return null;
  const list = listFor(day, type);
  const idx = list.findIndex((e) => e.id === entryId);
  if (idx === -1) return null;
  const [entry] = list.splice(idx, 1);
  const nextType = patch.type === 'income' || patch.type === 'expense' ? patch.type : type;
  const updated = shapeEntry(nextType, { ...entry, ...patch, id: entryId });
  listFor(ensureDay(toDateKey), nextType).push(updated);
  notify();
  return { type: nextType, entry: updated, dateKey: toDateKey };
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

function plans() {
  if (!Array.isArray(state.settings.budgetPlans)) state.settings.budgetPlans = [];
  return state.settings.budgetPlans;
}

function planFor(monthKey) {
  let found = null;
  plans().forEach((plan) => {
    if (plan.since <= monthKey && (!found || plan.since > found.since)) found = plan;
  });
  return found;
}

function getBudgetPlan(monthKey) {
  const plan = planFor(monthKey);
  return plan ? { ...plan.amounts } : {};
}

function getBudgetOverrides(monthKey) {
  return { ...(state.settings.monthlyBudgets[monthKey] || {}) };
}

function getMonthlyBudgets(monthKey) {
  const merged = { ...getBudgetPlan(monthKey), ...getBudgetOverrides(monthKey) };
  const out = {};
  Object.entries(merged).forEach(([category, amount]) => {
    if (Number(amount) > 0) out[category] = Number(amount);
  });
  return out;
}

function isMonthAdjusted(monthKey) {
  return !!planFor(monthKey) && Object.keys(getBudgetOverrides(monthKey)).length > 0;
}

function setMonthlyBudget(monthKey, category, amount) {
  const value = Math.max(0, Number(amount) || 0);
  const planValue = getBudgetPlan(monthKey)[category] || 0;
  const overrides = state.settings.monthlyBudgets[monthKey] || {};
  if (value === planValue) delete overrides[category];
  else overrides[category] = value;
  if (Object.keys(overrides).length) state.settings.monthlyBudgets[monthKey] = overrides;
  else delete state.settings.monthlyBudgets[monthKey];
  notify();
}

function setBudgetTemplate(category, amount, fromMonthKey) {
  const from = fromMonthKey || toMonthKey(toDateKey(new Date()));
  const value = Math.max(0, Number(amount) || 0);
  let plan = plans().find((p) => p.since === from);
  if (!plan) {
    plan = { since: from, amounts: getBudgetPlan(from) };
    plans().push(plan);
    plans().sort((a, b) => a.since.localeCompare(b.since));
  }
  if (value > 0) plan.amounts[category] = value;
  else delete plan.amounts[category];
  Object.entries(state.settings.monthlyBudgets).forEach(([monthKey, overrides]) => {
    if (monthKey < from || !(category in overrides)) return;
    delete overrides[category];
    if (!Object.keys(overrides).length) delete state.settings.monthlyBudgets[monthKey];
  });
  notify();
}

function resetMonthToTemplate(monthKey) {
  if (!state.settings.monthlyBudgets[monthKey]) return false;
  delete state.settings.monthlyBudgets[monthKey];
  notify();
  return true;
}

function addSavingsGoal({ title, targetAmount, deadline }) {
  const id = generateId();
  state.settings.savingsGoals.push({
    id,
    title,
    targetAmount,
    currentAmount: 0,
    deadline: deadline || null,
    autoSavePercent: null,
    lastAutoSaveMonth: null,
    deposits: [],
  });
  notify();
  return id;
}

function updateSavingsGoalAmount(goalId, currentAmount) {
  const goal = state.settings.savingsGoals.find((g) => g.id === goalId);
  if (goal) {
    goal.currentAmount = currentAmount;
    notify();
  }
}

function findGoal(goalId) {
  return state.settings.savingsGoals.find((g) => g.id === goalId) || null;
}

function transferSign(transfer) {
  return transfer.type === 'withdraw' ? -1 : 1;
}

function pushTransfer(goal, { amount, type, dateKey, monthKey = null }) {
  if (!goal.deposits) goal.deposits = [];
  const transfer = { id: generateId(), date: new Date().toISOString(), dateKey: dateKey || toDateKey(new Date()), amount, type, monthKey };
  goal.deposits.push(transfer);
  goal.currentAmount += transferSign(transfer) * amount;
  return transfer;
}

function depositToGoal(goalId, amount, { dateKey } = {}) {
  const goal = findGoal(goalId);
  if (!goal || !amount || amount <= 0) return null;
  const transfer = pushTransfer(goal, { amount, type: 'manual', dateKey });
  notify();
  dispatchEntryEvent('yoworingo:goal-deposit', 'manual');
  return transfer.id;
}

function withdrawFromGoal(goalId, amount, { dateKey } = {}) {
  const goal = findGoal(goalId);
  if (!goal || !amount || amount <= 0 || amount > goal.currentAmount) return null;
  const transfer = pushTransfer(goal, { amount, type: 'withdraw', dateKey });
  notify();
  dispatchEntryEvent('yoworingo:goal-withdraw', 'withdraw');
  return transfer.id;
}

function getTransfers(dateKeys) {
  const wanted = dateKeys ? new Set(dateKeys) : null;
  const out = [];
  state.settings.savingsGoals.forEach((goal) => {
    (goal.deposits || []).forEach((transfer, index) => {
      if (wanted && !wanted.has(transfer.dateKey)) return;
      out.push({ ...transfer, goalId: goal.id, goalTitle: goal.title, index, signed: transferSign(transfer) * transfer.amount });
    });
  });
  return out;
}

function removeGoalTransfer(goalId, transferId) {
  const goal = findGoal(goalId);
  if (!goal || !goal.deposits) return null;
  const index = goal.deposits.findIndex((t) => t.id === transferId);
  if (index === -1) return null;
  const candidate = goal.deposits[index];
  if (goal.currentAmount - transferSign(candidate) * candidate.amount < 0) return { blocked: true, goalId, transferId };
  const [transfer] = goal.deposits.splice(index, 1);
  goal.currentAmount -= transferSign(transfer) * transfer.amount;
  notify();
  return { goalId, transfer, index };
}

function restoreGoalTransfer(snapshot) {
  if (!snapshot) return false;
  const goal = findGoal(snapshot.goalId);
  if (!goal) return false;
  if (!goal.deposits) goal.deposits = [];
  if (goal.deposits.some((t) => t.id === snapshot.transfer.id)) return false;
  goal.deposits.splice(Math.max(0, Math.min(goal.deposits.length, snapshot.index)), 0, { ...snapshot.transfer });
  goal.currentAmount += transferSign(snapshot.transfer) * snapshot.transfer.amount;
  notify();
  return true;
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
        pushTransfer(goal, { amount, type: 'auto', monthKey });
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

function categoryList(type) {
  return type === 'income' ? state.settings.incomeCategories : state.settings.expenseCategories;
}

function removeCategory(type, category) {
  const fallback = FALLBACK_CATEGORY[type];
  if (category === fallback) {
    return { ok: false, reason: 'fallback' };
  }

  const list = categoryList(type);
  const idx = list.indexOf(category);
  if (idx === -1) {
    return { ok: false, reason: 'not-found' };
  }

  const moved = [];
  Object.entries(state.days).forEach(([dateKey, day]) => {
    const entryList = type === 'income' ? day.income : day.expenses;
    entryList.forEach((entry) => {
      if (entry.category === category) {
        entry.category = fallback;
        moved.push({ dateKey, id: entry.id });
      }
    });
  });

  const budgets = {};
  const planBudgets = {};
  const recurringMoved = [];
  if (type === 'expense') {
    Object.entries(state.settings.monthlyBudgets).forEach(([monthKey, monthBudgets]) => {
      if (category in monthBudgets) {
        budgets[monthKey] = monthBudgets[category];
        delete monthBudgets[category];
      }
    });
    plans().forEach((plan) => {
      if (category in plan.amounts) {
        planBudgets[plan.since] = plan.amounts[category];
        delete plan.amounts[category];
      }
    });
    recurringList().forEach((t) => {
      if (t.category === category) {
        t.category = fallback;
        recurringMoved.push(t.id);
      }
    });
  }

  list.splice(idx, 1);
  notify();
  return { ok: true, snapshot: { type, name: category, index: idx, moved, budgets, planBudgets, recurringMoved } };
}

function restoreCategory(snapshot) {
  if (!snapshot) return false;
  const list = categoryList(snapshot.type);
  if (list.includes(snapshot.name)) return false;
  list.splice(Math.max(0, Math.min(list.length, snapshot.index)), 0, snapshot.name);
  const fallback = FALLBACK_CATEGORY[snapshot.type];
  snapshot.moved.forEach(({ dateKey, id }) => {
    const day = state.days[dateKey];
    if (!day) return;
    const entryList = snapshot.type === 'income' ? day.income : day.expenses;
    const entry = entryList.find((item) => item.id === id);
    if (entry && entry.category === fallback) entry.category = snapshot.name;
  });
  Object.entries(snapshot.budgets || {}).forEach(([monthKey, amount]) => {
    if (!state.settings.monthlyBudgets[monthKey]) state.settings.monthlyBudgets[monthKey] = {};
    state.settings.monthlyBudgets[monthKey][snapshot.name] = amount;
  });
  Object.entries(snapshot.planBudgets || {}).forEach(([since, amount]) => {
    const plan = plans().find((p) => p.since === since);
    if (plan) plan.amounts[snapshot.name] = amount;
  });
  (snapshot.recurringMoved || []).forEach((id) => {
    const t = recurringList().find((item) => item.id === id);
    if (t && t.category === fallback) t.category = snapshot.name;
  });
  notify();
  return true;
}

function renameCategory(type, from, to) {
  const name = String(to || '').trim();
  const list = categoryList(type);
  const idx = list.indexOf(from);
  if (idx === -1) return { ok: false, reason: 'not-found' };
  if (from === FALLBACK_CATEGORY[type]) return { ok: false, reason: 'fallback' };
  if (!name) return { ok: false, reason: 'empty' };
  if (name === from) return { ok: true, count: 0 };
  if (list.includes(name)) return { ok: false, reason: 'exists' };
  let count = 0;
  Object.values(state.days).forEach((day) => {
    const entryList = type === 'income' ? day.income : day.expenses;
    entryList.forEach((entry) => {
      if (entry.category === from) {
        entry.category = name;
        count += 1;
      }
    });
  });
  if (type === 'expense') {
    Object.values(state.settings.monthlyBudgets).forEach((monthBudgets) => {
      if (from in monthBudgets) {
        monthBudgets[name] = monthBudgets[from];
        delete monthBudgets[from];
      }
    });
    plans().forEach((plan) => {
      if (from in plan.amounts) {
        plan.amounts[name] = plan.amounts[from];
        delete plan.amounts[from];
      }
    });
  }
  recurringList().forEach((t) => {
    if (t.category === from && type === 'expense') t.category = name;
  });
  list[idx] = name;
  notify();
  return { ok: true, count };
}

function setCategoryOrder(type, names) {
  const list = categoryList(type);
  if (!Array.isArray(names) || names.length !== list.length) return false;
  const same = names.every((name) => list.includes(name)) && new Set(names).size === names.length;
  if (!same) return false;
  list.splice(0, list.length, ...names);
  notify();
  return true;
}

function copyMonthlyBudgets(fromMonthKey, toMonthKey, { overwrite = false } = {}) {
  const source = state.settings.monthlyBudgets[fromMonthKey] || {};
  const target = state.settings.monthlyBudgets[toMonthKey] || {};
  let count = 0;
  Object.entries(source).forEach(([category, amount]) => {
    if (!state.settings.expenseCategories.includes(category)) return;
    if (!overwrite && target[category] > 0) return;
    if (!(amount > 0)) return;
    target[category] = amount;
    count += 1;
  });
  if (count) {
    state.settings.monthlyBudgets[toMonthKey] = target;
    notify();
  }
  return count;
}

function recurringList() {
  if (!Array.isArray(state.settings.recurring)) state.settings.recurring = [];
  return state.settings.recurring;
}

function daysIn(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function nextMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dueDateKey(template, monthKey) {
  const day = Math.min(Math.max(1, template.day), daysIn(monthKey));
  return `${monthKey}-${String(day).padStart(2, '0')}`;
}

function getRecurring() {
  return recurringList().map((t) => ({ ...t, posted: { ...t.posted } }));
}

function getRecurringTemplate(id) {
  const t = recurringList().find((item) => item.id === id);
  return t ? { ...t, posted: { ...t.posted } } : null;
}

function addRecurring({ name, amount, category, day, necessity = null, since, until = null, postedEntry = null }, today = toDateKey(new Date())) {
  const cleanDay = Math.min(31, Math.max(1, Math.round(Number(day) || 1)));
  const thisMonth = toMonthKey(today);
  let start = since;
  const coversThisMonth = postedEntry && postedEntry.monthKey === thisMonth;
  if (!start) start = dueDateKey({ day: cleanDay }, thisMonth) >= today || coversThisMonth ? thisMonth : nextMonthKey(thisMonth);
  const template = {
    id: generateId(),
    name: String(name || '').trim() || category,
    amount: Number(amount) || 0,
    category,
    day: cleanDay,
    necessity,
    since: start,
    until,
    active: true,
    posted: {},
    createdAt: Date.now(),
  };
  if (postedEntry) {
    template.posted[postedEntry.monthKey] = postedEntry.entryId;
    const day0 = state.days[postedEntry.dateKey];
    const entry = day0 && day0.expenses.find((e) => e.id === postedEntry.entryId);
    if (entry) {
      entry.recurring = true;
      entry.recurringId = template.id;
    }
  }
  recurringList().push(template);
  notify();
  return template.id;
}

function updateRecurring(id, patch) {
  const t = recurringList().find((item) => item.id === id);
  if (!t) return false;
  ['name', 'amount', 'category', 'day', 'necessity', 'until', 'active'].forEach((key) => {
    if (key in patch) t[key] = patch[key];
  });
  if ('day' in patch) t.day = Math.min(31, Math.max(1, Math.round(Number(patch.day) || 1)));
  notify();
  return true;
}

function removeRecurring(id) {
  const list = recurringList();
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const [template] = list.splice(index, 1);
  notify();
  return { template, index };
}

function restoreRecurring(snapshot) {
  if (!snapshot || recurringList().some((t) => t.id === snapshot.template.id)) return false;
  const list = recurringList();
  list.splice(Math.max(0, Math.min(list.length, snapshot.index)), 0, snapshot.template);
  notify();
  return true;
}

function hasDueRecurring(today = toDateKey(new Date())) {
  return postDueRecurring(today, { dry: true }).length > 0;
}

function postDueRecurring(today = toDateKey(new Date()), { dry = false } = {}) {
  const thisMonth = toMonthKey(today);
  const posted = [];
  recurringList().forEach((t) => {
    if (!t.active || !(t.amount > 0)) return;
    if (!t.posted && !dry) t.posted = {};
    const done = t.posted || {};
    const [ty, tm] = thisMonth.split('-').map(Number);
    const floorDate = new Date(ty, tm - 13, 1);
    const floor = `${floorDate.getFullYear()}-${String(floorDate.getMonth() + 1).padStart(2, '0')}`;
    let monthKey = t.since > floor ? t.since : floor;
    while (monthKey <= thisMonth) {
      if (t.until && monthKey > t.until) break;
      if (!done[monthKey]) {
        const dateKey = dueDateKey(t, monthKey);
        if (dateKey <= today && dry) {
          posted.push({ templateId: t.id, dateKey });
        } else if (dateKey <= today) {
          const entry = buildExpense({ amount: t.amount, category: t.category, note: t.name, recurring: true, necessity: t.necessity, recurringId: t.id });
          ensureDay(dateKey).expenses.push(entry);
          t.posted[monthKey] = entry.id;
          posted.push({ templateId: t.id, dateKey, entryId: entry.id, name: t.name, amount: t.amount, category: t.category });
        }
      }
      monthKey = nextMonthKey(monthKey);
    }
  });
  if (posted.length && !dry) {
    notify();
    dispatchEntryEvent('yoworingo:entry-added', 'expense');
  }
  return posted;
}

function restoreSavingsGoal(goal, index) {
  if (!goal || state.settings.savingsGoals.some((g) => g.id === goal.id)) return false;
  const list = state.settings.savingsGoals;
  list.splice(Math.max(0, Math.min(list.length, Number.isInteger(index) ? index : list.length)), 0, { ...goal });
  notify();
  return true;
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
  moveEntry,
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
  getBudgetPlan,
  getBudgetOverrides,
  isMonthAdjusted,
  setBudgetTemplate,
  resetMonthToTemplate,
  getRecurring,
  getRecurringTemplate,
  addRecurring,
  updateRecurring,
  removeRecurring,
  restoreRecurring,
  postDueRecurring,
  hasDueRecurring,
  addSavingsGoal,
  updateSavingsGoalAmount,
  depositToGoal,
  withdrawFromGoal,
  getTransfers,
  removeGoalTransfer,
  restoreGoalTransfer,
  setGoalAutoSavePercent,
  applyMonthlyAutoSavings,
  removeSavingsGoal,
  restoreSavingsGoal,
  addCategory,
  removeCategory,
  restoreCategory,
  renameCategory,
  setCategoryOrder,
  copyMonthlyBudgets,
  countEntriesUsingCategory,
  replaceStore,
};
