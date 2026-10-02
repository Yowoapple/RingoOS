import { createMotion } from '../../../motion/animator.js';
import { MotionSettings } from '../../../motion/presets.js';
import { Data } from '../../../core/data-model.js';
import { Calc } from '../../../core/calculations.js';
import { createOdometer } from '../../../ui/odometer.js';
import { button, clamp, field, group, h, money, select, text } from '../kit.js';

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
  const copyButton = button('沿用上個月', 'btn--secondary st-mini', () => {
    const count = Data.copyMonthlyBudgets(Calc.getPreviousMonthKey(monthKey), monthKey);
    island.toast({ text: count ? '已沿用上個月的預算' : '這個月的預算都已經設好了', note: count ? `${count} 個分類` : '', duration: 2600 });
  });
  hero.append(copyButton);

  const list = h('div', 'st-budgets');
  const rows = new Map();

  function budgetRow(category) {
    const item = h('div', 'st-budget');
    item.dataset.search = `${category} 預算`.toLowerCase();
    item.dataset.label = `${category}預算`;
    const name = text('span', 'st-budget__name', category);
    const spent = text('span', 'st-budget__spent mono', '');
    const meter = bar();
    const input = field({
      prefix: 'NT$',
      inputmode: 'numeric',
      placeholder: '未設定',
      label: `${category}的每月預算`,
      mono: true,
      validate: (v) => amountCheck(v),
      onCommit(v) {
        const value = parseAmount(v) || 0;
        Data.setMonthlyBudget(monthKey, category, value);
      },
    });
    item.append(name, spent, input.el, meter.el);
    return { item, spent, meter, input };
  }

  function renderBudgets() {
    const categories = Data.getState().settings.expenseCategories;
    const budgets = Data.getMonthlyBudgets(monthKey);
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
      const used = summary.expenseByCategory[category] || 0;
      entry.spent.textContent = limit ? `${money(used)} / ${money(limit)}` : used ? `本月 ${money(used)}` : '';
      if (document.activeElement !== entry.input.input) {
        entry.input.input.value = limit ? Math.round(limit).toLocaleString('en-US') : '';
        if (entry.input.el.classList.contains('is-invalid')) entry.input.api.setError('');
      }
      entry.meter.el.hidden = !limit;
      entry.meter.set(limit ? used / limit : 0, limit && used > limit);
    });
    const sum = Object.values(budgets).reduce((acc, v) => acc + (Number(v) || 0), 0);
    total.set(sum);
    const month = Number(monthKey.slice(5, 7));
    heroLabel.textContent = `${month} 月總預算`;
    heroMeta.textContent = sum ? `已花 ${money(summary.expense)} · 剩 ${money(Math.max(0, sum - summary.expense))}` : '在下面替每個分類設定預算';
    heroBar.el.hidden = !sum;
    heroBar.set(sum ? summary.expense / sum : 0, sum && summary.expense > sum);
    const previous = Data.getMonthlyBudgets(Calc.getPreviousMonthKey(monthKey));
    copyButton.hidden = !Object.keys(previous).some((key) => previous[key] > 0 && !(budgets[key] > 0) && categories.includes(key));
  }

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
    const deposit = button('存入', 'btn--secondary st-mini', () => openDeposit(goal.id, deposit));
    const remove = button('刪除', 'btn--ghost st-mini', () => removeGoal(goal.id));
    actions.append(auto.el, deposit, remove);
    card.append(r.el, body, actions);
    return { card, r, title, amount, meta, auto };
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
      entry.r.set(goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0);
    });
    emptyGoals.hidden = goals.length > 0;
  }

  function openDeposit(goalId, source) {
    const goal = Data.getState().settings.savingsGoals.find((g) => g.id === goalId);
    if (!goal) return;
    const amount = field({ prefix: 'NT$', inputmode: 'numeric', placeholder: '0', label: '存入金額', mono: true, validate: (v) => amountCheck(v, { allowEmpty: false }) });
    const submit = () => {
      const error = amountCheck(amount.input.value, { allowEmpty: false });
      const value = parseAmount(amount.input.value);
      if (error || !(value > 0)) {
        amount.api.setError(error || '請輸入大於 0 的金額');
        return;
      }
      Data.depositToGoal(goalId, value);
      dialogs.close(true);
      island.celebrate({ label: `已存入 · ${goal.title}`, amount: value, income: true });
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
      title: `存入「${goal.title}」`,
      content: amount.el,
      width: 18,
      actions: [{ label: '取消', className: 'btn--secondary', value: false }, { label: '存入', className: 'btn--primary', close: false, focus: false, onClick: submit }],
    });
    window.setTimeout(() => amount.input.focus({ preventScroll: true }), 180);
  }

  function removeGoal(goalId) {
    const goals = Data.getState().settings.savingsGoals;
    const index = goals.findIndex((g) => g.id === goalId);
    if (index < 0) return;
    const goal = JSON.parse(JSON.stringify(goals[index]));
    Data.removeSavingsGoal(goalId);
    island.toast({ text: `已刪除「${goal.title}」`, action: '復原', duration: 5000, onAction: () => Data.restoreSavingsGoal(goal, index) });
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
    group([list], { title: '每個分類', className: 'st-group--pad' }),
    group([goalsEl, emptyGoals, goalFoot], { title: '存錢目標', className: 'st-group--pad' }),
  );

  function render() {
    const nowMonth = Data.toMonthKey(Data.toDateKey(new Date()));
    if (nowMonth !== monthKey) monthKey = nowMonth;
    renderBudgets();
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
    show: render,
  };
}
