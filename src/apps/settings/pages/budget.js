import { createMotion } from '../../../motion/animator.js';
import { MotionSettings } from '../../../motion/presets.js';
import { Data } from '../../../core/data-model.js';
import { Calc } from '../../../core/calculations.js';
import { createOdometer } from '../../../ui/odometer.js';
import { button, clamp, field, group, h, money, pulse, segmented, select, swapText, text, toggle } from '../kit.js';

const AUTO = [{ value: '0', label: '不自動存' }, { value: '5', label: '每月 5%' }, { value: '10', label: '每月 10%' }, { value: '15', label: '每月 15%' }, { value: '20', label: '每月 20%' }, { value: '30', label: '每月 30%' }];

function parseAmount(textValue) {
  const value = Number(String(textValue).replace(/[,\s]/g, ''));
  return Number.isFinite(value) ? value : NaN;
}

function amountCheck(textValue, { allowEmpty = true } = {}) {
  if (!String(textValue).trim()) return allowEmpty ? '' : '請輸入金額';
  const value = parseAmount(textValue);
  if (!Number.isFinite(value) || value < 0) return '請輸入 0 以上的數字';
  if (value > 100000000) return '金額太大了，確認一下有沒有多打 0';
  return '';
}

function bar() {
  const el = h('span', 'st-bar', '<i></i>');
  const fill = el.firstChild;
  const motion = createMotion({ p: 0 }, { response: 0.6, damping: 0.62, restDelta: 0.001 });
  motion.onUpdate(({ p }) => {
    fill.style.transform = `scaleX(${clamp(p, 0, 1.04).toFixed(4)})`;
  });
  return {
    el,
    set(p, over) {
      el.classList.toggle('is-over', !!over);
      if (MotionSettings.reduced) motion.set({ p });
      else motion.to({ p }, { response: 0.6, damping: 0.62 });
    },
  };
}

function ring() {
  const el = h('span', 'st-ring');
  el.innerHTML = '<svg viewBox="0 0 44 44" aria-hidden="true"><circle class="st-ring__track" cx="22" cy="22" r="18"/><circle class="st-ring__fill" cx="22" cy="22" r="18" pathLength="1" transform="rotate(-90 22 22)"/></svg><span class="st-ring__pct mono"></span>';
  const fill = el.querySelector('.st-ring__fill');
  const pct = el.querySelector('.st-ring__pct');
  const motion = createMotion({ p: 0 }, { response: 0.7, damping: 0.66, restDelta: 0.001 });
  motion.onUpdate(({ p }) => {
    fill.style.strokeDashoffset = String(1 - clamp(p, 0, 1));
  });
  return {
    el,
    set(p) {
      pct.textContent = `${Math.round(clamp(p, 0, 9.99) * 100)}%`;
      if (MotionSettings.reduced) motion.set({ p });
      else motion.to({ p }, { response: 0.7, damping: 0.66 });
    },
  };
}

