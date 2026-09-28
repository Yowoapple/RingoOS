import { Calc } from '../../core/calculations.js';
import { Data } from '../../core/data-model.js';
import { IO } from '../../core/data-io.js';

let activeEntryType = 'expense';

function initDailyEntryForm() {
  const dateInput = document.getElementById('daily-date');
  const tabIncomeBtn = document.querySelector('[data-entry-tab="income"]');
  const tabExpenseBtn = document.querySelector('[data-entry-tab="expense"]');
  const categorySelect = document.getElementById('entry-category');
  const amountInput = document.getElementById('entry-amount');
  const noteInput = document.getElementById('entry-note');
  const recurringRow = document.getElementById('entry-recurring-row');
  const recurringCheckbox = document.getElementById('entry-recurring');
  const necessityRow = document.getElementById('entry-necessity-row');
  const necessityBtns = document.querySelectorAll('[data-necessity]');
  const addEntryBtn = document.getElementById('add-entry-btn');
  const newCategoryInput = document.getElementById('new-category-name');
  const addCategoryBtn = document.getElementById('add-category-btn');
  const entryList = document.getElementById('entry-list');

  if (!dateInput) return;

  dateInput.value = Data.toDateKey(new Date());

  let selectedNecessity = null;

  function populateCategories() {
    const state = Data.getState();
    const categories = activeEntryType === 'income'
      ? state.settings.incomeCategories
      : state.settings.expenseCategories;
    categorySelect.innerHTML = categories
      .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
      .join('');
  }

  function setActiveTab(type) {
    activeEntryType = type;
    tabIncomeBtn.classList.toggle('is-active', type === 'income');
    tabExpenseBtn.classList.toggle('is-active', type === 'expense');
    recurringRow.style.display = type === 'expense' ? 'flex' : 'none';
    necessityRow.style.display = type === 'expense' ? 'block' : 'none';
    selectedNecessity = null;
    updateNecessityButtons();
    populateCategories();
  }

  function updateNecessityButtons() {
    necessityBtns.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.necessity === selectedNecessity);
    });
  }

  necessityBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedNecessity = selectedNecessity === btn.dataset.necessity ? null : btn.dataset.necessity;
      updateNecessityButtons();
    });
  });

  tabIncomeBtn.addEventListener('click', () => setActiveTab('income'));
  tabExpenseBtn.addEventListener('click', () => setActiveTab('expense'));

  addCategoryBtn.addEventListener('click', () => {
    const name = newCategoryInput.value.trim();
    if (!name) return;
    Data.addCategory(activeEntryType, name);
    newCategoryInput.value = '';
    populateCategories();
  });

  addEntryBtn.addEventListener('click', () => {
    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) {
      amountInput.focus();
      return;
    }
    const dateKey = dateInput.value || Data.toDateKey(new Date());
    const category = categorySelect.value;
    const note = noteInput.value.trim();

    if (activeEntryType === 'income') {
      Data.addIncomeEntry(dateKey, { amount, category, note });
    } else {
      Data.addExpenseEntry(dateKey, {
        amount,
        category,
        note,
        recurring: recurringCheckbox.checked,
        necessity: selectedNecessity,
      });
    }

    amountInput.value = '';
    noteInput.value = '';
    recurringCheckbox.checked = false;
    selectedNecessity = null;
    updateNecessityButtons();
    amountInput.focus();
  });

  dateInput.addEventListener('change', renderEntryList);

  function renderEntryList() {
    const dateKey = dateInput.value;
    const { income, expenses } = Data.getDayEntries(dateKey);

    const rows = [
      ...income.map((e) => entryRowHtml(e, 'income', dateKey)),
      ...expenses.map((e) => entryRowHtml(e, 'expense', dateKey)),
    ];

    entryList.innerHTML = rows.join('');

    entryList.querySelectorAll('[data-delete-entry]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const { entryId, entryType, entryDate } = btn.dataset;
        Data.removeEntry(entryDate, entryType, entryId);
      });
    });
  }

  function necessityDotHtml(necessity) {
    if (necessity === 'want') return '<span class="necessity-dot necessity-dot--want" title="想要"></span>';
    if (necessity === 'need') return '<span class="necessity-dot necessity-dot--need" title="需要"></span>';
    return '';
  }

  function entryRowHtml(entry, type, dateKey) {
    const sign = type === 'income' ? '+' : '－';
    const recurringTag = entry.recurring ? '<span class="entry-row__recurring-tag">固定支出</span>' : '';
    const necessityDot = type === 'expense' ? necessityDotHtml(entry.necessity) : '';
    return `
      <div class="entry-row ${type === 'income' ? 'is-income' : ''}">
        ${necessityDot}
        <span class="entry-row__category">${escapeHtml(entry.category)}</span>
        <span class="entry-row__note">${escapeHtml(entry.note || '')}</span>
        ${recurringTag}
        <span class="entry-row__amount">${sign}${formatAmount(entry.amount)}</span>
        <button class="entry-row__delete" type="button"
                data-delete-entry
                data-entry-id="${entry.id}"
                data-entry-type="${type}"
                data-entry-date="${dateKey}"
                aria-label="刪除這筆記錄">×</button>
      </div>`;
  }

  setActiveTab('expense');
  renderEntryList();
  Data.subscribe(renderEntryList);
}

