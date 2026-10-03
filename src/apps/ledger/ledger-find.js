import { createMotion } from '../../motion/animator.js';
import { MotionSettings } from '../../motion/presets.js';
import { Data } from '../../core/data-model.js';
import { createRowList } from '../../ui/rows.js';
import { createDatePicker } from '../../ui/datepicker.js';
import { createOdometer, formatAmount } from '../../ui/odometer.js';
import { Fx } from '../../ui/fx-tier.js';
import { renderEntryRow } from './row-view.js';
import { collect, emptyFilters, isFiltered, search } from './search.js';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const PAGE = 150;
const KIND_LABELS = [['all', '全部'], ['expense', '支出'], ['income', '收入'], ['transfer', '轉帳']];
const PERIOD_LABELS = [['all', '全部'], ['month', '本月'], ['quarter', '近 3 個月'], ['year', '今年']];

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function blur(t, px) {
  return t < 0.98 && Fx.tier !== 'solid' ? `blur(${((1 - t) * px).toFixed(2)}px)` : '';
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function shortDate(key) {
  const d = parseDateKey(key);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} 週${WEEK[d.getDay()]}`;
}

function signedText(value) {
  if (value > 0) return `+${formatAmount(value)}`;
  if (value < 0) return `−${formatAmount(value)}`;
  return '0';
}

function readNumber(text) {
  const value = Number(String(text).replace(/[,\s]/g, ''));
  return String(text).trim() && Number.isFinite(value) && value >= 0 ? value : null;
}

function toRow(item) {
  return { ...item, type: item.kind };
}

function signature(item) {
  return JSON.stringify([item.kind, item.dateKey, item.amount, item.category, item.note, item.recurring, item.necessity, item.signed]);
}

const rises = new WeakMap();

function rise(el, { delay = 0, distance = 10 } = {}) {
  let entry = rises.get(el);
  if (!entry) {
    const motion = createMotion({ e: 1 }, { response: 0.44, damping: 0.72, restDelta: 0.002 });
    motion.onUpdate(({ e }) => {
      const t = clamp01(e);
      el.style.opacity = t > 0.999 ? '' : String(t);
      el.style.transform = t > 0.999 && e <= 1.001 ? '' : `translate3d(0, ${((1 - e) * distance).toFixed(2)}px, 0)`;
      el.style.filter = blur(t, 5);
    });
    entry = { motion, timer: 0 };
    rises.set(el, entry);
  }
  window.clearTimeout(entry.timer);
  if (MotionSettings.reduced) {
    entry.motion.set({ e: 1 });
    return entry.motion;
  }
  entry.motion.set({ e: 0 });
  entry.timer = window.setTimeout(() => entry.motion.to({ e: 1 }, { response: 0.44, damping: 0.72 }), delay);
  return entry.motion;
}

export function createLedgerFind({ ledgerRoot, button, host, island, onToggle }) {
  const section = ledgerRoot.querySelector('[data-ledger="find"]');
  const q = (name) => section.querySelector(`[data-find="${name}"]`);
  const bar = q('bar');
  const input = q('q');
  const clearBtn = q('clear');
  const doneBtn = q('done');
  const filtersEl = q('filters');
  const groupsEl = q('groups');
  const emptyEl = q('empty');
  const moreBtn = q('more');
  const resetBtn = q('reset');
  const sumEl = q('sum');
  const countOdo = createOdometer(q('count'), { value: 0, format: (v) => Math.round(v).toLocaleString('en-US') });
  let totalValue = 0;
  const totalOdo = createOdometer(q('total'), { value: 0, format: (v) => `合計 ${signedText(totalValue < 0 ? -v : v)}` });

  let filters = emptyFilters();
  let limit = PAGE;
  let phase = 'closed';
  let timer = 0;
  const groups = new Map();
  const seen = new Map();
  const restoring = new Set();
  let expanded = null;

  const formParts = [ledgerRoot.querySelector('.ledger__form'), ledgerRoot.querySelector('.ledger__side')];
  const swapMotion = createMotion({ e: 1 }, { response: 0.3, damping: 1, restDelta: 0.002 });
  swapMotion.onUpdate(({ e }) => {
    const t = clamp01(e);
    formParts.forEach((el) => {
      el.style.opacity = t > 0.999 ? '' : String(t);
      el.style.transform = t > 0.999 ? '' : `translate3d(0, ${((1 - t) * -8).toFixed(2)}px, 0) scale(${(0.985 + 0.015 * t).toFixed(4)})`;
      el.style.filter = blur(t, 4);
    });
  });

  const body = section.querySelector('.lg-find__body');
  const glass = bar.querySelector('.lg-find__glass');
  const barParts = [input, clearBtn, doneBtn];
  const across = createMotion({ l: 0 }, { response: 0.42, damping: 0.56, restDelta: 0.3 });
  const down = createMotion({ y: 0, r: 0 }, { response: 0.5, damping: 0.62, restDelta: 0.3 });
  const contents = createMotion({ c: 1 }, { response: 0.3, damping: 0.78, restDelta: 0.002 });
  const bodyMotion = createMotion({ e: 1 }, { response: 0.3, damping: 0.9, restDelta: 0.002 });
  const OPEN_ACROSS = { response: 0.42, damping: 0.56 };
  const OPEN_DOWN = { response: 0.5, damping: 0.62 };
  const CLOSE_ACROSS = { response: 0.38, damping: 0.68 };
  const CLOSE_DOWN = { response: 0.32, damping: 0.72 };
  let W = 0;
  let H = 0;
  let glassC = 0;
  let acrossTimer = 0;
  let downTimer = 0;
  let contentTimer = 0;
  let acrossPending = false;
  let downPending = false;

  function measure() {
    W = bar.offsetWidth;
    H = bar.offsetHeight;
    glassC = parseFloat(getComputedStyle(bar).paddingLeft) + glass.offsetWidth / 2;
  }

  function seedShape() {
    const d = H * 0.62;
    return { l: W - H / 2 - d / 2, y: (H - d) / 2, r: H / 2 - d / 2 };
  }

  function pointShape() {
    return { l: W - H / 2, y: H / 2, r: H / 2 };
  }

  function clearBarStyles() {
    bar.style.clipPath = '';
    bar.style.transform = '';
    glass.style.transform = '';
  }

  function paintBar() {
    if (phase === 'closed' || phase === 'fading' || !W) return;
    const { l } = across.values;
    const { y, r } = down.values;
    const visW = W - l - r;
    const stretch = Math.min(0.14, Math.abs(across.velocity('l')) / Math.max(1, Math.max(visW, H) * 9));
    const top = y + (stretch * Math.max(0, H - 2 * y)) / 2;
    const visH = H - 2 * top;
    if (phase === 'closing' && (visW <= 0.5 || visH <= 0.5)) {
      finishClose();
      return;
    }
    const left = Math.max(0, l);
    const width = W - left - r;
    const radius = Math.max(0, Math.min(width, visH) / 2);
    const over = Math.min(0.045, (Math.max(0, -l) / W) * 0.5);
    bar.style.transform = over > 0.0005 ? `scaleX(${(1 + over).toFixed(4)})` : '';
    bar.style.clipPath = `inset(${top.toFixed(2)}px ${r.toFixed(2)}px ${top.toFixed(2)}px ${left.toFixed(2)}px round ${radius.toFixed(2)}px)`;
    const shift = left + Math.min(glassC, Math.max(0, width) / 2) - glassC;
    glass.style.transform = Math.abs(shift) < 0.05 ? '' : `translate3d(${shift.toFixed(2)}px, 0, 0)`;
  }
  across.onUpdate(paintBar);
  down.onUpdate(paintBar);

  contents.onUpdate(({ c }) => {
    const t = clamp01(c);
    barParts.forEach((el) => {
      el.style.opacity = t > 0.999 ? '' : String(t);
      el.style.transform = t > 0.999 ? '' : `translate3d(${((1 - t) * 8).toFixed(2)}px, 0, 0)`;
      el.style.filter = blur(t, 5);
    });
  });

  bodyMotion.onUpdate(({ e }) => {
    const t = clamp01(e);
    body.style.opacity = t > 0.999 ? '' : String(t);
    body.style.filter = blur(t, 4);
  });

  function settle() {
    if (acrossPending || downPending || across.isAnimating || down.isAnimating) return;
    if (phase === 'opening') {
      phase = 'open';
      clearBarStyles();
    } else if (phase === 'closing') {
      finishClose();
    }
  }

  function shapeTo(target, a, d, { delay = 0, lag = 0 } = {}) {
    window.clearTimeout(acrossTimer);
    window.clearTimeout(downTimer);
    acrossPending = true;
    downPending = true;
    const goAcross = () => {
      acrossPending = false;
      across.to({ l: target.l }, a).then(settle);
    };
    const goDown = () => {
      downPending = false;
      down.to({ y: target.y, r: target.r }, d).then(settle);
    };
    if (delay > 0) acrossTimer = window.setTimeout(goAcross, delay);
    else goAcross();
    if (delay + lag > 0) downTimer = window.setTimeout(goDown, delay + lag);
    else goDown();
  }

  function filterSection(title, key, options, { multi = false } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'lg-filter';
    const label = document.createElement('span');
    label.className = 'lg-filter__label';
    label.textContent = title;
    const row = document.createElement('div');
    row.className = 'lg-filter__chips';
    row.setAttribute('role', multi ? 'group' : 'radiogroup');
    row.setAttribute('aria-label', title);
    wrap.append(label, row);
    function paint() {
      row.textContent = '';
      options().forEach(([value, text]) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip chip--sm';
        chip.dataset.value = value;
        chip.textContent = text;
        const on = multi ? filters[key].includes(value) : filters[key] === value;
        chip.setAttribute(multi ? 'aria-pressed' : 'aria-checked', String(on));
        if (!multi) chip.setAttribute('role', 'radio');
        row.append(chip);
      });
    }
    row.addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (!chip) return;
      const value = chip.dataset.value;
      if (multi) {
        const set = new Set(filters[key]);
        if (set.has(value)) set.delete(value);
        else set.add(value);
        filters = { ...filters, [key]: [...set] };
      } else {
        filters = { ...filters, [key]: value };
        if (key === 'period' && value !== 'range') filters.range = null;
      }
      paint();
      pop(row.querySelector(`[data-value="${CSS.escape(value)}"]`));
      run();
    });
    return { el: wrap, paint };
  }

  function pop(el) {
    if (!el || MotionSettings.reduced) return;
    const motion = createMotion({ s: 0.9 }, { response: 0.36, damping: 0.4, restDelta: 0.0005 });
    motion.onUpdate(({ s }) => {
      el.style.transform = Math.abs(s - 1) < 0.0005 ? '' : `scale(${s})`;
    });
    motion.to({ s: 1 }, { response: 0.36, damping: 0.4, velocity: { s: 2.4 } });
  }

  function categoryOptions() {
    const settings = Data.getState().settings;
    const names = [...settings.expenseCategories, ...settings.incomeCategories];
    return [...new Set(names)].map((name) => [name, name]);
  }

  const kindSection = filterSection('類型', 'kind', () => KIND_LABELS);
  const periodSection = filterSection('期間', 'period', () => (filters.range ? [...PERIOD_LABELS, ['range', filters.range.label]] : PERIOD_LABELS));
  const catSection = filterSection('分類', 'categories', categoryOptions, { multi: true });

  const amountWrap = document.createElement('div');
  amountWrap.className = 'lg-filter';
  amountWrap.innerHTML = '<span class="lg-filter__label">金額</span><div class="lg-filter__range"><input class="field lg-filter__num mono" inputmode="numeric" placeholder="最少" aria-label="最少金額" autocomplete="off"><span aria-hidden="true">–</span><input class="field lg-filter__num mono" inputmode="numeric" placeholder="最多" aria-label="最多金額" autocomplete="off"></div>';
  const [minInput, maxInput] = amountWrap.querySelectorAll('input');
  [minInput, maxInput].forEach((el) => {
    el.addEventListener('input', () => {
      filters = { ...filters, min: readNumber(minInput.value), max: readNumber(maxInput.value) };
      schedule();
    });
  });

  const fixedWrap = document.createElement('div');
  fixedWrap.className = 'lg-filter';
  fixedWrap.innerHTML = '<span class="lg-filter__label">其他</span><div class="lg-filter__chips"><button type="button" class="chip chip--sm" aria-pressed="false">只看固定支出</button></div>';
  const fixedChip = fixedWrap.querySelector('.chip');
  fixedChip.addEventListener('click', () => {
    filters = { ...filters, fixed: !filters.fixed };
    fixedChip.setAttribute('aria-pressed', String(filters.fixed));
    pop(fixedChip);
    run();
  });

  filtersEl.append(kindSection.el, periodSection.el, catSection.el, amountWrap, fixedWrap);

  function paintFilters() {
    kindSection.paint();
    periodSection.paint();
    catSection.paint();
    minInput.value = filters.min === null ? '' : String(filters.min);
    maxInput.value = filters.max === null ? '' : String(filters.max);
    fixedChip.setAttribute('aria-pressed', String(!!filters.fixed));
    if (document.activeElement !== input) input.value = filters.q;
    clearBtn.hidden = !filters.q;
  }

  input.addEventListener('input', () => {
    filters = { ...filters, q: input.value };
    clearBtn.hidden = !input.value;
    schedule();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (input.value) {
        input.value = '';
        filters = { ...filters, q: '' };
        clearBtn.hidden = true;
        run();
      } else {
        close();
      }
    }
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    filters = { ...filters, q: '' };
    clearBtn.hidden = true;
    input.focus();
    run();
  });
  resetBtn.addEventListener('click', () => {
    filters = emptyFilters();
    paintFilters();
    run();
  });
  doneBtn.addEventListener('click', () => close());
  moreBtn.addEventListener('click', () => {
    limit += PAGE;
    run();
  });

  function schedule() {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 140);
  }

  function editor() {
    const el = document.createElement('div');
    el.className = 'lg-edit';
    el.dataset.rowOwn = '';
    el.innerHTML = '<div class="lg-edit__inner">'
      + '<div class="lg-edit__top"><label class="amount lg-edit__amount"><span class="amount__cur mono">NT$</span><input class="amount__input" data-e="amount" inputmode="decimal" autocomplete="off" aria-label="金額"></label><button type="button" class="tag date-tag lg-edit__date" data-e="date" aria-label="日期，按一下可以換一天"></button></div>'
      + '<div class="chips" role="radiogroup" aria-label="分類" data-e="chips"></div>'
      + '<input class="field" data-e="note" placeholder="備註（選填）" aria-label="備註" autocomplete="off">'
      + '<div class="ledger__need" role="group" aria-label="需要還是想要" data-e="need"><button type="button" class="chip chip--sm" data-value="need" aria-pressed="false">需要</button><button type="button" class="chip chip--sm" data-value="want" aria-pressed="false">想要</button></div>'
      + '<div class="lg-edit__actions"><button type="button" class="btn btn--danger" data-e="delete">刪除</button><button type="button" class="btn btn--primary" data-e="save">儲存</button></div>'
      + '</div>';
    const e = (name) => el.querySelector(`[data-e="${name}"]`);
    const inner = el.querySelector('.lg-edit__inner');
    const amount = e('amount');
    const dateBtn = e('date');
    const chips = e('chips');
    const note = e('note');
    const need = e('need');
    let item = null;
    let dateKey = null;
    let category = null;
    let necessity = null;
    let shown = false;
    let natural = 0;

    const picker = createDatePicker({
      trigger: dateBtn,
      host,
      value: new Date(),
      onChange(day) {
        dateKey = Data.toDateKey(day);
        dateBtn.textContent = shortDate(dateKey);
        pop(dateBtn);
      },
    });

    function paintChips() {
      const settings = Data.getState().settings;
      const list = item.kind === 'income' ? settings.incomeCategories : settings.expenseCategories;
      chips.textContent = '';
      [...new Set([...list, category])].forEach((name) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.setAttribute('role', 'radio');
        chip.dataset.category = name;
        chip.setAttribute('aria-checked', String(name === category));
        chip.textContent = name;
        chips.append(chip);
      });
    }

    chips.addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (!chip) return;
      category = chip.dataset.category;
      chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', String(c === chip)));
      pop(chip);
    });
    need.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-value]');
      if (!chip) return;
      necessity = necessity === chip.dataset.value ? null : chip.dataset.value;
      need.querySelectorAll('[data-value]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.value === necessity)));
      pop(chip);
    });
    amount.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        save();
      }
    });
    note.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        save();
      }
    });

    function shake(target) {
      if (MotionSettings.reduced) return;
      const motion = createMotion({ x: 0 }, { response: 0.3, damping: 0.3, restDelta: 0.05 });
      motion.onUpdate(({ x }) => {
        target.style.transform = Math.abs(x) < 0.05 ? '' : `translate3d(${x}px, 0, 0)`;
      });
      motion.to({ x: 0 }, { velocity: { x: 600 } });
    }

    function save() {
      const value = Number(String(amount.value).replace(/[^\d.]/g, ''));
      if (!(value > 0)) {
        shake(amount.closest('.amount'));
        amount.focus();
        return;
      }
      const patch = { amount: Math.round(value * 100) / 100, category, note: note.value.trim() };
      if (item.kind === 'expense') patch.necessity = necessity;
      const moved = dateKey !== item.dateKey;
      Data.moveEntry(item.dateKey, item.kind, item.id, dateKey, patch);
      island.celebrate({ label: moved ? `已移到 ${shortDate(dateKey).slice(0, 5)} · ${category}` : `已更新 · ${category}`, amount: patch.amount, income: item.kind === 'income' });
      collapse();
    }

    e('save').addEventListener('click', save);
    e('delete').addEventListener('click', () => {
      const target = item;
      collapse(true);
      removeItem(target);
    });

    const motion = createMotion({ h: 0, e: 0 }, { response: 0.42, damping: 0.78, restDelta: { h: 0.5, e: 0.002 } });
    motion.onUpdate(({ h, e: v }) => {
      el.style.height = shown && h >= natural - 0.5 && v > 0.998 ? '' : `${Math.max(0, h)}px`;
      const t = clamp01(v);
      inner.style.opacity = String(t);
      inner.style.transform = t > 0.999 ? '' : `translate3d(0, ${((1 - t) * -6).toFixed(2)}px, 0)`;
      inner.style.filter = blur(t, 4);
      if (!shown && h < 0.5) el.remove();
    });

    return {
      get item() { return item; },
      open(next, anchor) {
        item = next;
        dateKey = next.dateKey;
        category = next.category;
        necessity = next.necessity || null;
        amount.value = String(next.amount);
        note.value = next.note || '';
        dateBtn.textContent = shortDate(dateKey);
        picker.set(parseDateKey(dateKey));
        need.hidden = next.kind !== 'expense';
        need.querySelectorAll('[data-value]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.value === necessity)));
        paintChips();
        anchor.after(el);
        shown = true;
        el.style.height = 'auto';
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
        picker.close();
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

  const edit = editor();

  function collapse(instant = false) {
    if (!expanded) return;
    const group = groups.get(expanded.monthKey);
    expanded = null;
    edit.close(instant);
    if (group) group.list.clearSelection();
  }

  function removeItem(item) {
    if (item.kind === 'transfer') {
      const snapshot = Data.removeGoalTransfer(item.goalId, item.id);
      if (!snapshot) return;
      if (snapshot.blocked) {
        restoring.add(item.id);
        run();
        island.toast({ text: `${item.category} 的錢已經取出一部分，先取消那筆取出`, duration: 3600 });
        return;
      }
      island.toast({ text: `${item.signed < 0 ? '已取消取出' : '已取消存入'} · ${item.category}`, amount: item.amount, income: item.signed < 0, action: '復原', onAction: () => { restoring.add(item.id); Data.restoreGoalTransfer(snapshot); } });
      return;
    }
    const index = Data.getEntryIndex(item.dateKey, item.kind, item.id);
    if (index < 0) return;
    const entry = Data.getDayEntries(item.dateKey)[item.kind === 'income' ? 'income' : 'expenses'][index];
    Data.removeEntry(item.dateKey, item.kind, item.id);
    island.toast({
      text: `已刪除 · ${item.category}`,
      amount: item.amount,
      income: item.kind === 'income',
      action: '復原',
      onAction() {
        restoring.add(item.id);
        Data.restoreEntry(item.dateKey, item.kind, entry, index);
      },
    });
  }

  function groupFor(monthKey) {
    let group = groups.get(monthKey);
    if (group) return group;
    const el = document.createElement('section');
    el.className = 'lg-group';
    el.innerHTML = '<header class="lg-group__head"><span class="lg-group__month mono"></span><span class="lg-group__meta"></span><span class="lg-group__sum mono"></span></header><div class="lg-group__rows" role="list"></div>';
    const [y, m] = monthKey.split('-');
    el.querySelector('.lg-group__month').textContent = `${y}.${m}`;
    const meta = el.querySelector('.lg-group__meta');
    const sumEl = el.querySelector('.lg-group__sum');
    const rowsEl = el.querySelector('.lg-group__rows');
    rowsEl.setAttribute('aria-label', `${Number(m)} 月的紀錄`);
    const list = createRowList(rowsEl, {
      render: (row) => renderEntryRow(row, { prefix: shortDate(row.dateKey) }),
      onDelete: (row) => {
        seen.delete(row.id);
        if (expanded && expanded.id === row.id) collapse(true);
        removeItem(row);
      },
      onSelect(row) {
        if (!row) {
          if (expanded && expanded.monthKey === monthKey) {
            expanded = null;
            edit.close();
          }
          return;
        }
        if (row.kind === 'transfer') {
          list.clearSelection();
          return;
        }
        if (expanded && expanded.id !== row.id) {
          const other = groups.get(expanded.monthKey);
          edit.close(true);
          if (other && other !== group) other.list.clearSelection();
        }
        expanded = { id: row.id, monthKey };
        const anchor = list.element(row.id);
        if (anchor) edit.open(row, anchor);
      },
    });
    group = { el, meta, sumEl, list, monthKey, leaving: false };
    groups.set(monthKey, group);
    return group;
  }

  function dropGroup(group) {
    if (group.leaving) return;
    group.leaving = true;
    groups.delete(group.monthKey);
    if (MotionSettings.reduced || phase !== 'open') {
      group.el.remove();
      return;
    }
    const height = group.el.offsetHeight;
    const motion = createMotion({ e: 1 }, { response: 0.3, damping: 1, restDelta: 0.002 });
    motion.onUpdate(({ e }) => {
      const t = clamp01(e);
      group.el.style.opacity = String(t);
      group.el.style.height = `${(height * t).toFixed(2)}px`;
      group.el.style.overflow = 'hidden';
      group.el.style.filter = blur(t, 4);
    });
    motion.to({ e: 0 }, { response: 0.3, damping: 1 }).then(() => group.el.remove());
  }

  function run() {
    window.clearTimeout(timer);
    if (section.hidden) return;
    const today = Data.toDateKey(new Date());
    const items = collect(Data.getState(), Data.getTransfers());
    const out = search(items, filters, today);
    const visible = [];
    let budget = limit;
    out.groups.forEach((g) => {
      if (budget <= 0) return;
      const slice = g.items.slice(0, budget);
      budget -= slice.length;
      visible.push({ ...g, items: slice, total: g.items.length });
    });
    const wanted = new Set(visible.map((g) => g.monthKey));
    groups.forEach((group) => {
      if (!wanted.has(group.monthKey)) dropGroup(group);
    });
    if (expanded && !visible.some((g) => g.monthKey === expanded.monthKey && g.items.some((item) => item.id === expanded.id))) collapse(true);
    visible.forEach((g, i) => {
      const fresh = !groups.has(g.monthKey);
      const group = groupFor(g.monthKey);
      const before = groupsEl.children[i];
      if (before !== group.el) groupsEl.insertBefore(group.el, before || null);
      if (fresh && phase === 'open') rise(group.el, { delay: i * 30 });
      group.meta.textContent = `${g.total} 筆`;
      group.sumEl.textContent = signedText(g.sum);
      if (fresh) {
        group.list.reset(g.items.map(toRow));
        g.items.forEach((item) => {
          seen.set(item.id, signature(item));
          restoring.delete(item.id);
        });
        return;
      }
      const ids = new Set(g.items.map((item) => item.id));
      group.list.ids().forEach((id) => {
        if (!ids.has(id)) {
          group.list.removeId(id);
          seen.delete(id);
        }
      });
      g.items.forEach((item, index) => {
        const row = toRow(item);
        if (group.list.has(item.id)) {
          if (seen.get(item.id) !== signature(item)) group.list.update(row);
        } else {
          group.list.insertAt(row, index, restoring.has(item.id) ? 'left' : 'top');
          restoring.delete(item.id);
        }
        seen.set(item.id, signature(item));
      });
    });
    const shown = visible.reduce((n, g) => n + g.items.length, 0);
    moreBtn.hidden = shown >= out.count;
    moreBtn.textContent = `再顯示 ${Math.min(PAGE, out.count - shown)} 筆`;
    emptyEl.hidden = out.count > 0;
    resetBtn.hidden = !isFiltered(filters);
    countOdo.set(out.count);
    totalValue = out.total;
    totalOdo.set(Math.abs(out.total));
    sumEl.classList.toggle('is-filtered', isFiltered(filters));
  }

  function staggerIn() {
    const parts = [...filtersEl.children, sumEl, groupsEl];
    parts.forEach((el, i) => rise(el, { delay: 110 + i * 40 }));
  }

  function isActive() {
    return phase === 'fading' || phase === 'opening' || phase === 'open';
  }

  function resetParts() {
    across.stop();
    down.stop();
    contents.stop();
    bodyMotion.stop();
    window.clearTimeout(acrossTimer);
    window.clearTimeout(downTimer);
    window.clearTimeout(contentTimer);
    acrossPending = false;
    downPending = false;
    clearBarStyles();
    barParts.forEach((el) => {
      el.style.opacity = '';
      el.style.transform = '';
      el.style.filter = '';
    });
    body.style.opacity = '';
    body.style.filter = '';
  }

  function showLayout() {
    const scroller = ledgerRoot.closest('.wm-window__body');
    paintFilters();
    ledgerRoot.classList.add('is-finding');
    section.hidden = false;
    if (scroller) scroller.scrollTop = 0;
    run();
  }

  function grow(fresh) {
    window.clearTimeout(contentTimer);
    shapeTo({ l: 0, y: 0, r: 0 }, OPEN_ACROSS, OPEN_DOWN, { lag: fresh ? 40 : 0 });
    const reveal = () => contents.to({ c: 1 }, { response: 0.3, damping: 0.78 });
    if (fresh) contentTimer = window.setTimeout(reveal, 90);
    else reveal();
    if (!fresh) bodyMotion.to({ e: 1 }, { response: 0.32, damping: 0.86 });
    input.focus({ preventScroll: true });
  }

  function finishClose() {
    if (phase !== 'closing') return;
    phase = 'closed';
    resetParts();
    section.hidden = true;
    ledgerRoot.classList.remove('is-finding');
    groups.forEach((group) => group.el.remove());
    groups.clear();
    seen.clear();
    if (MotionSettings.reduced) {
      swapMotion.set({ e: 1 });
      return;
    }
    swapMotion.set({ e: 0 });
    swapMotion.to({ e: 1 }, { response: 0.42, damping: 0.72 });
  }

  function open(next = null) {
    if (next) {
      filters = { ...emptyFilters(), ...next };
      if (filters.range) filters.period = 'range';
      limit = PAGE;
    }
    if (phase === 'open' || phase === 'opening') {
      paintFilters();
      run();
      input.focus({ preventScroll: true });
      return;
    }
    if (phase === 'fading') return;
    onToggle(true);
    button.setAttribute('aria-pressed', 'true');
    if (phase === 'closing') {
      phase = 'opening';
      paintFilters();
      run();
      measure();
      grow(false);
      return;
    }
    if (MotionSettings.reduced) {
      phase = 'open';
      resetParts();
      swapMotion.set({ e: 1 });
      showLayout();
      input.focus({ preventScroll: true });
      return;
    }
    phase = 'fading';
    swapMotion.to({ e: 0 }, { response: 0.12, damping: 1 }).then((done) => {
      if (!done || phase !== 'fading') return;
      resetParts();
      swapMotion.set({ e: 1 });
      showLayout();
      phase = 'opening';
      measure();
      const seed = seedShape();
      contents.set({ c: 0 });
      bodyMotion.set({ e: 1 });
      across.set({ l: seed.l });
      down.set({ y: seed.y, r: seed.r });
      staggerIn();
      grow(true);
    });
  }

  function close() {
    if (!isActive()) return;
    onToggle(false);
    button.setAttribute('aria-pressed', 'false');
    if (phase === 'fading') {
      phase = 'closed';
      swapMotion.to({ e: 1 }, { response: 0.42, damping: 0.72 });
      return;
    }
    collapse(true);
    window.clearTimeout(timer);
    if (section.contains(document.activeElement)) button.focus({ preventScroll: true });
    phase = 'closing';
    if (MotionSettings.reduced) {
      finishClose();
      return;
    }
    measure();
    window.clearTimeout(contentTimer);
    contents.to({ c: 0 }, { response: 0.16, damping: 1 });
    bodyMotion.to({ e: 0 }, { response: 0.16, damping: 1 });
    shapeTo(pointShape(), CLOSE_ACROSS, CLOSE_DOWN, { delay: 60 });
  }

  button.addEventListener('click', () => (isActive() ? close() : open()));
  section.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && event.target !== input) {
      event.preventDefault();
      if (expanded) collapse();
      else close();
    }
  });

  Data.subscribe(() => {
    if (section.hidden) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 60);
  });

  return {
    get isOpen() { return isActive(); },
    open,
    close,
  };
}