export function budgetPage(ctx) {
  const { island, dialogs, frame, menuHost } = ctx;
  const el = h('div', 'st-page__body');
  let monthKey = Data.toMonthKey(Data.toDateKey(new Date()));

  const hero = h('div', 'st-hero');
  hero.innerHTML = '<span class="st-hero__label"></span><span class="st-hero__num mono"><span class="odo-host"></span></span><span class="st-hero__meta"></span>';
  const heroLabel = hero.querySelector('.st-hero__label');
  const heroMeta = hero.querySelector('.st-hero__meta');
  const total = createOdometer(hero.querySelector('.odo-host'), { value: 0, format: (v) => `NT$ ${Math.round(v).toLocaleString('en-US')}` });
  const heroBar = bar();
  hero.append(heroBar.el);
  const resetButton = button('改回每月預算', 'btn--secondary st-mini', () => {
    const before = Data.getBudgetOverrides(monthKey);
    const target = monthKey;
    if (!Data.resetMonthToTemplate(target)) return;
    island.toast({
      text: `${Number(target.slice(5, 7))} 月已改回每月預算`,
      action: '復原',
      duration: 5000,
      onAction: () => Object.entries(before).forEach(([category, amount]) => Data.setMonthlyBudget(target, category, amount)),
    });
  });
  hero.append(resetButton);

  let scope = 0;
  const scopeSeg = segmented(['每月預算', '只調這個月'], 0, (index) => {
    scope = index;
    renderBudgets();
    rows.forEach((entry) => pulse(entry.item));
  }, { label: '預算的範圍' });
  const scopeHint = text('p', 'st-note st-budget-scope__hint', '');
  const scopeBox = h('div', 'st-budget-scope');
  scopeBox.append(scopeSeg.el, scopeHint);

  const list = h('div', 'st-budgets');
  const rows = new Map();

  function budgetRow(category) {
    const item = h('div', 'st-budget');
    item.dataset.search = `${category} 預算`.toLowerCase();
    item.dataset.label = `${category}預算`;
    const name = h('span', 'st-budget__name');
    name.append(text('span', '', category), text('em', 'st-budget__tag', '這個月'));
    const spent = text('span', 'st-budget__spent mono', '');
    const meter = bar();
    const input = field({
      prefix: 'NT$',
      inputmode: 'numeric',
      placeholder: '未設定',
      label: `${category}的預算`,
      mono: true,
      validate: (v) => amountCheck(v),
      onCommit(v) {
        const value = parseAmount(v) || 0;
        if (scope === 0) Data.setBudgetTemplate(category, value, monthKey);
        else Data.setMonthlyBudget(monthKey, category, value);
      },
    });
    item.append(name, spent, input.el, meter.el);
    return { item, spent, meter, input, tag: name.querySelector('.st-budget__tag') };
  }

  function renderBudgets() {
    const categories = Data.getState().settings.expenseCategories;
    const budgets = Data.getMonthlyBudgets(monthKey);
    const plan = Data.getBudgetPlan(monthKey);
    const overrides = Data.getBudgetOverrides(monthKey);
    const shown = scope === 0 ? plan : budgets;
    const month = Number(monthKey.slice(5, 7));
    scopeHint.textContent = scope === 0 ? '之後每個月都照這份預算，不用再重設' : `只改 ${month} 月，其他月份照每月預算`;
    const summary = Calc.summarizeDateKeys(Calc.getMonthDateKeys(monthKey));
    rows.forEach((value, key) => {
      if (!categories.includes(key)) {
        value.item.remove();
        rows.delete(key);
      }
    });
    categories.forEach((category, i) => {
      let entry = rows.get(category);
      if (!entry) {
        entry = budgetRow(category);
        rows.set(category, entry);
      }
      if (list.children[i] !== entry.item) list.insertBefore(entry.item, list.children[i] || null);
      const limit = budgets[category] || 0;
      const value = shown[category] || 0;
      const used = summary.expenseByCategory[category] || 0;
      entry.spent.textContent = limit ? `${money(used)} / ${money(limit)}` : used ? `本月 ${money(used)}` : '';
      entry.tag.hidden = !(category in overrides) || !Object.keys(plan).length;
      entry.input.input.setAttribute('aria-label', scope === 0 ? `${category}的每月預算` : `${category}在 ${month} 月的預算`);
      if (document.activeElement !== entry.input.input) {
        entry.input.input.value = value ? Math.round(value).toLocaleString('en-US') : '';
        if (entry.input.el.classList.contains('is-invalid')) entry.input.api.setError('');
      }
      entry.meter.el.hidden = !limit;
      entry.meter.set(limit ? used / limit : 0, limit && used > limit);
    });
    const sum = Object.values(budgets).reduce((acc, v) => acc + (Number(v) || 0), 0);
    total.set(sum);
    const adjusted = Data.isMonthAdjusted(monthKey);
    heroLabel.textContent = `${month} 月總預算`;
    const base = sum ? `已花 ${money(summary.expense)} · 剩 ${money(Math.max(0, sum - summary.expense))}` : '在下面替每個分類設定預算';
    swapText(heroMeta, adjusted ? `${base} · 這個月有特別調整` : base);
    heroBar.el.hidden = !sum;
    heroBar.set(sum ? summary.expense / sum : 0, sum && summary.expense > sum);
    resetButton.hidden = !adjusted;
  }

  const fixedList = h('div', 'st-fixed');
  const fixedRows = new Map();
  const fixedEmpty = text('p', 'st-note', '記帳時打開「固定支出」，或在這裡新增。到了那天會自動記上一筆，可以復原。');

  function fixedRow(template) {
    const item = h('div', 'st-fixed__row');
    const main = h('button', 'st-fixed__main');
    main.type = 'button';
    const day = h('span', 'st-fixed__day mono');
    const copy = h('span', 'st-fixed__copy');
    const title = text('span', 'st-fixed__title', '');
    const meta = text('span', 'st-fixed__meta', '');
    copy.append(title, meta);
    const amount = text('span', 'st-fixed__amt mono', '');
    main.append(day, copy, amount);
    main.addEventListener('click', () => openFixed(template.id, main));
    const active = toggle(template.active, (on) => Data.updateRecurring(template.id, { active: on }), `${template.name}自動入帳`);
    item.append(main, active.el);
    return { item, day, title, meta, amount, active };
  }

  function nextDue(template) {
    const now = new Date();
    const key = Data.toDateKey(now);
    const thisMonth = Data.toMonthKey(key);
    const posted = template.posted || {};
    if (!posted[thisMonth] && template.since <= thisMonth) return '這個月';
    return '下個月';
  }

  function renderFixed() {
    const list = Data.getRecurring();
    const ids = new Set(list.map((t) => t.id));
    fixedRows.forEach((value, id) => {
      if (!ids.has(id)) {
        value.item.remove();
        fixedRows.delete(id);
      }
    });
    list.forEach((template, i) => {
      let entry = fixedRows.get(template.id);
      if (!entry) {
        entry = fixedRow(template);
        fixedRows.set(template.id, entry);
      }
      if (fixedList.children[i] !== entry.item) fixedList.insertBefore(entry.item, fixedList.children[i] || null);
      entry.item.classList.toggle('is-off', !template.active);
      entry.day.textContent = String(template.day).padStart(2, '0');
      entry.title.textContent = template.name;
      entry.meta.textContent = template.active ? `${template.category} · 每月 ${template.day} 號 · ${nextDue(template)}入帳` : `${template.category} · 已暫停`;
      entry.amount.textContent = `−${money(template.amount).replace('NT$ ', '')}`;
      entry.active.api.set(template.active);
      entry.item.dataset.search = `${template.name} ${template.category} 固定支出 訂閱 房租`.toLowerCase();
      entry.item.dataset.label = template.name;
    });
    fixedEmpty.hidden = list.length > 0;
  }

  function openFixed(templateId, source) {
    const template = templateId ? Data.getRecurringTemplate(templateId) : null;
    const categories = Data.getState().settings.expenseCategories;
    const box = h('div', 'st-form');
    const name = field({ placeholder: '例如：房租、Netflix', label: '名稱', value: template ? template.name : '' });
    const amount = field({ prefix: 'NT$', inputmode: 'numeric', placeholder: '金額', label: '金額', mono: true, value: template ? String(template.amount) : '', validate: (v) => amountCheck(v, { allowEmpty: false }) });
    let category = template ? template.category : categories[0];
    const pick = select({ options: categories.map((c) => ({ value: c, label: c })), value: category, menuHost, label: '分類', onChange: (v) => { category = v; } });
    const dayField = field({ prefix: '每月', inputmode: 'numeric', placeholder: '1–31', label: '每月幾號', mono: true, value: String(template ? template.day : new Date().getDate()), validate: (v) => (/^\d{1,2}$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 31 ? '' : '請輸入 1 到 31') });
    const line = h('div', 'st-form__pair');
    line.append(pick.el, dayField.el);
    box.append(name.el, amount.el, line);
    if (!template) box.append(text('p', 'st-note', '如果這個月的那天還沒到，這個月就會開始記；已經過了就從下個月開始。'));
    const submit = () => {
      const label = name.input.value.trim();
      const value = parseAmount(amount.input.value);
      const day = Number(dayField.input.value);
      if (!label) {
        name.api.setError('請輸入名稱');
        return;
      }
      if (!(value > 0)) {
        amount.api.setError('請輸入大於 0 的金額');
        return;
      }
      if (!(day >= 1 && day <= 31)) {
        dayField.api.setError('請輸入 1 到 31');
        return;
      }
      if (template) Data.updateRecurring(template.id, { name: label.slice(0, 20), amount: value, category, day });
      else Data.addRecurring({ name: label.slice(0, 20), amount: value, category, day });
      dialogs.close(true);
    };
    const actions = [{ label: '取消', className: 'btn--secondary', value: false }, { label: template ? '儲存' : '新增', className: 'btn--primary', close: false, focus: false, onClick: submit }];
    if (template) {
      actions.unshift({
        label: '刪除',
        className: 'btn--danger',
        close: false,
        onClick: () => {
          const snapshot = Data.removeRecurring(template.id);
          dialogs.close(true);
          if (snapshot) island.toast({ text: `已刪除「${template.name.length > 8 ? `${template.name.slice(0, 8)}…` : template.name}」`, action: '復原', duration: 5000, onAction: () => Data.restoreRecurring(snapshot) });
        },
      });
    }
    dialogs.present({ source, frame: frame(), title: template ? template.name : '新的固定支出', content: box, width: 21, actions });
    window.setTimeout(() => (template ? amount : name).input.focus({ preventScroll: true }), 180);
  }

  const addFixed = button('＋ 新增固定支出', 'btn--secondary', () => openFixed(null, addFixed));
  const fixedFoot = h('div', 'st-actions');
  fixedFoot.append(addFixed);

  const goalsEl = h('div', 'st-goals');
  const goalCards = new Map();

  function goalCard(goal) {
    const card = h('article', 'st-goal');
    card.dataset.search = `${goal.title} 存錢 目標`.toLowerCase();
    card.dataset.label = goal.title;
    const r = ring();
    const body = h('div', 'st-goal__body');
    const title = text('h5', 'st-goal__title', goal.title);
    const amount = text('p', 'st-goal__amount mono', '');
    const meta = text('p', 'st-goal__meta', '');
    body.append(title, amount, meta);
    const auto = select({
      options: AUTO,
      value: String(goal.autoSavePercent || 0),
      menuHost,
      label: '每月自動存入',
      onChange: (v) => Data.setGoalAutoSavePercent(goal.id, Number(v)),
    });
    const actions = h('div', 'st-goal__actions');
    const deposit = button('存入', 'btn--secondary st-mini', () => openDeposit(goal.id, deposit, 'in'));
    const withdraw = button('取出', 'btn--secondary st-mini', () => openDeposit(goal.id, withdraw, 'out'));
    const remove = button('刪除', 'btn--ghost st-mini', () => removeGoal(goal.id));
    actions.append(auto.el, deposit, withdraw, remove);
    card.append(r.el, body, actions);
    return { card, r, title, amount, meta, auto, withdraw };
  }

  function renderGoals() {
    const goals = Data.getState().settings.savingsGoals;
    const ids = new Set(goals.map((g) => g.id));
    goalCards.forEach((value, id) => {
      if (!ids.has(id)) {
        value.card.remove();
        goalCards.delete(id);
      }
    });
    goals.forEach((goal, i) => {
      let entry = goalCards.get(goal.id);
      if (!entry) {
        entry = goalCard(goal);
        goalCards.set(goal.id, entry);
      }
      if (goalsEl.children[i] !== entry.card) goalsEl.insertBefore(entry.card, goalsEl.children[i] || null);
      entry.title.textContent = goal.title;
      entry.amount.textContent = `${money(goal.currentAmount)} / ${money(goal.targetAmount)}`;
      const projection = Calc.getGoalProjection(goal);
      const parts = [];
      if (goal.deadline) parts.push(`期限 ${goal.deadline}`);
      if (projection && projection.monthsRemaining !== undefined && projection.monthsRemaining !== null && goal.currentAmount < goal.targetAmount) parts.push(`照目前速度約 ${projection.monthsRemaining} 個月`);
      if (goal.currentAmount >= goal.targetAmount && goal.targetAmount > 0) parts.push('已達成');
      entry.meta.textContent = parts.join(' · ');
      entry.auto.api.set(String(goal.autoSavePercent || 0));
      entry.withdraw.disabled = !(goal.currentAmount > 0);
      entry.r.set(goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0);
    });
    emptyGoals.hidden = goals.length > 0;
  }

  function openDeposit(goalId, source, direction = 'in') {
    const goal = Data.getState().settings.savingsGoals.find((g) => g.id === goalId);
    if (!goal) return;
    const out = direction === 'out';
    const check = (v) => {
      const error = amountCheck(v, { allowEmpty: false });
      if (error) return error;
      if (out && parseAmount(v) > goal.currentAmount) return `最多可以取出 ${money(goal.currentAmount)}`;
      return '';
    };
    const amount = field({ prefix: 'NT$', inputmode: 'numeric', placeholder: '0', label: out ? '取出金額' : '存入金額', mono: true, validate: check });
    const submit = () => {
      const error = check(amount.input.value);
      const value = parseAmount(amount.input.value);
      if (error || !(value > 0)) {
        amount.api.setError(error || '請輸入大於 0 的金額');
        return;
      }
      if (out) Data.withdrawFromGoal(goalId, value);
      else Data.depositToGoal(goalId, value);
      dialogs.close(true);
      island.celebrate({ label: out ? `已取出 · ${goal.title}` : `已存入 · ${goal.title}`, amount: value, income: true });
    };
    amount.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    });
    dialogs.present({
      source,
      frame: frame(),
      title: out ? `從「${goal.title}」取出` : `存入「${goal.title}」`,
      text: out ? `目前 ${money(goal.currentAmount)}；取出的錢會記在今天的帳本，不算收入` : '存入的錢會記在今天的帳本，不算支出',
      content: amount.el,
      width: 18,
      actions: [{ label: '取消', className: 'btn--secondary', value: false }, { label: out ? '取出' : '存入', className: 'btn--primary', close: false, focus: false, onClick: submit }],
    });
    window.setTimeout(() => amount.input.focus({ preventScroll: true }), 180);
  }

  function removeGoal(goalId) {
    const goals = Data.getState().settings.savingsGoals;
    const index = goals.findIndex((g) => g.id === goalId);
    if (index < 0) return;
    const goal = JSON.parse(JSON.stringify(goals[index]));
    Data.removeSavingsGoal(goalId);
    island.toast({ text: `已刪除「${goal.title.length > 8 ? `${goal.title.slice(0, 8)}…` : goal.title}」`, action: '復原', duration: 5000, onAction: () => Data.restoreSavingsGoal(goal, index) });
  }

  function openNewGoal(source) {
    const box = h('div', 'st-form');
    const title = field({ placeholder: '例如：日本旅行', label: '目標名稱' });
    const target = field({ prefix: 'NT$', inputmode: 'numeric', placeholder: '目標金額', label: '目標金額', mono: true, validate: (v) => amountCheck(v, { allowEmpty: false }) });
    const deadline = h('input', 'field st-date');
    deadline.type = 'date';
    deadline.setAttribute('aria-label', '期限（可以不填）');
    const deadlineLabel = text('span', 'st-form__label', '期限（可以不填）');
    box.append(title.el, target.el, deadlineLabel, deadline);
    const submit = () => {
      const name = title.input.value.trim();
      const amount = parseAmount(target.input.value);
      if (!name) {
        title.api.setError('請輸入名稱');
        return;
      }
      if (!(amount > 0)) {
        target.api.setError('請輸入大於 0 的金額');
        return;
      }
      Data.addSavingsGoal({ title: name.slice(0, 20), targetAmount: amount, deadline: deadline.value || null });
      dialogs.close(true);
    };
    dialogs.present({
      source,
      frame: frame(),
      title: '新的存錢目標',
      content: box,
      width: 20,
      actions: [{ label: '取消', className: 'btn--secondary', value: false }, { label: '建立', className: 'btn--primary', close: false, focus: false, onClick: submit }],
    });
    window.setTimeout(() => title.input.focus({ preventScroll: true }), 180);
  }

  const emptyGoals = text('p', 'st-note', '還沒有存錢目標。設一個吧，進度會出現在生活提醒裡。');
  const addGoal = button('＋ 新增目標', 'btn--secondary', () => openNewGoal(addGoal));
  const goalFoot = h('div', 'st-actions');
  goalFoot.append(addGoal);

  el.append(
    group([hero], { className: 'st-group--pad' }),
    group([scopeBox, list], { title: '每個分類', className: 'st-group--pad' }),
    group([fixedList, fixedEmpty, fixedFoot], { title: '固定支出', className: 'st-group--pad' }),
    group([goalsEl, emptyGoals, goalFoot], { title: '存錢目標', className: 'st-group--pad' }),
  );

  function render() {
    const nowMonth = Data.toMonthKey(Data.toDateKey(new Date()));
    if (nowMonth !== monthKey) monthKey = nowMonth;
    renderBudgets();
    renderFixed();
    renderGoals();
  }

  Data.subscribe(() => {
    if (el.isConnected) render();
  });
  render();

  return {
    id: 'budget',
    title: '預算與目標',
    lede: '這個月想花多少、想存多少',
    icon: 'budget',
    el,
    show: () => {
      render();
      scopeSeg.api.measure();
    },
  };
}