function initBudgetForm() {
  const budgetList = document.getElementById('budget-list');
  const monthLabel = document.getElementById('budget-month-label');
  if (!budgetList) return;

  const currentMonthKey = Data.toMonthKey(Data.toDateKey(new Date()));
  monthLabel.textContent = formatMonthLabel(currentMonthKey);

  function render() {
    const state = Data.getState();
    const categories = state.settings.expenseCategories;
    const budgets = Data.getMonthlyBudgets(currentMonthKey);
    const breakdown = Calc.getMonthBudgetBreakdown(currentMonthKey);
    const breakdownByCategory = {};
    breakdown.forEach((b) => { breakdownByCategory[b.category] = b; });

    budgetList.innerHTML = categories.map((cat) => {
      const info = breakdownByCategory[cat] || { spent: 0, status: 'no-budget' };
      const statusClass = info.status !== 'no-budget' ? `budget-row--${info.status}` : '';
      const spentText = budgets[cat]
        ? `<span class="budget-row__spent">已花 ${formatAmount(info.spent)}</span>`
        : '';
      return `
      <div class="budget-row ${statusClass}">
        <span class="budget-row__label">${escapeHtml(cat)}</span>
        ${spentText}
        <input type="number" min="0" step="100"
               class="field__input budget-row__input"
               data-budget-category="${escapeHtml(cat)}"
               value="${budgets[cat] || ''}"
               placeholder="未設定">
      </div>`;
    }).join('');

    budgetList.querySelectorAll('[data-budget-category]').forEach((input) => {
      input.addEventListener('change', () => {
        const amount = parseFloat(input.value);
        Data.setMonthlyBudget(currentMonthKey, input.dataset.budgetCategory, isNaN(amount) ? 0 : amount);
      });
    });
  }

  render();
  Data.subscribe(render);
}

function initSavingsGoalForm() {
  const goalList = document.getElementById('goal-list');
  if (!goalList) return;

  const titleInput = document.getElementById('goal-title');
  const amountInput = document.getElementById('goal-amount');
  const deadlineInput = document.getElementById('goal-deadline');
  const addGoalBtn = document.getElementById('add-goal-btn');

  addGoalBtn.addEventListener('click', () => {
    const title = titleInput.value.trim();
    const targetAmount = parseFloat(amountInput.value);
    if (!title || !targetAmount || targetAmount <= 0) return;

    Data.addSavingsGoal({ title, targetAmount, deadline: deadlineInput.value || null });
    titleInput.value = '';
    amountInput.value = '';
    deadlineInput.value = '';
  });

  function render() {
    const goals = Data.getState().settings.savingsGoals;
    goalList.innerHTML = goals.map((goal) => {
      const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
      const autoPercent = goal.autoSavePercent || '';
      return `
        <div class="goal-row">
          <div class="goal-row__info">
            <div class="goal-row__title">${escapeHtml(goal.title)}</div>
            <div class="entry-row__note">${formatAmount(goal.currentAmount)} / ${formatAmount(goal.targetAmount)}（${progress}%）</div>
            <div class="goal-row__progress-track">
              <div class="goal-row__progress-fill" style="width: ${progress}%;"></div>
            </div>
            <div class="goal-row__controls">
              <button type="button" class="btn btn--sm btn--secondary" data-deposit-goal="${goal.id}" data-no-drag>手動存入</button>
              <label class="goal-row__auto-label">
                月結餘自動存入
                <input type="number" min="0" max="100" step="5"
                       class="field__input goal-row__auto-input"
                       data-auto-percent-goal="${goal.id}"
                       value="${autoPercent}"
                       placeholder="0" data-no-drag>%
              </label>
            </div>
          </div>
          <button class="entry-row__delete" type="button" data-remove-goal="${goal.id}" aria-label="刪除這個目標">×</button>
        </div>
      `;
    }).join('');

    goalList.querySelectorAll('[data-remove-goal]').forEach((btn) => {
      btn.addEventListener('click', () => Data.removeSavingsGoal(btn.dataset.removeGoal));
    });

    goalList.querySelectorAll('[data-deposit-goal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = window.prompt('這次要存入多少錢？');
        if (input === null) return;
        const amount = parseFloat(input);
        if (!amount || amount <= 0) {
          window.alert('請輸入大於 0 的數字');
          return;
        }
        Data.depositToGoal(btn.dataset.depositGoal, amount);
      });
    });

    goalList.querySelectorAll('[data-auto-percent-goal]').forEach((input) => {
      input.addEventListener('change', () => {
        const percent = parseFloat(input.value);
        Data.setGoalAutoSavePercent(input.dataset.autoPercentGoal, isNaN(percent) ? 0 : percent);
      });
    });
  }

  render();
  Data.subscribe(render);
}

