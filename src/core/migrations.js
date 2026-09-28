export const CURRENT_SCHEMA = 2;
export const CREATED_WITH = 'RingoOS by YoWoRingo';

export const DEFAULT_INCOME_CATEGORIES = ['薪資', '獎金', '投資', '其他收入'];
export const DEFAULT_EXPENSE_CATEGORIES = ['餐飲', '交通', '居住', '娛樂', '醫療', '教育', '其他'];

export function isLedgerShape(doc) {
  return !!doc && typeof doc === 'object' && !!doc.days && typeof doc.days === 'object' && !!doc.settings && typeof doc.settings === 'object';
}

export function detectSchema(doc) {
  const schema = doc && doc.meta && doc.meta.schema;
  return Number.isInteger(schema) ? schema : 1;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function migrateTaskFields(task) {
  const next = { ...task };
  if (next.durationChoice === undefined && next.durationMinutes) {
    next.durationChoice = String(next.durationMinutes);
  }
  delete next.durationMinutes;
  if (next.reminderLead === undefined && next.reminderMinutes !== undefined) {
    next.reminderLead = next.reminderMinutes === null ? 'none' : `${next.reminderMinutes}M`;
  }
  delete next.reminderMinutes;
  return next;
}

function migrateGoal(goal) {
  return {
    ...goal,
    currentAmount: typeof goal.currentAmount === 'number' ? goal.currentAmount : 0,
    autoSavePercent: goal.autoSavePercent === undefined ? null : goal.autoSavePercent,
    lastAutoSaveMonth: goal.lastAutoSaveMonth === undefined ? null : goal.lastAutoSaveMonth,
    deposits: asArray(goal.deposits),
  };
}

function toSchema2(doc) {
  const now = new Date().toISOString();
  const meta = doc.meta && typeof doc.meta === 'object' ? doc.meta : {};
  const settings = doc.settings;

  const days = {};
  Object.entries(doc.days).forEach(([dateKey, day]) => {
    const source = day && typeof day === 'object' ? day : {};
    days[dateKey] = {
      ...source,
      income: asArray(source.income),
      expenses: asArray(source.expenses),
      tasks: asArray(source.tasks).map(migrateTaskFields),
    };
  });

  const { wallpaper, ...rest } = doc;

  return {
    ...rest,
    meta: {
      ...meta,
      schema: 2,
      createdWith: CREATED_WITH,
      createdAt: meta.createdAt || meta.lastModified || now,
      lastModified: meta.lastModified || now,
    },
    settings: {
      ...settings,
      currency: settings.currency || 'TWD',
      incomeCategories: Array.isArray(settings.incomeCategories) ? settings.incomeCategories : [...DEFAULT_INCOME_CATEGORIES],
      expenseCategories: Array.isArray(settings.expenseCategories) ? settings.expenseCategories : [...DEFAULT_EXPENSE_CATEGORIES],
      monthlyBudgets: settings.monthlyBudgets && typeof settings.monthlyBudgets === 'object' ? settings.monthlyBudgets : {},
      savingsGoals: asArray(settings.savingsGoals).map(migrateGoal),
      taskReminderLookaheadDays: typeof settings.taskReminderLookaheadDays === 'number' ? settings.taskReminderLookaheadDays : 1,
    },
    days,
  };
}

const steps = {
  1: toSchema2,
};

export function migrateLedger(input) {
  if (!isLedgerShape(input)) throw new Error('INVALID_LEDGER');
  let schema = detectSchema(input);
  if (schema > CURRENT_SCHEMA) throw new Error('NEWER_SCHEMA');
  let doc = structuredClone(input);
  while (schema < CURRENT_SCHEMA) {
    doc = steps[schema](doc);
    schema += 1;
  }
  return doc;
}

export function createDefaultLedger() {
  const now = new Date().toISOString();
  return {
    meta: { schema: CURRENT_SCHEMA, createdWith: CREATED_WITH, createdAt: now, lastModified: now },
    settings: {
      currency: 'TWD',
      incomeCategories: [...DEFAULT_INCOME_CATEGORIES],
      expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
      monthlyBudgets: {},
      savingsGoals: [],
      taskReminderLookaheadDays: 1,
    },
    days: {},
  };
}