function initDataIOControls() {
  const exportBtn = document.getElementById('export-btn');
  const importInput = document.getElementById('import-input');
  const importBtn = document.getElementById('import-btn');
  const connectFolderBtn = document.getElementById('connect-folder-btn');
  const saveFolderBtn = document.getElementById('save-folder-btn');
  const loadFolderBtn = document.getElementById('load-folder-btn');
  const folderStatus = document.getElementById('folder-status');
  if (!exportBtn) return;

  exportBtn.addEventListener('click', () => IO.exportJSON());

  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      const parsed = await IO.importJSONFile(file);
      Data.replaceStore(parsed);
      IO.applyWallpaperFromPayload(parsed);
      setStatus(folderStatus, '匯入成功，資料已套用', 'success');
    } catch (err) {
      setStatus(folderStatus, err.message, 'error');
    }
    importInput.value = '';
  });

  if (!IO.isFolderSyncSupported()) {
    connectFolderBtn.disabled = true;
    saveFolderBtn.disabled = true;
    loadFolderBtn.disabled = true;
    const reason = window.isSecureContext
      ? '目前瀏覽器不支援資料夾自動讀寫（建議使用 Chrome 或 Edge）'
      : '這個功能需要用 https 網址或本機伺服器（localhost）才能用，直接雙擊開啟的網頁無法使用';
    setStatus(folderStatus, `${reason}，請改用上方匯出/匯入 JSON`, 'default');
    return;
  }

  connectFolderBtn.addEventListener('click', async () => {
    try {
      await IO.connectFolder();
      saveFolderBtn.disabled = false;
      loadFolderBtn.disabled = false;
      setStatus(folderStatus, '資料夾已連結，可以開始自動存讀', 'success');
    } catch (err) {
      setStatus(folderStatus, '未完成資料夾授權', 'error');
    }
  });

  saveFolderBtn.addEventListener('click', async () => {
    try {
      await IO.saveToFolder();
      setStatus(folderStatus, '已寫入資料夾內的 ringoos-data.json', 'success');
    } catch (err) {
      setStatus(folderStatus, err.message, 'error');
    }
  });

  loadFolderBtn.addEventListener('click', async () => {
    try {
      const parsed = await IO.loadFromFolder();
      if (!parsed) {
        setStatus(folderStatus, '資料夾內還沒有資料檔，請先按「寫入資料夾」', 'default');
        return;
      }
      Data.replaceStore(parsed);
      IO.applyWallpaperFromPayload(parsed);
      setStatus(folderStatus, '已從資料夾讀取資料', 'success');
    } catch (err) {
      setStatus(folderStatus, err.message, 'error');
    }
  });
}

function setStatus(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className = 'io-status' + (type === 'success' ? ' is-success' : type === 'error' ? ' is-error' : '');
}

function formatAmount(amount) {
  return Number(amount || 0).toLocaleString('zh-Hant-TW');
}

function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-');
  return `${y} 年 ${parseInt(m, 10)} 月`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function boot() {
  if (!Data) {
    console.error('Life Ledger：找不到 data-model.js（Data 是 undefined）。'
      + '請確認 js 資料夾內有這個檔案，且路徑跟 index.html 的 <script> 標籤一致。');
    return;
  }

  safeInit('initDailyEntryForm', initDailyEntryForm);
  safeInit('initBudgetForm', initBudgetForm);
  safeInit('initSavingsGoalForm', initSavingsGoalForm);
  safeInit('initDataIOControls', initDataIOControls);
}

function safeInit(name, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`Life Ledger：「${name}」初始化失敗，但其他功能仍會繼續運作。`, err);
  }
}
